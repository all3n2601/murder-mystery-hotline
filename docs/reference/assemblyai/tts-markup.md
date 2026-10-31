# AssemblyAI streaming TTS: markup and delivery controls

Researched 2026-10-18 for `wss://streaming-tts.assemblyai.com/v1/ws`. Nothing here was run against the API. For the wire protocol, see `tts-protocol.md`. Its "Acted tags" section is **wrong**: a transcription check showed that `[sighs]`, `(sighs)` and `*sighs*` are read aloud as words.

## Summary

- **AssemblyAI documents no markup, tags, SSML, or prosody parameters for this endpoint.** The endpoint isn't documented at all. The docs FAQ says "AssemblyAI does not offer standalone text-to-speech as a separate service" ([FAQ](https://www.assemblyai.com/docs/faq/do-you-offer-voice-to-voice-or-text-to-speech-tts)). AssemblyAI's own open-source code also calls it undocumented ([AssemblyAI/blurt `AssemblyAISpeechSynthesizer.swift`](https://github.com/AssemblyAI/blurt/blob/main/Sources/BlurtEngine/TTS/AssemblyAISpeechSynthesizer.swift), [PR #221](https://github.com/AssemblyAI/blurt/pull/221)).
- **The underlying model is Kyutai Pocket TTS.** AssemblyAI's official CLI says so: "PocketTTS (the streaming-TTS model behind `assembly speak`)" ([AssemblyAI/cli `aai_cli/tts/text.py`](https://github.com/AssemblyAI/cli/blob/main/aai_cli/tts/text.py)). The voice catalog backs this up. AssemblyAI's list in [`aai_cli/tts/voices.py`](https://github.com/AssemblyAI/cli/blob/main/aai_cli/tts/voices.py) (alba, azelma, cosette, eponine, javert, marius, bill_boerst, …) is the same as Pocket TTS's built-in voices ([kyutai-labs/pocket-tts README](https://github.com/kyutai-labs/pocket-tts#readme)).
- **Pocket TTS has no markup either.** The model takes plain text only. Kyutai lists pause tags as an **unsupported feature** ([README "Unsupported features"](https://github.com/kyutai-labs/pocket-tts#unsupported-features), [issue #6](https://github.com/kyutai-labs/pocket-tts/issues/6), still open).
- **Only two kinds of control exist:**
  - **Punctuation and plain wording.** Ellipses work as pauses (a user report in issue #6). Sentence punctuation drives prosody (see `text_chunking.py` below).
  - **The voice itself:** pick a voice, or clone one from a reference clip with the `voice_clone` param and the `VoiceReference` message. The clone carries over the character of the reference recording.
- **Pocket TTS has sampling parameters (`temperature` etc.), but AssemblyAI doesn't expose them.** The model has them, and the documented upside of a higher `temperature` is "More expressive". None appears in the server's `Begin` configuration (see `tts-protocol.md`), and no AssemblyAI source names them. Whether the server accepts them is untested.

## Details per mechanism

### Bracket / emotion tags (`[sighs]`, `[laughs]`)
- **Status:** not supported. These are ElevenLabs v3 / Dia-style conventions. Pocket TTS has no tag vocabulary, and AssemblyAI documents none.
- **Evidence:** our own transcription test (the tags are read aloud). AssemblyAI's Voice Agent prompting guide warns that "TTS engines read formatting characters literally" ([prompting guide](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/prompting-guide)).

### SSML (`<break>`, `<prosody>`, `<emphasis>`, `<say-as>`, `<phoneme>`)
- **Status:** not documented anywhere. AssemblyAI doesn't mention it ([Voice Agent docs index](https://www.assemblyai.com/docs/llms.txt), which has no SSML page), and neither does Pocket TTS ([README](https://github.com/kyutai-labs/pocket-tts#readme), [HF model card](https://huggingface.co/kyutai/pocket-tts)). Expect the tags to be read aloud or mangled.

### Pauses
- **Officially:** "At the moment, we do not support … Adding silence in the text input to generate pauses." ([pocket-tts README](https://github.com/kyutai-labs/pocket-tts#unsupported-features))
- **Community workaround (unverified; it's a comment by a third-party user on Kyutai's official issue):** "Stringing together a few ellipses "…" seems to work fairly well … pathological behavior if you do too many in a row" ([issue #6](https://github.com/kyutai-labs/pocket-tts/issues/6)).
- **Splitting the text:** each `Flush` is its own utterance with about 800 ms of padding ([blurt PR #221](https://github.com/AssemblyAI/blurt/pull/221)). For an exact pause, split the line into separate `Generate`+`Flush` rounds, or insert silence on our side.

### Punctuation and text normalization
Source: [`pocket_tts/models/text_chunking.py`](https://github.com/kyutai-labs/pocket-tts/blob/main/pocket_tts/models/text_chunking.py). AssemblyAI may run its own preprocessing first, which we can't see.
- Sentence-final marks are `. ! ? …` (U+2026). If the text doesn't end with one, Pocket TTS adds a period, and trailing `, ; : - – —` become `.`.
- `;` may be turned into `,` (the `remove_semicolons` option).
- Newlines are collapsed to spaces.
- The first letter is capitalized.
- Inputs of 4 words or fewer get extra trailing frames. Inputs of fewer than 5 words are padded with leading spaces, because "the model does not perform well when there are very few tokens".
- AssemblyAI keeps the terminal punctuation on each chunk because it "preserves the punctuation the model needs for prosody" ([AssemblyAI/cli `text.py`](https://github.com/AssemblyAI/cli/blob/main/aai_cli/tts/text.py)).
- **For delivery:** use `…`, `!`, `?` and short sentences. Avoid `;`, which may become a comma.

### Voice choice and voice cloning
- Pocket TTS clones from a WAV, and "the audio quality of the sample is also reproduced" ([HF model card](https://huggingface.co/kyutai/pocket-tts)).
- `cosette` is built from an Expresso *confused*-style clip ([README voice list](https://github.com/kyutai-labs/pocket-tts#readme), file `expresso/ex04-ex02_confused_001_…wav`). So the reference clip's speaking style is what sets the delivery.
- **On the AssemblyAI side:** the server's `Begin` echoes `voice_clone` and `voice_clone_preprocess`, and lists a `VoiceReference` message type (our probe, `tts-protocol.md`). The payload format is not documented anywhere public.
- Kyutai publishes style-labeled reference clips at [huggingface.co/kyutai/tts-voices](https://huggingface.co/kyutai/tts-voices). For example, `expresso/` has styles such as confused, default and others.

### Sampling parameters (model level, not exposed by AssemblyAI)
Sources: [`default_parameters.py`](https://github.com/kyutai-labs/pocket-tts/blob/main/pocket_tts/default_parameters.py), [generate CLI docs](https://github.com/kyutai-labs/pocket-tts/blob/main/docs/CLI%20Commands/generate.md).
- `temperature`: default 0.3. The docs' example comment is "More expressive (higher temperature)": `--temperature 1.0`.
- `sampler_decode_steps` (default 1), `noise_clamp` (default None), `eos_threshold` (default -4.0; "smaller means finishing earlier"), and `frames_after_eos` (80 ms per frame, default auto).
- **AssemblyAI side:** not in the `Begin` configuration and not named in any AssemblyAI source. The official CLI passes "any further query params verbatim" through an `extra` escape hatch, but names none ([AssemblyAI/cli `session.py`](https://github.com/AssemblyAI/cli/blob/main/aai_cli/tts/session.py)).

### `language` query param
- Pocket TTS loads a separate model per language (`english`, `french`, …). AssemblyAI's CLI sends `language=English`, etc. ([cli design spec](https://github.com/AssemblyAI/cli/blob/main/docs/superpowers/specs/2026-06-10-aai-speak-design.md), [`voices.py`](https://github.com/AssemblyAI/cli/blob/main/aai_cli/tts/voices.py)). It doesn't affect expressiveness.

## Not supported / not documented

| Mechanism | Status | Source |
| --- | --- | --- |
| `[sighs]`, `(laughs)`, `*gasps*` | Read aloud (our test); no tag vocabulary | prompting guide; pocket-tts README |
| SSML (`<break>`, `<prosody>`, `<emphasis>`, `<say-as>`, `<phoneme>`) | Not documented by AssemblyAI or Kyutai | — |
| Pause tags (`[pause]`, `[1s]`) | Explicitly unsupported upstream | pocket-tts README, issue #6 |
| Speed / rate, emotion, style, stability params | None exist in the model or the API | pocket-tts generate docs; AssemblyAI `Begin` config |
| Phoneme / IPA hints, pronunciation dictionary | None | — |
| Voice Agent API `output.*` | Only `voice`, `volume`, `format` | [session configuration](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-configuration), [voices](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices) |

## Candidates to test (most promising first)

1. **Phonetic non-verbals in plain words.** We already know these are performed. Extend the set: `"Haah…"`, `"Hhh."`, `"Ha! Ha ha."`, `"Ugh."`, `"Hm. Hmm…"`, `"Tch."`, `"Ahem."`, `"Mm-hm."`, `"Oh!"`, `"Ahh…"`. Source: the model reads plain text only (pocket-tts README).
2. **Ellipsis pauses:** `"I… I didn't see anything."`, `"Well… … fine."` (two or three, no more). Source: [issue #6](https://github.com/kyutai-labs/pocket-tts/issues/6) (community comment, unverified). Also compare U+2026 `…` against three dots `...`; only `…` is in the model's terminal-punctuation set.
3. **Split Flushes for hard pauses:** `Generate "I was there."` → `Flush` → `Generate "Alone."` → `Flush`, measuring the gap (about 800 ms reported). Source: [blurt PR #221](https://github.com/AssemblyAI/blurt/pull/221).
4. **Punctuation-driven prosody:** `"No. No! No?"`, `"You think I did it?!"`, and em-dash cut-offs `"I was going to—"`. Source: `text_chunking.py` punctuation sets.
5. **Query param `temperature`:** `?voice=eve&temperature=0.7` and `temperature=1.0`. Check whether `Begin.configuration` echoes it, whether the server errors (an error message may list the valid params), or whether it's silently ignored. Source: pocket-tts generate docs ("More expressive (higher temperature)"). Not exposed by AssemblyAI.
6. **Other sampling params, same test:** `eos_threshold=-3.0`, `frames_after_eos=5`, `sampler_decode_steps=5`, `noise_clamp=…`. Source: `default_parameters.py`. Speculative.
7. **Expressive voice choice:** try `cosette` (built from a "confused"-style clip), plus `azelma`, `eponine`, `fantine`, `javert`, `marius`, `bill_boerst`, `caro_davy`, `peter_yearsley`, `stuart_bell`. These are in AssemblyAI's CLI catalog but missing from our account's error list in `tts-protocol.md`, so they may error. Source: [`voices.py`](https://github.com/AssemblyAI/cli/blob/main/aai_cli/tts/voices.py), pocket-tts README.
8. **Voice cloning from a styled clip:** `voice_clone=true` plus a `VoiceReference` message carrying a nervous, whispery or tearful reference clip (for example one from `kyutai/tts-voices/expresso/`). The payload shape is undocumented, so probe it, e.g. `{"type":"VoiceReference","audio":"<base64 PCM16>"}`, and read the error. Source: `Begin` fields (our probe); cloning reproduces the sample's character ([HF model card](https://huggingface.co/kyutai/pocket-tts)).
