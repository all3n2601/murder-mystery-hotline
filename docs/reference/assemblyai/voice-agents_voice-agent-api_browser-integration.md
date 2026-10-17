> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Browser integration

> Connect browser-based apps to the Voice Agent API using a temporary token.

Connect a browser to your [stored agent](/docs/voice-agents/voice-agent-api/create-agent) in three steps:

1. Your server calls [`GET /v1/token`](/docs/api-reference/voice-agent-api/generate-voice-agent-token) with your API key to mint a short-lived temporary token.
2. Your browser opens the WebSocket with `?token=<token>`, no API key exposed.
3. The browser sends one `session.update` with your `agent_id`; the agent's stored prompt, voice, and tools load automatically.

Your API key never leaves your server. Each token is single-use, it starts exactly one session, and all usage is attributed to the key that generated it.

<Note>
  This page connects to a **stored agent** by `agent_id`, the recommended path. If you'd rather configure the agent inline per session instead of creating one, send `system_prompt` / `greeting` / `output` in the `session.update` and omit `agent_id`. The two are mutually exclusive. See [Inline configuration](/docs/voice-agents/voice-agent-api/session-configuration).
</Note>

<Tip>
  Browsers provide built-in acoustic echo cancellation through `getUserMedia`, so browser-based clients work hands-free without headphones. If you're developing on a laptop, the browser integration is the recommended starting point.
</Tip>

## 1. Generate a token on your server

Call [`GET /v1/token`](/docs/api-reference/voice-agent-api/generate-voice-agent-token) with your API key in the `Authorization` header. Pick an `expires_in_seconds` short enough to limit replay risk (60–300s is a good default) and an optional `max_session_duration_seconds` to cap the session length.

<Note>
  These two parameters control different things and are easy to confuse:

  * **`expires_in_seconds`** is the *token redemption window*: how long the client has to use this token to open a WebSocket. If the window elapses before the WebSocket is opened, the server returns a [`session.error`](/docs/voice-agents/voice-agent-api/events-reference#session-error) with code `unauthorized` on the first frame instead of `session.ready`. Once a `session.ready` has been received, this value no longer applies.
  * **`max_session_duration_seconds`** is the *session duration cap*: how long the resulting voice agent session is allowed to run after the WebSocket is open.
</Note>

<EndpointCard title="Generate voice agent token" href="/docs/api-reference/voice-agent-api/generate-voice-agent-token" method="GET">
  View the endpoint reference.
</EndpointCard>

```javascript expandable theme={null}
// server/routes/voice-token.js
import express from "express";

const router = express.Router();

router.get("/voice-token", async (_req, res) => {
  const url = new URL("https://agents.assemblyai.com/v1/token");
  url.searchParams.set("expires_in_seconds", "300");
  url.searchParams.set("max_session_duration_seconds", "8640");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.ASSEMBLYAI_API_KEY}` },
  });

  if (!response.ok) {
    return res.status(response.status).send(await response.text());
  }

  const { token } = await response.json();
  res.json({ token });
});

export default router;
```

<Note>
  `expires_in_seconds` must be between 1 and 600. `max_session_duration_seconds` must be between 60 and 10800 (defaults to 10800, the 3-hour maximum session duration).
</Note>

Tokens are **single-use**: fetch a fresh one immediately before every connection, including reconnects via [`session.resume`](/docs/voice-agents/voice-agent-api/events-reference#session-resume). End sessions cleanly with [`session.end`](/docs/voice-agents/voice-agent-api/events-reference#session-end) so you don't pay for the 30-second resume grace window.

## 2. Connect from the browser with the token

Fetch the token from your server, open the WebSocket with `?token=<token>` (no `Authorization` header needed), and bind to your agent by `agent_id`:

```javascript expandable theme={null}
// browser/voice-agent.js
const AGENT_ID = "7ad24396-b822-4dca-871a-be9cc4781cf9"; // from POST /v1/agents

