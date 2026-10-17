> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Events reference

> Every client-to-server and server-to-client event for the Voice Agent API.

Every message exchanged over the Voice Agent API WebSocket, grouped by direction. You'll send [`session.update`](#session-update) to configure, [`input.audio`](#input-audio) to stream mic audio, [`tool.result`](#tool-result) to respond to tool calls, and [`session.end`](#session-end) to cleanly end the call. The server streams everything else back, including [`session.ended`](#session-ended) on every clean teardown.

## Event flow

A typical voice agent session moves through the events in this order:

```
Client                              Server
  │                                   │
  │── WebSocket connect ─────────────►│
  │── session.update ────────────────►│  (system prompt + tools + greeting)
  │                                   │
  │◄─── session.ready ────────────────│  (save session_id)
  │                                   │
  │── input.audio (stream) ──────────►│  (only after session.ready)
  │── input.audio (stream) ──────────►│
  │                                   │
  │◄─── input.speech.started ─────────│
  │◄─── transcript.user.delta ────────│
  │◄─── input.speech.stopped ─────────│
  │◄─── transcript.user ──────────────│
  │                                   │
  │◄─── reply.started ────────────────│
  │◄─── reply.audio ──────────────────│
  │◄─── transcript.agent.delta ───────│
  │◄─── transcript.agent ─────────────│
  │◄─── reply.done ───────────────────│
  │                                   │
  │  [tool call flow]                 │
  │◄─── tool.call ────────────────────│  (arguments is a dict)
  │◄─── reply.done ───────────────────│  ← send tool.result here
  │── tool.result ───────────────────►│
  │◄─── reply.started ────────────────│
  │◄─── reply.audio ──────────────────│
  │◄─── reply.done ───────────────────│
  │                                   │
  │  [clean teardown]                 │
  │── session.end ───────────────────►│
  │◄─── session.ended ────────────────│
  │◄── WebSocket close ───────────────│
```

## Client → Server

### `input.audio`

Stream PCM16 audio to the agent.

```json theme={null}
{
  "type": "input.audio",
  "audio": "<base64-encoded PCM16>"
}
```

| Field | Type | Description |
| - | - | - |
| `audio` | string | Base64-encoded PCM16 mono 24kHz audio |

See [Audio format](/docs/voice-agents/voice-agent-api/audio-format) for the full format specification.

***

### `session.update`

