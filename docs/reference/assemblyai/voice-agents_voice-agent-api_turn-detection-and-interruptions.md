> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Turn detection and interruptions

> How the Voice Agent API decides when the user has finished speaking and when they're interrupting. On by default, no tuning required.

Turn detection and barge-in are on by default and based on what the user actually said, not just silence or volume. There's nothing to wire up.

<Note>
  **Leave it on default.** With no `turn_detection` config, the agent adapts to each speaker's pace and automatically slows down to capture values your tools need, like a phone number or email. The way to make turn-taking better is **good tool descriptions**, not VAD knobs. Tune the raw thresholds only as a last resort.
</Note>

## What you get by default

* **Semantic end-of-turn.** The agent decides you're done from the meaning of what you said, so it won't cut you off mid-thought or sit on a long pause once you've clearly finished.
* **Smart waiting for tool values.** When a tool parameter expects a phone number, email, date, or other entity, the agent waits for the whole value before ending your turn, instead of jumping in after the first pause.
* **Adaptive pacing.** If a speaker pauses a lot, the agent gives them more room; if they're crisp, it replies faster. This gets better over the call.
* **Semantic barge-in.** Back-channels like "uh-huh" or "makes sense" don't interrupt; "wait, stop" does.

A normal user turn emits [`input.speech.started`](/docs/voice-agents/voice-agent-api/events-reference#input-speech-started) → [`transcript.user.delta`](/docs/voice-agents/voice-agent-api/events-reference#transcript-user-delta) (partials) → [`input.speech.stopped`](/docs/voice-agents/voice-agent-api/events-reference#input-speech-stopped) → [`transcript.user`](/docs/voice-agents/voice-agent-api/events-reference#transcript-user) (final) → [`reply.started`](/docs/voice-agents/voice-agent-api/events-reference#reply-started). You never signal end-of-turn yourself.

## Get better turn-taking with tool descriptions

The agent waits for a complete value when it knows one is coming. It learns that from your tool's parameters, so describe the important ones well. No turn-detection config involved; just add the tool when you create the agent:

<CodeGroup>
  ```bash cURL expandable theme={null}
  curl -X POST https://agents.assemblyai.com/v1/agents \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Account Assistant",
      "system_prompt": "You verify callers. Ask for their phone number, then call verify_account.",
      "voice": { "voice_id": "alba" },
      "tools": [
        {
          "name": "verify_account",
          "description": "Look up a customer by phone number.",
          "parameters": {
            "type": "object",
            "properties": {
              "phone": {
                "type": "string",
                "description": "The caller'\''s phone number, including country code.",
                "examples": ["+14155552671"]
              }
            },
            "required": ["phone"]
          }
        }
      ]
    }'
  ```

  ```python Python expandable theme={null}
  # pip install requests
  import os
  import requests

  resp = requests.post(
      "https://agents.assemblyai.com/v1/agents",
      headers={"Authorization": os.environ["ASSEMBLYAI_API_KEY"]},
      json={
          "name": "Account Assistant",
          "system_prompt": "You verify callers. Ask for their phone number, then call verify_account.",
          "voice": {"voice_id": "alba"},
          "tools": [
              {
                  "name": "verify_account",
                  "description": "Look up a customer by phone number.",
                  "parameters": {
                      "type": "object",
                      "properties": {
                          "phone": {
                              "type": "string",
                              "description": "The caller's phone number, including country code.",
                              "examples": ["+14155552671"],
                          }
                      },
                      "required": ["phone"],
                  },
              }
          ],
      },
  )
  resp.raise_for_status()
  print(resp.json())
  ```

  ```javascript Node.js expandable theme={null}
  // Node 18+ has fetch built in
  const res = await fetch("https://agents.assemblyai.com/v1/agents", {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Account Assistant",
      system_prompt: "You verify callers. Ask for their phone number, then call verify_account.",
      voice: { voice_id: "alba" },
      tools: [
        {
          name: "verify_account",
          description: "Look up a customer by phone number.",
          parameters: {
            type: "object",
            properties: {
              phone: {
                type: "string",
                description: "The caller's phone number, including country code.",
                examples: ["+14155552671"],
              },
            },
            required: ["phone"],
          },
        },
      ],
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

With this, when the agent asks for the phone number it waits for all the digits instead of cutting in after "my number is four one five…". A clear `description` (plus optional `examples` or `pattern`) is what drives it. See [parameter hints](/docs/voice-agents/voice-agent-api/tools/overview#parameter-hints-improve-accuracy).

## Interruptions

When the user truly interrupts, the server emits:

* [`reply.done`](/docs/voice-agents/voice-agent-api/events-reference#reply-done) with `status: "interrupted"`
* [`transcript.agent`](/docs/voice-agents/voice-agent-api/events-reference#transcript-agent) with `interrupted: true` and `text` trimmed to what the user actually heard.

On that signal, stop and clear your queued audio so the user doesn't keep hearing stale speech:

```javascript theme={null}
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (m.type === "input.speech.started") flushPlayback();   // snappiest barge-in
  if (m.type === "reply.done" && m.status === "interrupted") flushPlayback();
};
```

See [Handling interruptions](/docs/voice-agents/voice-agent-api/audio-format#handling-interruptions) for the full audio-flush pattern.

## Transcription mode

Turn detection sits on top of the transcript, and the transcript comes from a speech-to-text model whose speed-versus-accuracy balance you set with `input.transcription_mode`. The mode also presets how long the model waits in silence before ending a turn, so it is the cleanest single knob for that tradeoff. Reach for it before the raw thresholds below.

| Mode | Behavior |
| - | - |
| `min_latency` | Ends turns fastest and is least patient in silence. |
| `balanced` | Default. A middle ground. |
| `max_accuracy` | Most accurate transcript; waits longest to confirm the end of a turn. |

Set it on the stored agent when you create it:

<CodeGroup>
  ```bash cURL {8} theme={null}
  curl -X POST https://agents.assemblyai.com/v1/agents \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Support Assistant",
      "system_prompt": "You are a friendly support agent.",
      "voice": { "voice_id": "alba" },
      "input": { "transcription_mode": "max_accuracy" }
    }'
  ```

  ```python Python {12} theme={null}
  # pip install requests
  import os
  import requests

  resp = requests.post(
      "https://agents.assemblyai.com/v1/agents",
      headers={"Authorization": os.environ["ASSEMBLYAI_API_KEY"]},
      json={
          "name": "Support Assistant",
          "system_prompt": "You are a friendly support agent.",
          "voice": {"voice_id": "alba"},
          "input": {"transcription_mode": "max_accuracy"},
      },
  )
  resp.raise_for_status()
  print(resp.json())
  ```

  ```javascript Node.js {12} theme={null}
  // Node 18+ has fetch built in
  const res = await fetch("https://agents.assemblyai.com/v1/agents", {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Support Assistant",
      system_prompt: "You are a friendly support agent.",
      voice: { voice_id: "alba" },
      input: { transcription_mode: "max_accuracy" },
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

`transcription_mode` is updatable mid-session, so switch it by call stage: run `balanced` or `min_latency` for normal back-and-forth, switch to `max_accuracy` while capturing something you can't get wrong (an order ID, account number, or a name being spelled out), then switch back.

```json theme={null}
// Entering an entity-capture step
{ "type": "session.update", "session": { "input": { "transcription_mode": "max_accuracy" } } }

// Value captured
{ "type": "session.update", "session": { "input": { "transcription_mode": "min_latency" } } }
```

## Override the defaults (rarely needed)

If you must tune sensitivity, set the VAD knobs in `input.turn_detection`. All fields are optional; send only what you change. Set them on the stored agent when you create it:

<CodeGroup>
  ```bash cURL theme={null}
  curl -X POST https://agents.assemblyai.com/v1/agents \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Support Assistant",
      "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
      "voice": { "voice_id": "alba" },
      "input": {
        "turn_detection": {
          "vad_threshold": 0.5,
          "min_silence": 1000,
          "max_silence": 3000,
          "interrupt_response": true
        }
      }
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
          "name": "Support Assistant",
          "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
          "voice": {"voice_id": "alba"},
          "input": {
              "turn_detection": {
                  "vad_threshold": 0.5,
                  "min_silence": 1000,
                  "max_silence": 3000,
                  "interrupt_response": True,
              }
          },
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
      name: "Support Assistant",
      system_prompt: "You are a friendly support agent. Keep replies under two sentences.",
      voice: { voice_id: "alba" },
      input: {
        turn_detection: {
          vad_threshold: 0.5,
          min_silence: 1000,
          max_silence: 3000,
          interrupt_response: true,
        },
      },
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

Configuring inline over the WebSocket instead? Set the same [`turn_detection`](/docs/voice-agents/voice-agent-api/session-configuration#turn-detection) object under `session.input` in a `session.update`:

```json theme={null}
{
  "type": "session.update",
  "session": {
    "input": {
      "turn_detection": {
        "vad_threshold": 0.5,
        "min_silence": 1000,
        "max_silence": 3000,
        "interrupt_response": true
      }
    }
  }
}
```

| Field | Default | Description |
| - | - | - |
| `vad_threshold` | `0.5` | Speech detection sensitivity (`0.0` to `1.0`). Lower is more sensitive. |
| `min_silence` | adaptive | Minimum silence for a confident end-of-turn, in ms. Left unset, the agent paces this adaptively. |
| `max_silence` | adaptive | Maximum silence before forcing end-of-turn, in ms. Left unset, the agent paces this adaptively. |
| `interrupt_response` | `true` | Set `false` to disable barge-in entirely. |
| `interruption_delay` | per mode | How long after the user starts speaking, in ms (`0` to `1000`), before a barge-in can interrupt the agent. Follows the [transcription mode](#transcription-mode) (`0` for `min_latency`, `500` for `balanced` and `max_accuracy`). Raise it so brief back-channels like "mm-hmm" don't cut the agent off. |

<Warning>
  Setting `min_silence` or `max_silence` turns off the adaptive pacing and entity-aware waiting described above for the rest of the session. Prefer leaving them unset.
</Warning>

<Note>
  If the agent keeps interrupting itself, the mic is picking up its own TTS. Use headphones or a [browser-based client](/docs/voice-agents/voice-agent-api/browser-integration) (which has echo cancellation). See [Troubleshooting](/docs/voice-agents/voice-agent-api/troubleshooting#agent-interrupts-itself-echo--feedback-loop).
</Note>
