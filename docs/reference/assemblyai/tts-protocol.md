# AssemblyAI streaming TTS protocol (verified by probe)

> **Superseded in part on 2026-10-31.** AssemblyAI-TTS-1 launched on 2026-10-27 and is now documented under <https://www.assemblyai.com/docs/tts/>. The differences are listed in `docs-diff-2026-10-31.md`. A live probe on 2026-10-31 found:
> - **`wss://tts.us.assemblyai.com/v1/ws?voice_id=aai-<name>`** is TTS-1, the model the adapter uses now. It refuses `voice=` with 3006 ("voice is retired: name the voice with voice_id"). `aai-iris` resolves too (through the voice library), so every name below has an `aai-` form.
> - **The old host `streaming-tts.assemblyai.com` still answers with the pre-launch model.** It honours `voice=`, has no inactivity timeout, and ignores `voice_id` (it falls back to `jane`).
> - **On TTS-1, an idle session closes after 120 s** (3006 `inactivity_timeout`). `KeepAlive` resets the timer, so the adapter sends one every 60 s on an open line.
> - **TTS-1 speaks written fillers.** "It's, uh, right here in front of the, uh, um, thing." came back from STT with all three fillers; the old model dropped two. Stutters (`c-c-can't`) and false starts (`That- that`) are performed too.
> - **The docs count only new sessions** (5 a minute on free), not open ones. The 3-session cap below wasn't re-measured.
>
> The rest of this file describes the old host as probed on 2026-10-17/18.

Not in AssemblyAI's public docs as of 2026-10-17. Everything here comes from probing the live endpoint on a free-plan account on 2026-10-17 and 2026-10-18. The original probe scripts were removed once their findings were written up here; they are in git history (`tools/PROTOTYPE-tts-probe.ts`, `tools/PROTOTYPE-tts-concurrency.ts`). Raw results are in `probe-out/tts-probe.json` (git-ignored).

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
- **About 5 new sessions, then refusals for ~50–60 s** (measured 2026-10-17). The error is the same `3009 "concurrent"` one, even though each earlier session was closed properly with `Terminate`. So the practical limit is about 5 new sessions a minute. **Reuse one socket per voice instead of opening one per utterance.**
- Pricing during the Preview is unknown.

## Reusing a socket

- One socket takes any number of `Generate` + `Flush` rounds. `flush_id` keeps counting up.
- **After `Cancel`, audio of the cut-off utterance keeps arriving until `Cancelled`, and none arrives after it** (probed: 28 frames between them, 0 after). Drop audio between the two, and the socket is clean for the next utterance.
- A cancelled flush never gets a `FlushDone`.
- `Terminate` is answered with `{ "type": "Termination" }`, then the server closes the socket.

## Bracket tags are read aloud (corrected 2026-10-18)

**The engine does not perform tags.** It reads `[sighs]`, `[laughs]`, `[chuckles]`, `[gasps]`, `[clears throat]`, `[coughs]` and `[scoffs]` aloud as words, at the start of a line or mid-line, in `george` and `anna`. `(sighs)` and `*sighs*` are read aloud too. Verified by transcribing the rendered audio with STT; the probe is `tools/probe-tts-markup.ts` with `tools/tts-markup-candidates.json` (see [tts-markup.md](tts-markup.md)).

The 2026-10-17 note that called these "acted" was wrong. A tag shows up in `WordBoundaries` with zero length, but the gap after it is the word being spoken, so zero-length boundaries prove nothing.

What the engine does perform, written as plain text: `Ha! Ha ha.` (laugh), `Heh heh.` (chuckle), `Haah…` (sigh), and an em-dash cut-off (`I was going to— No.`). Ellipses add no pause. The reply splitter translates `[sighs]`, `[laughs]` and `[chuckles]` into those spellings and drops every other bracket (`packages/engine/src/tags.ts`).