const { token } = await fetch("/api/voice-token").then((r) => r.json());

const wsUrl = new URL("wss://agents.assemblyai.com/v1/ws");
wsUrl.searchParams.set("token", token);
const ws = new WebSocket(wsUrl);

ws.addEventListener("open", () => {
  ws.send(
    JSON.stringify({
      type: "session.update",
      session: { agent_id: AGENT_ID },
    }),
  );
});

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  // Handle session.ready, reply.audio, transcript.*, tool.call, etc.
  console.log(message);
});
```

## 3. Browser client

### The full app

The [Python](https://github.com/AssemblyAI/voice-agent-starter-python) and [JavaScript](https://github.com/AssemblyAI/voice-agent-starter-js) starters ship a browser client with the token endpoint from step 1 already wired up, plus a live event log of every frame in both directions:

<CodeGroup>
  ```bash Python theme={null}
  python deployment/browser/server.py
  ```

  ```bash JavaScript theme={null}
  npm start
  ```
</CodeGroup>

It handles the parts that are easy to get wrong: capture and playback each run in their own `AudioContext` with a resampling worklet, so a browser that refuses to open a context at 24 kHz still sounds right. Start there if you want something working before you start cutting.

### The lite version

<Accordion title="One HTML file, no repo, no build step">
  A minimal client that captures microphone audio, streams it to the Voice Agent API, and plays back the agent's response. Two files: an HTML page and an AudioWorklet processor.

  <Note>
    AudioWorklet processors load from a URL, so this needs two files. Serve them locally with `npx serve .`.
  </Note>

  Create `pcm-processor.js` in the same directory as your HTML file:

  ```javascript theme={null}
  // pcm-processor.js - AudioWorklet that captures PCM16 from the mic
  class PCMProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0]?.[0];
      if (input) {
        // Convert Float32 [-1, 1] to Int16
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)));
        }
        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      }
      return true;
    }
  }

  registerProcessor("pcm-processor", PCMProcessor);
  ```

  Then create your HTML file:

  ```html expandable theme={null}
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Voice Agent</title>
  </head>
  <body>
    <button id="start">Start conversation</button>
    <pre id="log"></pre>
    <script>
      const log = (msg) => { document.getElementById("log").textContent += msg + "\n"; };

      // Your stored agent's ID, from POST /v1/agents
      const AGENT_ID = "7ad24396-b822-4dca-871a-be9cc4781cf9";

      document.getElementById("start").addEventListener("click", async () => {
        // 1. Get token from your server (see step 1 above)
        const { token } = await fetch("/api/voice-token").then((r) => r.json());

        // 2. Force AudioContext to 24 kHz - avoids manual resampling on both
        //    capture and playback. Chromium-only shortcut: Firefox honors the
        //    rate but routes the context around its echo canceller, and Safari
        //    ignores the option entirely (see Browser compatibility below).
        //    Production code should use the default rate and resample inside
        //    the worklet.
        const audioCtx = new AudioContext({ sampleRate: 24000 });
        await audioCtx.audioWorklet.addModule("pcm-processor.js");

        // 3. Capture mic audio with echo cancellation enabled
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, sampleRate: 24000 },
        });
        const source = audioCtx.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");

        // 4. Connect WebSocket
        const wsUrl = new URL("wss://agents.assemblyai.com/v1/ws");
        wsUrl.searchParams.set("token", token);
        const ws = new WebSocket(wsUrl);

        let ready = false;
        let playbackTime = audioCtx.currentTime;

        // Send mic audio to the server once the session is ready
        worklet.port.onmessage = (e) => {
          if (ready && ws.readyState === WebSocket.OPEN) {
            const b64 = btoa(String.fromCharCode(...new Uint8Array(e.data)));
            ws.send(JSON.stringify({ type: "input.audio", audio: b64 }));
          }
        };
        source.connect(worklet).connect(audioCtx.destination);

        ws.addEventListener("open", () => {
          ws.send(JSON.stringify({
            type: "session.update",
            session: { agent_id: AGENT_ID },
          }));
        });

        ws.addEventListener("message", (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === "session.ready") {
            ready = true;
            log("Session ready, start speaking");
          } else if (msg.type === "reply.audio") {
            // Decode base64 PCM16 and schedule playback
            const raw = atob(msg.data);
            const pcm16 = new Int16Array(raw.length / 2);
            for (let i = 0; i < pcm16.length; i++) {
              pcm16[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
            }
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
              float32[i] = pcm16[i] / 32768;
            }
            const buffer = audioCtx.createBuffer(1, float32.length, 24000);
            buffer.getChannelData(0).set(float32);
            const src = audioCtx.createBufferSource();
            src.buffer = buffer;
            src.connect(audioCtx.destination);
            const now = audioCtx.currentTime;
            playbackTime = Math.max(playbackTime, now);
            src.start(playbackTime);
            playbackTime += buffer.duration;
          } else if (msg.type === "reply.done" && msg.status === "interrupted") {
            // Reset playback schedule to avoid stale audio
            playbackTime = audioCtx.currentTime;
          } else if (msg.type === "transcript.user") {
            log("You: " + msg.text);
          } else if (msg.type === "transcript.agent") {
            log("Agent: " + msg.text);
          } else if (msg.type === "session.error" || msg.type === "error") {
            log("Error: " + msg.message);
          }
        });

        ws.addEventListener("close", () => log("Connection closed"));
      });
    </script>
  </body>
  </html>
  ```

  <Tip>
    The key line is `new AudioContext({ sampleRate: 24000 })`. Most browsers default to the device sample rate (usually 48 kHz), so without this you'd need to manually resample both mic input and playback output. Forcing 24 kHz on the context avoids this — but **only on Chromium**. Firefox honors the rate but bypasses its echo canceller for non-default-rate contexts, and Safari ignores the option and runs at the hardware rate. See [Browser compatibility](#5-browser-compatibility) for a pipeline that works on all three.
  </Tip>
</Accordion>

## 4. Audio capture and echo cancellation

Ask for the microphone with `echoCancellation` on and `noiseSuppression` off:

```javascript theme={null}
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: false },
});
```

**Echo cancellation on.** When the agent's speech plays through the speakers, the microphone picks it up and sends it back, and the agent interrupts itself. Every response gets cut short with `status: "interrupted"`. The browser's built-in acoustic echo cancellation removes speaker output from the mic signal, which is why a browser client needs no headphones.

**Noise suppression off.** The server already cleans up the input, and stacking a second denoising layer on top introduces artifacts that hurt transcription accuracy more than the original noise did. Same goes for RNNoise, Krisp, BVC, and similar. To tune how aggressively the server isolates the caller from background noise, use `input.voice_focus` instead, see [Isolate the caller's voice](/docs/voice-agents/voice-agent-api/noise-suppression).

## 5. Browser compatibility

The client above works as-is on Chromium-based browsers (Chrome, Edge, Brave, Arc). Firefox and Safari each have a quirk that the forced-24 kHz shortcut trips over: Firefox silently loses echo cancellation, and Safari silently produces garbled audio.

| Browser | `AudioContext({ sampleRate })` honored | Recommended pipeline |
| - | - | - |
| Chrome / Edge | Yes | Use the quickstart as-is. |
| Firefox | Yes, **but it breaks echo cancellation** | Let `AudioContext` use its default rate and resample to/from 24 kHz inside the worklet (capture) and before playback. |
| Safari (desktop, iOS) | **No**, runs at hardware rate (typically 48 kHz) | Let `AudioContext` use its default rate and resample to/from 24 kHz inside the worklet (capture) and before playback. |

### Firefox and Safari: resample inside the worklet

Firefox honors the `sampleRate` option, but a non-default-rate `AudioContext` runs in a separate audio graph, and only the default graph feeds Firefox's echo canceller. The agent's playback never reaches the canceller as a reference signal, so the mic re-captures it: the agent hears its own voice, transcribes it as user speech, and interrupts itself.

Safari ignores the `sampleRate` constructor option, so an `AudioContext({ sampleRate: 24000 })` will silently run at 48 kHz on most Macs. Sending those samples to the Voice Agent API as if they were 24 kHz produces audio that sounds chipmunked or garbled.

The fix is the same for both: let the context run at the device rate, detect the actual rate at runtime, send it into the worklet, and resample there:

```javascript theme={null}
// browser/voice-agent.js (Firefox- and Safari-safe context)
const audioCtx = new AudioContext(); // let the browser pick its default rate
await audioCtx.audioWorklet.addModule("pcm-processor.js");
const worklet = new AudioWorkletNode(audioCtx, "pcm-processor", {
  processorOptions: { inputSampleRate: audioCtx.sampleRate, targetSampleRate: 24000 },
});
```

```javascript theme={null}
// pcm-processor.js: linear resample to 24 kHz before posting PCM16
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { inputSampleRate, targetSampleRate } = options.processorOptions;
    this.ratio = inputSampleRate / targetSampleRate;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    const outLength = Math.floor(input.length / this.ratio);
    const pcm16 = new Int16Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const sample = input[Math.floor(i * this.ratio)] ?? 0;
      pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}
