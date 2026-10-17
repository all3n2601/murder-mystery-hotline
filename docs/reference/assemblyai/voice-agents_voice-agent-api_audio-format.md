> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Audio format

All audio is **base64-encoded and mono**. Input and output are configured independently and can differ.

Browsers and Twilio handle capture, playback, and echo for you. This page is for clients that move the bytes themselves.

## Encodings

| Encoding | Sample rate | Bit depth | Best for |
| - | - | - | - |
| `audio/pcm` | 24,000 Hz | 16-bit signed integer (little-endian) | Default. Browsers and apps |
| `audio/pcmu` | 8,000 Hz | 8-bit μ-law | Telephony (G.711 μ-law) |
| `audio/pcma` | 8,000 Hz | 8-bit A-law | Telephony (G.711 A-law) |

Both default to `audio/pcm` at 24 kHz. Change it for telephony, where 8 kHz G.711 matches the phone network and avoids resampling.

Set it on the agent when you [create](/docs/voice-agents/voice-agent-api/create-agent) or [update](/docs/voice-agents/voice-agent-api/manage-agents) it:

<CodeGroup>
  ```bash cURL theme={null}
  curl -X POST https://agents.assemblyai.com/v1/agents \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Telephony Assistant",
      "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
      "voice": { "voice_id": "alba" },
      "input":  { "format": { "encoding": "audio/pcm" } },
      "output": { "format": { "encoding": "audio/pcmu" } }
    }'
  ```

  ```python Python theme={null}
  # pip install requests
  import os
  import requests

  resp = requests.post(
      "https://agents.assemblyai.com/v1/agents",
      headers={"Authorization": os.environ["ASSEMBLYAI_API_KEY"]},
      json={
          "name": "Telephony Assistant",
          "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
          "voice": {"voice_id": "alba"},
          "input": {"format": {"encoding": "audio/pcm"}},
          "output": {"format": {"encoding": "audio/pcmu"}},
      },
  )
  resp.raise_for_status()
  print(resp.json())
  ```

  ```javascript Node.js theme={null}
  // Node 18+ has fetch built in
  const res = await fetch("https://agents.assemblyai.com/v1/agents", {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Telephony Assistant",
      system_prompt: "You are a friendly support agent. Keep replies under two sentences.",
      voice: { voice_id: "alba" },
      input: { format: { encoding: "audio/pcm" } },
      output: { format: { encoding: "audio/pcmu" } },
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

Or inline, in a [`session.update`](/docs/voice-agents/voice-agent-api/events-reference#session-update):

```json theme={null}
{
  "type": "session.update",
  "session": {
    "input": { "format": { "encoding": "audio/pcm" } },
    "output": { "format": { "encoding": "audio/pcmu" } }
  }
}
```

| Field | Type | Required | Notes |
| - | - | - | - |
| `input.format.encoding` | string | No | `audio/pcm`, `audio/pcmu`, or `audio/pcma`. Default `audio/pcm`. |
| `output.format.encoding` | string | No | Same values as input. Default `audio/pcm`. |
| `format.sample_rate` | integer | No | Hz. Determined by the encoding if omitted. |

<Note>
  Inline, `output.format` is [immutable after `session.ready`](/docs/voice-agents/voice-agent-api/session-configuration#mutability-after-session-ready), so set it on your first update. Volume is separate, see [Output volume](/docs/voice-agents/voice-agent-api/volume).
</Note>

## Sending audio

Send [`input.audio`](/docs/voice-agents/voice-agent-api/events-reference#input-audio) events continuously, each a base64 chunk in the configured encoding. Chunk size doesn't matter; \~50 ms works well.

```python theme={null}
import base64

async def send_audio():
    while True:
        chunk = await mic_queue.get()
        await ws.send(json.dumps({
            "type": "input.audio",
            "audio": base64.b64encode(chunk).decode()
        }))
```

Three rules:

* **Wait for [`session.ready`](/docs/voice-agents/voice-agent-api/events-reference#session-ready)** before the first chunk.
* **Send at real time, not faster.** Frames beyond about one second of audio per second of wall clock are dropped, not buffered, and transcription comes back incomplete. Pace pre-recorded test clips with `asyncio.sleep`.
* **Send raw mic audio.** The server denoises already, and a second layer (RNNoise, Krisp, BVC) adds artifacts that cost more accuracy than the noise did. To tune it, use `input.voice_focus`, see [Isolate the caller's voice](/docs/voice-agents/voice-agent-api/noise-suppression).

<Warning>
  Without echo cancellation the agent hears itself and interrupts itself, cutting every reply short with `status: "interrupted"`. Native audio APIs (PortAudio, `sounddevice`) have none, so use headphones. Browsers and carriers handle it for you.
</Warning>

## Playing output audio

Write each [`reply.audio`](/docs/voice-agents/voice-agent-api/events-reference#reply-audio) chunk straight into an output buffer and let the OS drain it. The buffer absorbs network jitter, so late messages don't create gaps:

```python theme={null}
SAMPLE_RATE = 24000  # 8000 for audio/pcmu or audio/pcma

with sd.OutputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16") as speaker:
    if event["type"] == "reply.audio":
        pcm = np.frombuffer(base64.b64decode(event["data"]), dtype=np.int16)
        speaker.write(pcm)
```

<Warning>
  Don't schedule playback with `sleep`. Sleep durations aren't exact, so the playback clock drifts from the hardware clock and you get pops and gaps.

  ```python theme={null}
  # ❌ Don't do this
  while True:
      play(get_next_chunk())
      await asyncio.sleep(0.020)  # drift accumulates → audio artifacts
  ```
</Warning>

## Handling interruptions

On barge-in the server stops generating and emits [`reply.done`](/docs/voice-agents/voice-agent-api/events-reference#reply-done) with `status: "interrupted"`, plus [`transcript.agent`](/docs/voice-agents/voice-agent-api/events-reference#transcript-agent) with `interrupted: true` and the text trimmed to what was actually spoken.

Flush your queued audio so the user doesn't hear stale speech, then restart the stream:

```python theme={null}
if event["type"] == "reply.done" and event.get("status") == "interrupted":
    speaker.abort()  # discard buffered audio
    speaker.start()  # ready for the next reply
```

| Platform | Flush approach |
| - | - |
| **Python** (sounddevice) | `speaker.abort()` then `speaker.start()` |
| **Web** (AudioContext) | Disconnect the source node, create a new `AudioBufferSourceNode`, reconnect |
| **iOS** (AVAudioEngine) | `playerNode.stop()` then `playerNode.play()` |
| **Android** (AudioTrack) | `audioTrack.pause()`, `audioTrack.flush()`, then `audioTrack.play()` |

Barge-in is semantic: "uh-huh" won't interrupt, "wait, stop" will. See [Turn detection and interruptions](/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions).