Configure the session. Send immediately on WebSocket connect (before `session.ready`). Can also be sent mid-conversation to update most fields. See [Mutability after `session.ready`](/docs/voice-agents/voice-agent-api/session-configuration#mutability-after-session-ready) for which fields can change once the session is established.

```json expandable theme={null}
{
  "type": "session.update",
  "session": {
    "system_prompt": "You are a concise assistant.",
    "greeting": "Hi! How can I help?",
    "input": {
      "format": { "encoding": "audio/pcm" },
      "turn_detection": { "vad_threshold": 0.5 }
    },
    "output": {
      "voice": "alba",
      "format": { "encoding": "audio/pcm" },
      "volume": 100
    },
    "tools": [
      {
        "type": "function",
        "name": "get_weather",
        "description": "Get weather for a city",
        "parameters": {
          "type": "object",
          "properties": { "city": { "type": "string" } },
          "required": ["city"]
        }
      }
    ]
  }
}
```

All fields are optional. Include only what you want to set or change. After `session.ready`, only a subset of fields can be changed; changing `greeting`, `session.output.voice`, or `session.output.format` raises `immutable_field`. `session.output.volume` is mutable mid-session. For the full field reference, defaults, and per-field mutability, see [Inline session configuration](/docs/voice-agents/voice-agent-api/session-configuration).

| Field | Type | Description |
| - | - | - |
| `session.agent_id` | string | Bind a [stored agent](/docs/voice-agents/voice-agent-api/deploy) by ID. First `session.update` only, and mutually exclusive with the inline fields below. |
| `session.system_prompt` | string | Sets the agent's personality and context. Mutable mid-session. |
| `session.greeting` | string | Spoken aloud at the start of the conversation. Immutable after the first update. |
| `session.input.format` | object | Input audio format (`encoding`). See [Audio format](/docs/voice-agents/voice-agent-api/audio-format) |
| `session.input.keyterms` | array | Up to 100 strings to boost in transcription. Mutable. See [Key terms](/docs/voice-agents/voice-agent-api/transcription-prompt#key-terms) |
| `session.input.turn_detection` | object | VAD threshold, silence windows, barge-in, and interruption delay. Mutable. See [Turn detection](/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions) |
| `session.input.transcription_mode` | string | Speech-to-text speed vs. accuracy: `min_latency`, `balanced` (default), or `max_accuracy`. Mutable. |
| `session.input.transcription_prompt` | string | Prompt that biases transcription (max 1750 chars). Mutable. |
| `session.input.language_codes` | array | Declare the spoken language(s); omit for automatic detection. Applied on the next STT connect. |
| `session.input.voice_focus` | string | Noise-suppression model: `near-field` (default) or `far-field`. Set at connect. |
| `session.input.voice_focus_threshold` | number | Noise-suppression strength, `0.0` to `1.0` (default `0.85`); requires `voice_focus`. Set at connect. |
| `session.output.voice` | string | The voice used for the agent's speech. Immutable after the first update. See [Voices](/docs/voice-agents/voice-agent-api/voices) |
| `session.output.format` | object | Output audio format (`encoding`). Immutable after the first update. See [Audio format](/docs/voice-agents/voice-agent-api/audio-format) |
| `session.output.volume` | number | Playback volume, `0` (silent) to `100` (loudest). Mutable mid-session. See [Output volume](/docs/voice-agents/voice-agent-api/volume) |
| `session.tools` | array | Tool definitions. See [Tool calling](/docs/voice-agents/voice-agent-api/tools/overview) |

***

### `session.resume`

Reconnect to an existing session using the `session_id` from a previous `session.ready`. Preserves conversation context across dropped connections.

```json theme={null}
{
  "type": "session.resume",
  "session_id": "sess_abc123"
}
```

<Note>
  Sessions are preserved for 30 seconds after every disconnection before expiring. If the session has expired, the server returns a `session.error` with code `session_not_found` or `session_forbidden`. Start a fresh connection without `session.resume`.
</Note>

**Example.** Capture `session_id` from `session.ready` on the first connection, then send `session.resume` as the first message when reconnecting:

```python expandable theme={null}
import json
import websockets

session_id: str | None = None

async def connect():
    global session_id
    async with websockets.connect(URL, additional_headers={"Authorization": f"Bearer {API_KEY}"}) as ws:
        # If we already have a session_id from a previous connection, resume it.
        if session_id:
            await ws.send(json.dumps({"type": "session.resume", "session_id": session_id}))
        else:
            await ws.send(json.dumps({"type": "session.update", "session": {...}}))

        async for raw in ws:
            event = json.loads(raw)
            if event["type"] == "session.ready":
                session_id = event["session_id"]  # save for next reconnect
            elif event["type"] == "session.error" and event["code"] in ("session_not_found", "session_forbidden"):
                session_id = None  # session expired - start fresh next time
            # ... handle other events

# On disconnect, call connect() again within 30 seconds to resume.
```

***

### `session.end`

End the session cleanly. Send this when the call is over and you don't intend to reconnect. The server emits a final [`session.ended`](#session-ended) and closes the WebSocket; the `session_id` is dead immediately and cannot be resumed.

```json theme={null}
{ "type": "session.end" }
```

No other fields.

**What happens next:**

1. The server emits [`session.ended`](#session-ended).
2. The server closes the WebSocket.
3. The `session_id` is dead. Sending [`session.resume`](#session-resume) with it returns `session_not_found`.

**When to send it vs. just closing the socket.** If you just close the WebSocket, the server holds the session for 30 seconds so you can [`session.resume`](#session-resume) from a new connection, and that 30-second window is billable. `session.end` short-circuits the grace window and stops billing immediately.

| What you do | Server behavior | Resumable? | Billing |
| - | - | - | - |
| Send `session.end`, then close | Closes immediately, emits `session.ended` | No | Stops immediately |
| Just close the WebSocket | Holds the session for 30s for `session.resume` | Yes, within 30s | Continues during the 30s window |

***

### `tool.result`

Send a tool result back to the agent. Send this when `reply.done` is the latest event you've received (and nothing has happened since). The simplest pattern is to accumulate on `tool.call` and drain inside the `reply.done` handler. See [Client-side tools](/docs/voice-agents/voice-agent-api/tools/client-side-tools#returning-tool-results).

```json theme={null}
{
  "type": "tool.result",
  "call_id": "call_abc123",
  "result": "{\"temp_c\": 22, \"description\": \"Sunny\"}",
  "is_error": false
}
```

| Field | Type | Description |
| - | - | - |
| `call_id` | string | The `call_id` from the `tool.call` event |
| `result` | string | JSON string containing the tool result |
| `is_error` | boolean | Optional, default `false`. Set `true` to signal the tool call failed so the agent can respond accordingly. |

***

### `reply.create`

Ask the agent to generate a reply right now, optionally with custom `instructions`. Useful for delivering status updates during long-running [`hold`-mode tool calls](/docs/voice-agents/voice-agent-api/tools/overview#execution-modes), or any time you want the agent to speak without a user utterance triggering it.

```json theme={null}
{
  "type": "reply.create",
  "instructions": "Let the customer know we're still processing the transfer."
}
```

| Field | Type | Description |
| - | - | - |
| `instructions` | string | Optional. One-shot instruction the agent uses to compose this reply. Does not modify `system_prompt`. |

The agent generates a normal reply (`reply.started` → `reply.audio` → `transcript.agent` → `reply.done`) using the provided instructions on top of the existing system prompt and conversation history.

***

### `conversation.message`

Inject a message into the conversation context without the user speaking it. Useful for seeding context or replaying prior history. This does not by itself make the agent reply; send [`reply.create`](#replycreate) if you want an immediate response.

```json theme={null}
{
  "type": "conversation.message",
  "role": "user",
  "content": "I'd like to check my order status."
}
```

| Field | Type | Description |
| - | - | - |
| `role` | string | `"user"` or `"system"`. |
| `content` | string | The message text to add to the conversation. |

***

## Server → Client

### `session.ready`

Session is established and ready to receive audio. Save `session_id` for reconnection. Start sending `input.audio` only after this event. The event echoes the full resolved `config` (defaults filled in, and for a stored agent the expanded configuration).

```json theme={null}
{
  "type": "session.ready",
  "session_id": "sess_abc123",
  "expires_at": 1717180000,
  "resume_token": "...",
  "config": { "system_prompt": "...", "output": { "voice": "alba" }, "...": "..." }
}
```

| Field | Type | Description |
| - | - | - |
| `session_id` | string | Always present. Save this value to reconnect with `session.resume`. |
| `config` | object | The full resolved session configuration the server applied. |
| `expires_at` | integer | Unix epoch seconds when the session reaches its maximum duration. |
| `resume_token` | string | Token used to resume the session after a drop. May be empty. |

***

### `session.updated`

Sent after `session.update` is applied successfully. Echoes the full resolved configuration after the update.

```json theme={null}
{
  "type": "session.updated",
  "config": { "system_prompt": "...", "output": { "voice": "alba" }, "...": "..." }
}
```

| Field | Type | Description |
| - | - | - |
| `config` | object | The full resolved session configuration after the update. |

***

### `session.ended`

Final event emitted on every clean teardown, right before the server closes the WebSocket. Always handle it.

```json theme={null}
{
  "type": "session.ended",
  "session_duration_seconds": 42.7,
  "audio_duration_seconds": 38.2,
  "timestamp": 1717180000.123
}
```

| Field | Type | Description |
| - | - | - |
| `session_duration_seconds` | number | Total wall-clock duration of the session. |
| `audio_duration_seconds` | number \| null | Total audio you streamed in. `null` if you streamed none. |
| `timestamp` | number | Unix epoch seconds when the server emitted the event. |

**When you'll see it:**

* You sent [`session.end`](#session-end).
* The session hit `max_session_duration_seconds`.
* The server hit an unrecoverable error.
* You disconnected and the 30-second grace window expired.

**How to use it:**

* **Got `session.ended` before the WebSocket closed**: clean server-initiated close. Done. Don't try to resume.
* **WebSocket closed without `session.ended`**: probably a network drop. If you want to keep going, reconnect and call [`session.resume`](#session-resume) with your saved `session_id` within 30 seconds.

***

### `input.speech.started`

Turn detection determined the user has started speaking.

```json theme={null}
{ "type": "input.speech.started" }
```

***

### `input.speech.stopped`

Turn detection determined the user has stopped speaking.

```json theme={null}
{ "type": "input.speech.stopped" }
```

***

### `transcript.user.delta`

Partial transcript of what the user is saying, updating in real-time.

```json theme={null}
{
  "type": "transcript.user.delta",
  "item_id": "item_abc123",
  "text": "What's the weather in"
}
```

| Field | Type | Description |
| - | - | - |
| `item_id` | string | Conversation item this partial belongs to. |
| `text` | string | The full transcript so far for this `item_id`. |

<Note>
  `text` is the **full transcript so far**, not an incremental chunk. Each delta supersedes the previous one for that `item_id`; render the latest and do not concatenate. Live user transcripts also pause while a [`hold`-mode tool](/docs/voice-agents/voice-agent-api/tools/overview#execution-modes) is in flight and resume once the hold ends; anything said during the hold is preserved in the conversation context.
</Note>

***

### `transcript.user`

Final transcript of the user's utterance.

```json theme={null}
{
  "type": "transcript.user",
  "text": "What's the weather in Tokyo?",
  "item_id": "item_abc123"
}
```

***

### `reply.started`

Agent has begun generating a response.

```json theme={null}
{
  "type": "reply.started",
  "reply_id": "reply_abc123",
  "item_id": "item_abc123"
}
```

| Field | Type | Description |
| - | - | - |
| `reply_id` | string | ID of this reply. For a tool-call reply it is `fc-<call_id>`. |
| `item_id` | string | Conversation item ID for this reply. |

***

### `reply.audio`

A chunk of the agent's spoken response as base64 PCM16. Decode and play immediately.

```json theme={null}
{
  "type": "reply.audio",
  "data": "<base64-encoded PCM16>"
}
```

See [Audio format](/docs/voice-agents/voice-agent-api/audio-format#playing-output-audio) for playback guidance.

***

### `transcript.agent.delta`

Word-level streaming of the agent's response, aligned to the audio as it plays. Useful for live captioning in sync with playback. The final [`transcript.agent`](#transcriptagent) still follows once the whole reply has been delivered.

```json theme={null}
{
  "type": "transcript.agent.delta",
  "reply_id": "reply_abc123",
  "item_id": "item_abc123",
  "delta": "sunny",
  "start_ms": 1200,
  "end_ms": 1560
}
```

| Field | Type | Description |
| - | - | - |
| `reply_id` | string | ID of the reply this word belongs to. |
| `item_id` | string | Conversation item ID. |
| `delta` | string | The next word (or token) of the agent's speech. |
| `start_ms` | integer \| null | Start time of the word within the reply audio, in ms. `null` if unavailable. |
| `end_ms` | integer \| null | End time of the word within the reply audio, in ms. `null` if unavailable. |

***

### `transcript.agent`

Full text of the agent's response, sent after all audio for the response has been delivered. If the agent was interrupted, `interrupted` is `true` and `text` contains only what was actually spoken before the interruption.

```json theme={null}
{
  "type": "transcript.agent",
  "text": "It's currently 22°C and sunny in Tokyo.",
  "reply_id": "reply_abc123",
  "item_id": "item_abc123",
  "interrupted": false
}
```

| Field | Type | Description |
| - | - | - |
| `text` | string | What the agent said (trimmed to interruption point if interrupted) |
| `reply_id` | string | ID of the reply |
| `item_id` | string | Conversation item ID |
| `interrupted` | boolean | `true` if the user interrupted mid-response |

***

### `reply.done`

Agent has finished the reply. Always carries `reply_id` and a `status`.

```json theme={null}
{
  "type": "reply.done",
  "reply_id": "reply_abc123",
  "status": "completed"
}
```

| Field | Type | Description |
| - | - | - |
| `reply_id` | string | ID of the reply that finished. For a tool-call reply it is `fc-<call_id>`. |
| `status` | string | `"completed"` for a normal finish, or `"interrupted"` if the user barged in. Always present. |

***

### `tool.call`

Agent wants to call a registered tool. `arguments` is a dict, ready to use directly as-is.

```json theme={null}
{
  "type": "tool.call",
  "call_id": "call_abc123",
  "name": "get_weather",
  "arguments": { "location": "Tokyo" }
}
```

| Field | Type | Description |
| - | - | - |
| `call_id` | string | Include this in `tool.result` |
| `name` | string | Tool name to call |
| `arguments` | object | Arguments as a dict (use directly) |

See [Tool calling](/docs/voice-agents/voice-agent-api/tools/overview) for the full pattern.

***

### `session.error`

Session or protocol error. The payload always includes `type`, `timestamp`, `code`, and `message`. Some errors (like `session.update` validation failures) also include a `param` field naming the offending field.

```json theme={null}
{
  "type": "session.error",
  "code": "invalid_format",
  "message": "Invalid message format",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

**Connection and handshake errors**

Sent before or instead of `session.ready`. The WebSocket closes after these with the indicated close code.

| Code | Close code | Description |
| - | - | - |
| `UNAUTHORIZED` | 1008 | Missing or invalid `Authorization` token |
| `FORBIDDEN` | 1008 | Valid token, but insufficient permissions |
| `server_error` | 1008 | Service at capacity (try again later) |
| `INTERNAL_ERROR` | 1011 | Unexpected exception during connection setup |

**Session resume errors**

Sent when `session.resume` fails. The WebSocket closes after these.

| Code | Close code | Description |
| - | - | - |
| `session_not_found` | 1008 | The `session_id` is unknown or the 30-second grace window expired |
| `session_forbidden` | 1008 | The `session_id` belongs to a different account |
| `session_expired` | 1008 | Session TTL elapsed during the grace window |

**Agent startup errors**

Sent after the WebSocket is accepted but before `session.ready`.

| Code | Description |
| - | - |
| `agent_init_failed` | Voice agent worker reported initialization failure |
| `agent_timeout` | Agent did not signal ready within 10 seconds |

**Client message errors**

Sent on the open socket when an inbound message is invalid. The session stays alive (except `session_expired`).

| Code | Description |
| - | - |
| `invalid_format` | Bad JSON, missing or unknown `type`, validation failure, or missing `audio` field on `input.audio` |
| `invalid_audio` | `input.audio` payload failed base64 decode or PCM conversion |
| `invalid_value` | `session.update` with an invalid voice or field type |
| `immutable_field` | `session.update` tried to change `greeting`, `output.voice`, or `output.format` after the first update was applied. `output.volume` is mutable and does not raise this error. |
| `invalid_config` | `session.update` raised a validation error |
| `server_error` | Unexpected exception while applying `session.update` |
| `agent_id_not_first` | `agent_id` was sent after the first `session.update`, or alongside inline fields in the same message |
| `agent_not_found` | `agent_id` does not resolve to an agent on your account |
| `audio_rate_violation` | `input.audio` streamed faster than real time |

**Capacity errors (retryable)**

Reconnect with backoff; these are transient. The session-level codes `at_capacity`, `concurrency_exceeded`, and `internal_error` are the only retryable ones — every other code is fatal.

| Code | Description |
| - | - |
| `at_capacity` | Service is temporarily at capacity |
| `concurrency_exceeded` | Your account's concurrent-session limit was reached |

**Live session errors**

| Code | Close code | Description |
| - | - | - |
| `session_expired` | 1008 | Session duration TTL reached. There is no separate "closing soon" warning event before this, so run a client-side timer if you need to wrap up gracefully. |

<Note>
  If the server cancels the session due to an internal error, the WebSocket closes with code `1011` without any `session.error` payload. In browsers, pre-handshake failures (like `UNAUTHORIZED`) surface as a `close` event with code `1006`. You won't receive a `session.error`. Always fetch a fresh token immediately before each connection attempt.
</Note>

***

## Interruptions

When the user speaks mid-response (barge-in), the server stops the agent and emits [`reply.done`](#reply-done) with `status: "interrupted"` and [`transcript.agent`](#transcript-agent) with `interrupted: true`. The decision is semantic. Back-channels like "uh-huh" don't trigger an interruption.

**On `reply.done` with `status: "interrupted"`:**

1. Flush your local audio playback buffer.
2. Discard any pending `tool.result` accumulators from the just-ended reply.
3. Restart the playback stream so it's ready for the next response.

See [Turn detection and interruptions](/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions) for how the model decides what counts as an interruption, and [Handling interruptions](/docs/voice-agents/voice-agent-api/audio-format#handling-interruptions) for the platform-specific flush pattern.