registerProcessor("pcm-processor", PCMProcessor);
```

For playback, `createBuffer(1, length, 24000)` works on all current browsers, since the context resamples on output. Linear interpolation is good enough for speech.

### Cross-browser checklist

* **User gesture required.** All major browsers gate `getUserMedia` and `AudioContext` startup behind a user gesture (Safari is strictest). Start audio inside a `click` or `touchstart` handler and call `await audioCtx.resume()` before connecting nodes.
* **HTTPS or `localhost`.** `getUserMedia` only works on secure origins.
* **Echo cancellation.** Pass `echoCancellation: true` to `getUserMedia` so the agent's TTS playing through the speakers doesn't get re-captured by the mic.
* **Audio output sink.** On iOS Safari, set the [`<audio playsinline>`](https://developer.mozilla.org/docs/Web/HTML/Element/video#playsinline) attribute or route through an `AudioContext` destination. Autoplay and full-screen behavior differ from desktop.

## 6. Ending the session cleanly

<Warning>
  Do not just close the WebSocket. Send [`session.end`](/docs/voice-agents/voice-agent-api/events-reference#session-end) first, then close. A bare `ws.close()` (or the browser tearing the socket down on navigation) leaves the session in the 30-second [`session.resume`](/docs/voice-agents/voice-agent-api/events-reference#session-resume) grace window, and that window is billable.
</Warning>

Wire `session.end` to your explicit end-call control, wait for [`session.ended`](/docs/voice-agents/voice-agent-api/events-reference#session-ended), and clean up there:

```js theme={null}
function endCall() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "session.end" }));
    // Server emits session.ended, then closes the socket. Clean up on that event.
  } else {
    cleanup();
  }
}

function cleanup() {
  ws?.close();
  stream?.getTracks().forEach((t) => t.stop());
  audioCtx?.close();
  log("Call ended");
}

// Inside your existing message handler:
//   else if (msg.type === "session.ended") cleanup();
```

Cover tab close and navigation too. `pagehide` fires on both and is more reliable than `beforeunload` on mobile Safari:

```js theme={null}
window.addEventListener("pagehide", () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "session.end" }));
  }
});
```

<Note>
  Send `session.end` synchronously inside the `pagehide` handler. Anything async (like `await fetch`) will not finish before the socket is torn down.
</Note>

Server clients follow the same pattern on their shutdown signal (`SIGINT`, `SIGTERM`, or your own hangup handler). See [Unexpected billing after the call ended](/docs/voice-agents/voice-agent-api/troubleshooting#unexpected-billing-after-the-call-ended) if your sessions look about 30 seconds longer than the call itself.
