> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Troubleshooting

> Common issues and fixes when building with the Voice Agent API.

## Before you contact support

Persist the [`session_id`](/docs/voice-agents/voice-agent-api/events-reference#session-ready) from `session.ready` for every session, not just when something goes wrong. If you contact [support@assemblyai.com](mailto:support@assemblyai.com) about a specific session (audio glitches, unexpected interruptions, tool-call issues, session-resume failures), this ID lets us locate it in our logs immediately.

Log at minimum:

* `session_id` from `session.ready`
* WebSocket close code and reason on disconnect
* Timestamp at session start
* Whether you connected to the US (`agents.assemblyai.com`) or EU endpoint

## Agent interrupts itself (echo / feedback loop)

**Symptom:** Every agent response ends with `(interrupted)` after about one second. The transcript shows the agent's own words echoed back as user speech.

**Cause:** The agent's TTS audio plays through speakers and loops back into the microphone. Terminal apps (Python with `sounddevice`) don't get OS-level acoustic echo cancellation (AEC).

**Fixes:**

* **Use headphones**: the simplest fix.
* **Switch to the browser**: browsers provide AEC automatically through `getUserMedia({ audio: { echoCancellation: true } })`. See [Browser integration](/docs/voice-agents/voice-agent-api/browser-integration).
* **Already in the browser, on Firefox?** An `AudioContext` forced to 24 kHz runs outside the audio graph that feeds Firefox's echo canceller, so AEC silently stops working. Let the context run at the device rate and resample inside the worklet. See [Browser compatibility](/docs/voice-agents/voice-agent-api/browser-integration#firefox-and-safari-resample-inside-the-worklet).

***

## Wrong sample rate

**Symptom:** Audio sounds garbled, pitched up/down, or plays at the wrong speed.

**Cause:** The Voice Agent API expects PCM16 mono at exactly **24,000 Hz**. If your mic captures at 48 kHz or your playback device runs at a different rate, the audio will be misinterpreted.

**Fixes:**

* **Python:** Set `samplerate=24000` on both `sd.InputStream` and `sd.OutputStream`.
* **Chrome / Edge:** Create the AudioContext with `new AudioContext({ sampleRate: 24000 })`. This avoids manual resampling entirely. See the [Browser quickstart](/docs/voice-agents/voice-agent-api/browser-integration#3-browser-client).
* **Firefox:** Don't force the context to 24 kHz. Firefox honors the rate but runs the context outside the audio graph that feeds its echo canceller, so the agent hears and transcribes its own voice. Let the context run at the device rate and resample to/from 24 kHz inside the worklet. See [Browser compatibility](/docs/voice-agents/voice-agent-api/browser-integration#firefox-and-safari-resample-inside-the-worklet) for a working pattern.
* **Safari (desktop and iOS):** Safari ignores the `sampleRate` constructor option and runs the `AudioContext` at the hardware rate (typically 48 kHz). The quickstart will silently produce garbled audio. Let Safari use its default rate and resample to/from 24 kHz inside the worklet. See [Browser compatibility](/docs/voice-agents/voice-agent-api/browser-integration#firefox-and-safari-resample-inside-the-worklet) for a working pattern.
* If you can't control the device sample rate, resample to/from 24 kHz before encoding/decoding.

***

## Microphone permission denied

**Symptom:** `NotAllowedError` in the browser or `PortAudioError` in Python.

**Fixes:**

* **Browser:** The page must be served over HTTPS (or `localhost`). Check that the user granted microphone permission in the browser prompt.
* **macOS:** Go to System Settings → Privacy & Security → Microphone and enable access for your terminal app or browser.
* **Linux:** Check that your user has access to the audio device (`ls -la /dev/snd/`). You may need to add your user to the `audio` group.

***

## Firewall blocking WebSocket connection

**Symptom:** WebSocket connection hangs or fails with a timeout.

**Cause:** Corporate firewalls or proxies may block outbound WSS (WebSocket Secure) connections on port 443.

**Fixes:**

* Verify that `wss://agents.assemblyai.com` is reachable from your network.
* If behind a corporate proxy, configure your WebSocket client to use the proxy.
* Test from a different network to rule out firewall issues.

***

## Malformed base64 in `input.audio`

**Symptom:** `session.error` with code `invalid_audio`.

**Cause:** The `audio` field in `input.audio` failed base64 decode or PCM conversion. Common mistakes include sending raw binary instead of base64, or encoding audio in the wrong format (e.g., WAV headers included, float32 instead of int16).

**Fixes:**

* Verify you're encoding raw PCM16 bytes, not a WAV or other container format.
* Check that the data is base64-encoded: `base64.b64encode(pcm_bytes).decode()` in Python, or `btoa(String.fromCharCode(...new Uint8Array(buffer)))` in JavaScript.
* Confirm the audio is 16-bit signed integer (little-endian), mono, at 24 kHz.

<Note>
  If the message itself is malformed (bad JSON, missing `type`, or missing `audio` field), you'll get `invalid_format` instead. See the [error codes reference](/docs/voice-agents/voice-agent-api/events-reference#session-error) for the full list.
</Note>

***

## Token expired or invalid credentials

**Symptom:** WebSocket closes immediately with close code `1008` and an `UNAUTHORIZED` error, or with code `1006` in browsers (no body visible). No `session.ready` event is received.

**Cause:** The token or API key is missing, expired, or invalid. The server sends `UNAUTHORIZED` (close code 1008) before the session is established.

**Fixes:**

* Fetch a fresh token immediately before each connection attempt. Don't pre-fetch and store them.
* Keep `expires_in_seconds` at 60–300 seconds for a good balance between security and usability.
* If using [`session.resume`](/docs/voice-agents/voice-agent-api/events-reference#session-resume), remember that each new WebSocket connection needs a new token.

See [Token expiry and failure modes](/docs/voice-agents/voice-agent-api/browser-integration#token-expiry-and-failure-modes) for more detail.

***

## Unexpected billing after the call ended

**Symptom:** Sessions appear to be billed for \~30 seconds longer than the user was actually on the call.

**Cause:** When the client closes the WebSocket without sending [`session.end`](/docs/voice-agents/voice-agent-api/events-reference#session-end), the server holds the session open for 30 seconds so you can reconnect with [`session.resume`](/docs/voice-agents/voice-agent-api/events-reference#session-resume). That grace window is billable.

**Fix:** Send `session.end` before closing the socket on any intentional disconnect (user hung up, "End call" button, page unload). Skip it only when the disconnect is unintentional and you want the option to resume within 30 seconds.

```js theme={null}
ws.send(JSON.stringify({ type: "session.end" }));
// Server emits session.ended and closes the WebSocket.
```

See [Ending the session cleanly](/docs/voice-agents/voice-agent-api/browser-integration#6-ending-the-session-cleanly).

***

## Session resume fails

**Symptom:** `session.error` with code `session_not_found`, `session_forbidden`, or `session_expired` after sending `session.resume`.

**Causes:**

* `session_not_found`: the `session_id` is unknown or the 30-second grace window after disconnection has expired.
* `session_forbidden`: the `session_id` belongs to a different account.
* `session_expired`: the session's TTL elapsed during the grace window.

**Fix:** Catch these error codes and start a fresh session without `session.resume`. See the [session.resume example](/docs/voice-agents/voice-agent-api/events-reference#session-resume).
