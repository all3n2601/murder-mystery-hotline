> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Inline session configuration

> Configure a voice agent at connect-time over the WebSocket with session.update, without storing an agent.

<Note>
  **Most agents should [create a stored agent](/docs/voice-agents/voice-agent-api/create-agent) instead.** Storing your configuration server-side keeps secrets off the client, runs HTTP tools for you, and lets you deploy the same agent across the API, a browser, and Twilio by `agent_id`. This page covers the **inline** alternative: configuring an agent at connect-time without storing it, useful for fully dynamic or one-off agents. The field reference below applies to both: the same fields exist on a stored agent's `input`/`output` objects.
</Note>

`session.update` is the configuration surface for an inline (non-stored) agent. Everything that shapes how the agent sounds and behaves lives here: its personality, its greeting, the tools it can call, how it interprets user speech, and what voice it speaks in.

Send a [`session.update`](/docs/voice-agents/voice-agent-api/events-reference#session-update) as your first WebSocket message, and any time after, to update most fields. Some fields can only be set in the first update; see [Mutability after `session.ready`](#mutability-after-session-ready) below.

<Tip>
  To use a stored agent instead, send `{ "agent_id": "<id>" }` as the only field in your first `session.update`; it's mutually exclusive with the inline fields below. See [Deploy your agent](/docs/voice-agents/voice-agent-api/deploy).
</Tip>

Here's a full configuration showing every available field:

```json expandable theme={null}
{
  "type": "session.update",
  "session": {
    "system_prompt": "You are a friendly support agent. Keep responses under 2 sentences.",
    "greeting": "Hi! How can I help you today?",
    "tools": [],
    "input": {
      "format": { "encoding": "audio/pcm" },
      "keyterms": ["AssemblyAI", "Universal"],
      "transcription_mode": "balanced",
      "transcription_prompt": "Expect product names and order IDs.",
      "language_codes": ["en"],
      "voice_focus": "near-field",
      "voice_focus_threshold": 0.5,
      "turn_detection": {
        "vad_threshold": 0.5,
        "min_silence": 1000,
        "max_silence": 3000,
        "interrupt_response": true,
        "interruption_delay": 100
      }
    },
    "output": {
      "voice": "alba",
      "format": { "encoding": "audio/pcm" },
      "volume": 100
    }
  }
}
```

Every field is optional. Include only what you want to set or change. Jump to any section below for details.

## Mutability after `session.ready`

The first `session.update` you send before `session.ready` initializes the session. After `session.ready`, only a subset of fields can be changed. Changing one of the immutable fields raises a [`session.error`](/docs/voice-agents/voice-agent-api/events-reference#session-error) with code `immutable_field` and the rejected change is ignored.

| Field | Mutable after `session.ready`? |
| - | - |
| `session.system_prompt` | Yes. Send a new prompt at any time to change the agent's behavior on the next turn. |
| `session.input.turn_detection` | Yes. Adjust VAD thresholds, silence windows, and barge-in on the fly. |
| `session.input.keyterms` | Yes. Replace the keyterms list at any time. The new list takes effect on the next user utterance. |
| `session.input.transcription_mode` | Yes. |
| `session.input.transcription_prompt` | Yes. |
| `session.input.language_codes` | Accepted mid-session, but applied on the next speech-to-text reconnect (not the current turn). |
| `session.input.voice_focus` / `voice_focus_threshold` | Set at connect. A mid-session change is accepted but only takes effect on the next speech-to-text reconnect. |
| `session.output.volume` | Yes. Adjust playback volume on the fly. |
| `session.greeting` | No. Raises `immutable_field`. The greeting is spoken once at session start. |
| `session.output.voice` | No. Raises `immutable_field`. The voice is bound to the TTS connection at session start. |
| `session.output.format` | No. Raises `immutable_field`. The output audio encoding is fixed for the session. |

Other fields (`session.tools`, `session.input.format`) are also accepted in subsequent `session.update` messages and don't raise `immutable_field`.

## Fields

The `session` object carries the same fields as a stored agent. Each has a dedicated guide with details and examples; the cURL there maps one-to-one onto the `session.update` shape shown above.

* **`system_prompt`**: the agent's personality and behavior. Updatable mid-session. See the [Prompting guide](/docs/voice-agents/voice-agent-api/prompting-guide).
* **`greeting`**: the exact words spoken on connect, sent straight to TTS. Immutable after `session.ready`. See [Greeting](/docs/voice-agents/voice-agent-api/greeting).
* **`output.voice`**: the TTS voice, e.g. `"alba"`. Immutable after `session.ready`. See [Voices](/docs/voice-agents/voice-agent-api/voices).
* **`input.format` / `output.format`**: audio encoding (default `audio/pcm` at 24 kHz). `output.format` is immutable after `session.ready`. See [Audio format](/docs/voice-agents/voice-agent-api/audio-format#encodings).
* **`output.volume`**: playback volume, `0` to `100`. Updatable mid-session. See [Volume](/docs/voice-agents/voice-agent-api/volume).
* **`input.keyterms`**: up to 100 transcription-bias terms. Updatable mid-session. See [Key terms](/docs/voice-agents/voice-agent-api/transcription-prompt#key-terms).
* **`input.turn_detection`**: VAD threshold, silence windows (`min_silence`/`max_silence`, ms), barge-in (`interrupt_response`), and `interruption_delay` (ms, `0` to `1000`). Updatable mid-session. See [Turn detection and interruptions](/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions).
* **`input.transcription_mode`**: speech-to-text speed vs. accuracy: `balanced` (default), `min_latency`, or `max_accuracy`. Updatable mid-session. See [Turn-taking & interruptions](/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions#transcription-mode).
* **`input.transcription_prompt`**: a prompt that biases transcription toward expected vocabulary (max 1750 characters). Updatable mid-session.
* **`input.language_codes`**: declare the spoken language(s); omit for automatic detection. Applied on the next speech-to-text connect.
* **`input.voice_focus` / `input.voice_focus_threshold`**: noise-suppression model (`near-field`, the default, or `far-field`) and strength (`0.0` to `1.0`, default `0.85`, requires `voice_focus`). Set at connect.
* **`tools`**: actions the agent can call, each optionally with `response_instructions` (`success`/`error` guidance the agent follows after the call). See [Add tools](/docs/voice-agents/voice-agent-api/tools/overview).
