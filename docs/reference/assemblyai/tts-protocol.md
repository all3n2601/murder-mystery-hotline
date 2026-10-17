# AssemblyAI streaming TTS protocol (verified by probe)

Not in AssemblyAI's public docs as of 2026-10-17. Everything here comes from running `tools/PROTOTYPE-tts-probe.ts` and `tools/PROTOTYPE-tts-concurrency.ts` against the live endpoint on a free-plan account on 2026-10-17. Raw results are in `probe-out/tts-probe.json`.

## Connect

```
wss://streaming-tts.assemblyai.com/v1/ws?voice=<id>&sample_rate=<hz>
Authorization: <raw API key>        (no "Bearer" prefix)
```

The configuration is set by query params. The server echoes it in `Begin`:

| Param | Default | Verified |
| --- | --- | --- |
| `voice` | `jane` | Yes, `george`, `vera` and `eve` all work. An unknown voice returns error 3006 with the list. |
| `sample_rate` | `24000` | Yes, `16000` works |
| `encoding` | `pcm_s16le` | Default only |
| `language` | `english` | Default only |
| `inactivity_timeout` | `null` (none) | Default only. **An idle session never times out, so always send `Terminate`.** |
| `word_boundaries` | `true` | Default only |
| `voice_clone`, `voice_clone_preprocess` | `false` | Not tested (see `VoiceReference`) |

**The voice is fixed per connection.** There's no mid-session config message, so each suspect needs their own socket.

**Voices on this account** (taken from the error message): `alba anna charles eve george iris jane jean mary michael paul reid vera`. That's the Voice Agent list plus `iris` and `reid`, minus the accented voices.

## Client → server

The server lists these as the only valid types: `Generate`, `Flush`, `Terminate`, `KeepAlive`, `Cancel`, `VoiceReference`.

```json
{ "type": "Generate", "text": "Detective, I only connected the calls." }
{ "type": "Flush" }
{ "type": "Cancel" }
{ "type": "Terminate" }
```

- **No audio is produced until `Flush`.** A `Generate` without a flush produced nothing for 8 s.
- `Cancel` stops the current utterance. The server replies `Cancelled`, and **the socket stays usable**: the next `Generate` + `Flush` works on the same connection.
- `KeepAlive` and `VoiceReference` (voice cloning?) are untested.

## Server → client

```json
{ "type": "Begin", "id": "<uuid>", "expires_at": 1792221856, "configuration": { "voice": "jane", "sample_rate": 24000, "encoding": "pcm_s16le", ... } }
{ "type": "Audio", "audio": "<base64 PCM16 mono>" }
{ "type": "FlushDone", "flush_id": 0, "audio_duration_ms": 3760 }
{ "type": "WordBoundaries", "flush_id": 0, "audio_start_ms": 0, "words": [{ "word": "Detective,", "start": 196, "end": 784, "confidence": 0.67 }] }
{ "type": "Cancelled", "audio_duration_seconds": 0.0 }
{ "type": "Error", "error_code": 3006, "error": "..." }
```

- Audio arrives as **base64 inside JSON text frames**, not binary frames.
- `flush_id` increments per flush on a connection. Use it to drop stale audio after a `Cancel`.
- `WordBoundaries` comes after `FlushDone`, with per-word timings in ms. That's enough for word-synced captions.
- After an `Error`, the server closes with code `3006` (bad message or voice) or `3009` (session cap).

## Timing (measured)

| Measure | Value |
| --- | --- |
| Connect → `Begin` | ~5–130 ms after socket open (socket open itself ~280–340 ms) |
| **`Flush` → first audio** | **~110–120 ms** (3 runs) |
| Short sentence fully streamed | Audio for a 3.8 s line was fully received in ~420 ms, faster than real time |

## Limits

- **At most 3 concurrent sessions per account** (free plan). A 4th connection gets `Error 3009 "Too many concurrent sessions for this account"` straight after connecting.
- Sessions closed without `Terminate` seemed to count against the cap for a while.
- Pricing during the Preview is unknown.
