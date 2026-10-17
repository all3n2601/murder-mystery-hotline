> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Streaming WebSocket API

> Stream audio and receive real-time transcription results.

### Endpoints

| WebSocket URL | Description |
| --- | --- |
| `wss://streaming.assemblyai.com/v3/ws` | **Global (default).** Latency-optimized — automatically routes each connection to the nearest region. |
| `wss://streaming.us.assemblyai.com/v3/ws` | **US data residency.** Audio and transcription data never leaves the US. |
| `wss://streaming.eu.assemblyai.com/v3/ws` | **EU data residency.** Audio and transcription data never leaves the EU. |

Use a data residency endpoint for compliance requirements; see [Cloud endpoints & data residency](https://www.assemblyai.com/docs/streaming/endpoints-and-data-zones).

### Headers

| Header | Description |
| --- | --- |
| `Authorization` | **Required.** Your AssemblyAI API key (no `Bearer` prefix). Required on every connection unless you authenticate with the `token` query parameter instead. |
| `AssemblyAI-Version` | **Optional.** API version pin. Defaults to the latest version. |

Browsers cannot set headers on a WebSocket connection. In that case, [generate a temporary token](https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token) server-side and pass it via the `token` query parameter instead. Never expose your permanent API key in a URL or in client-side code.

### Query parameters

All query parameters below are optional — a connection with only authentication set uses the default speech model (`universal-3-6-pro`) at 16 kHz `pcm_s16le`. Parameters apply to every model unless their description says otherwise.




## AsyncAPI

````yaml api-reference/specs/streaming.yaml streaming
id: streaming
title: Streaming
description: >
  Stream audio and receive real-time transcription results.


  ### Endpoints


  | WebSocket URL | Description |

  | --- | --- |

  | `wss://streaming.assemblyai.com/v3/ws` | **Global (default).**
  Latency-optimized — automatically routes each connection to the nearest
  region. |

  | `wss://streaming.us.assemblyai.com/v3/ws` | **US data residency.** Audio and
  transcription data never leaves the US. |

  | `wss://streaming.eu.assemblyai.com/v3/ws` | **EU data residency.** Audio and
  transcription data never leaves the EU. |


  Use a data residency endpoint for compliance requirements; see [Cloud
  endpoints & data
  residency](https://www.assemblyai.com/docs/streaming/endpoints-and-data-zones).


  ### Headers


  | Header | Description |

  | --- | --- |

  | `Authorization` | **Required.** Your AssemblyAI API key (no `Bearer`
  prefix). Required on every connection unless you authenticate with the `token`
  query parameter instead. |

  | `AssemblyAI-Version` | **Optional.** API version pin. Defaults to the latest
  version. |


  Browsers cannot set headers on a WebSocket connection. In that case, [generate
  a temporary
  token](https://www.assemblyai.com/docs/streaming/authenticate-with-a-temporary-token)
  server-side and pass it via the `token` query parameter instead. Never expose
  your permanent API key in a URL or in client-side code.


  ### Query parameters


  All query parameters below are optional — a connection with only
  authentication set uses the default speech model (`universal-3-6-pro`) at 16
  kHz `pcm_s16le`. Parameters apply to every model unless their description says
  otherwise.
servers:
  - id: production
    protocol: wss
    host: streaming.assemblyai.com
    bindings: []
    variables: []
  - id: usDataResidency
    protocol: wss
    host: streaming.us.assemblyai.com
    bindings: []
    variables: []
  - id: euDataResidency
    protocol: wss
    host: streaming.eu.assemblyai.com
    bindings: []
    variables: []
address: /v3/ws
parameters:
  - id: token
    jsonSchema:
      type: string
      description: >-
        Authenticate with a [temporary
        token](/api-reference/streaming-api/generate-streaming-token) via query
        parameter. Use this where request headers cannot be set — for example,
        browser WebSocket connections — and prefer the `Authorization` header
        everywhere else. Generate the temporary token server-side; never expose
        your permanent API key in a URL.
    description: >-
      Authenticate with a [temporary
      token](/api-reference/streaming-api/generate-streaming-token) via query
      parameter. Use this where request headers cannot be set — for example,
      browser WebSocket connections — and prefer the `Authorization` header
      everywhere else. Generate the temporary token server-side; never expose
      your permanent API key in a URL.
    type: string
    required: true
    deprecated: false
  - id: speech_model
    jsonSchema:
      type: string
      description: >-
        The speech model to use for the session. See [Select the speech
        model](https://www.assemblyai.com/docs/streaming/select-the-speech-model)
        for the differences between models.
      enum:
        - universal-3-6-pro
        - universal-3-5-pro
        - universal-streaming-english
        - universal-streaming-multilingual
    description: >-
      The speech model to use for the session. See [Select the speech
      model](https://www.assemblyai.com/docs/streaming/select-the-speech-model)
      for the differences between models.
    type: string
    required: true
    deprecated: false
  - id: language_codes
    jsonSchema:
      type: string
      description: >-
        Steers transcription toward a set of languages by biasing output toward
        them on a per-token basis while still allowing native code-switching
        among them. Pass a list of language codes for the languages you expect
        (for example, `["en", "es"]`), or a single-element list (for example,
        `["es"]`) for a monolingual session. When unset, no steering is applied
        and the model code-switches natively across all of its supported
        languages. This is distinct from `language_detection`, which only
        controls whether the detected language is reported. Accepted codes:
        `af`, `ar`, `yue`, `ca`, `da`, `nl`, `en`, `et`, `fi`, `fr`, `gl`, `de`,
        `he`, `hi`, `it`, `ja`, `ko`, `zh`, `mr`, `no`, `nn`, `fa`, `pt`, `ro`,
        `ru`, `es`, `sv`, `tr`, `ur`, `vi`, `xh`, `zu`. Universal-3.5 Pro
        Streaming supports the same set minus `af`, `yue`, `et`, `gl`, `ko`,
        `mr`, `nn`, `fa`, `ro`, `ru`, `ur`, `xh`, and `zu`, which are
        Universal-3.6 Pro only. Universal-3.6 Pro and Universal-3.5 Pro
        Streaming only.
      examples:
        - '["en", "es"]'
    description: >-
      Steers transcription toward a set of languages by biasing output toward
      them on a per-token basis while still allowing native code-switching among
      them. Pass a list of language codes for the languages you expect (for
      example, `["en", "es"]`), or a single-element list (for example, `["es"]`)
      for a monolingual session. When unset, no steering is applied and the
      model code-switches natively across all of its supported languages. This
      is distinct from `language_detection`, which only controls whether the
      detected language is reported. Accepted codes: `af`, `ar`, `yue`, `ca`,
      `da`, `nl`, `en`, `et`, `fi`, `fr`, `gl`, `de`, `he`, `hi`, `it`, `ja`,
      `ko`, `zh`, `mr`, `no`, `nn`, `fa`, `pt`, `ro`, `ru`, `es`, `sv`, `tr`,
      `ur`, `vi`, `xh`, `zu`. Universal-3.5 Pro Streaming supports the same set
      minus `af`, `yue`, `et`, `gl`, `ko`, `mr`, `nn`, `fa`, `ro`, `ru`, `ur`,
      `xh`, and `zu`, which are Universal-3.6 Pro only. Universal-3.6 Pro and
      Universal-3.5 Pro Streaming only.
    type: string
    required: true
    deprecated: false
  - id: language_detection
    jsonSchema:
      type: string
      description: >-
        Whether to return `language_code` and `language_confidence` in turn
        messages. Available on Universal-3.6 Pro and Universal-3.5 Pro Streaming
        (which natively code-switch across all of their supported languages by
        default) and on Universal Streaming Multilingual only.
      enum:
        - 'true'
        - 'false'
      default: 'false'
    description: >-
      Whether to return `language_code` and `language_confidence` in turn
      messages. Available on Universal-3.6 Pro and Universal-3.5 Pro Streaming
      (which natively code-switch across all of their supported languages by
      default) and on Universal Streaming Multilingual only.
    type: string
    required: true
    deprecated: false
  - id: domain
    jsonSchema:
      type: string
      description: >-
        Enable domain-specific transcription models to improve accuracy for
        specialized terminology. Set to `"medical-v1"` to enable [Medical
        Mode](https://www.assemblyai.com/docs/streaming/medical-mode) for
        improved accuracy of medical terms such as medications, procedures,
        conditions, and dosages. Supported languages: English (`en`), Spanish
        (`es`), German (`de`), French (`fr`). If used with an unsupported
        language, the parameter is ignored and a warning is returned.
      enum:
        - medical-v1
    description: >-
      Enable domain-specific transcription models to improve accuracy for
      specialized terminology. Set to `"medical-v1"` to enable [Medical
      Mode](https://www.assemblyai.com/docs/streaming/medical-mode) for improved
      accuracy of medical terms such as medications, procedures, conditions, and
      dosages. Supported languages: English (`en`), Spanish (`es`), German
      (`de`), French (`fr`). If used with an unsupported language, the parameter
      is ignored and a warning is returned.
    type: string
    required: true
    deprecated: false
  - id: mode
    jsonSchema:
      type: string
      description: >-
        Latency and accuracy preset that controls the model's turn-detection and
        partial-emission defaults. `max_accuracy` favors transcription quality,
        `min_latency` favors speed, and `balanced` trades off between the two.
        When omitted, the server applies its own preset, which determines the
        defaults for the mode-dependent fields `min_turn_silence` and
        `interruption_delay`. Universal-3.5 Pro Streaming only.
      enum:
        - max_accuracy
        - min_latency
        - balanced
    description: >-
      Latency and accuracy preset that controls the model's turn-detection and
      partial-emission defaults. `max_accuracy` favors transcription quality,
      `min_latency` favors speed, and `balanced` trades off between the two.
      When omitted, the server applies its own preset, which determines the
      defaults for the mode-dependent fields `min_turn_silence` and
      `interruption_delay`. Universal-3.5 Pro Streaming only.
    type: string
    required: true
    deprecated: false
  - id: session_heartbeat
    jsonSchema:
      type: string
      description: >-
        When enabled, the server sends a `Heartbeat` message every 5 seconds of
        wall-clock time for the life of the session, during both speech and
        silence. Use it to confirm the session is alive and to compare how fast
        the client is delivering audio against real time. Can also be toggled
        mid-session via `UpdateConfiguration`.
      enum:
        - 'true'
        - 'false'
      default: 'false'
    description: >-
      When enabled, the server sends a `Heartbeat` message every 5 seconds of
      wall-clock time for the life of the session, during both speech and
      silence. Use it to confirm the session is alive and to compare how fast
      the client is delivering audio against real time. Can also be toggled
      mid-session via `UpdateConfiguration`.
    type: string
    required: true
    deprecated: false
  - id: encoding
    jsonSchema:
      type: string
      description: >-
        Encoding of the audio stream. `pcm_s16le` and `pcm_mulaw` are raw PCM
        formats. `opus` is raw Opus packets, where each binary WebSocket message
        must contain exactly one Opus packet. `ogg_opus` is an Ogg-encapsulated
        Opus byte stream (the format produced by ffmpeg, gstreamer, opusenc, and
        browser MediaRecorder); binary WebSocket messages can be arbitrary
        chunks of the stream. `aac` is an AAC stream in ADTS framing; raw AAC
        packets and MP4/M4A containers are not supported. Binary WebSocket
        messages can be arbitrary chunks of the stream, and the server buffers
        partial frames. For `aac` and both Opus encodings, `sample_rate` is
        ignored because each stream describes its own sample rate. Audio is
        decoded to PCM server side and transcription behavior is otherwise
        identical.
      enum:
        - pcm_s16le
        - pcm_mulaw
        - opus
        - ogg_opus
        - aac
      default: pcm_s16le
    description: >-
      Encoding of the audio stream. `pcm_s16le` and `pcm_mulaw` are raw PCM
      formats. `opus` is raw Opus packets, where each binary WebSocket message
      must contain exactly one Opus packet. `ogg_opus` is an Ogg-encapsulated
      Opus byte stream (the format produced by ffmpeg, gstreamer, opusenc, and
      browser MediaRecorder); binary WebSocket messages can be arbitrary chunks
      of the stream. `aac` is an AAC stream in ADTS framing; raw AAC packets and
      MP4/M4A containers are not supported. Binary WebSocket messages can be
      arbitrary chunks of the stream, and the server buffers partial frames. For
      `aac` and both Opus encodings, `sample_rate` is ignored because each
      stream describes its own sample rate. Audio is decoded to PCM server side
      and transcription behavior is otherwise identical.
    type: string
    required: true
    deprecated: false
  - id: sample_rate
    jsonSchema:
      type: string
      description: >-
        Sample rate of the audio stream in Hz. Accepts any integer from 8000 to
        96000. Ignored for Opus and AAC encodings (`opus`, `ogg_opus`, `aac`),
        which describe their own sample rate.
      default: '16000'
      examples:
        - '16000'
        - '48000'
    description: >-
      Sample rate of the audio stream in Hz. Accepts any integer from 8000 to
      96000. Ignored for Opus and AAC encodings (`opus`, `ogg_opus`, `aac`),
      which describe their own sample rate.
    type: string
    required: true
    deprecated: false
  - id: min_turn_silence
    jsonSchema:
      type: string
      description: >-
        Silence duration in milliseconds before a speculative end-of-turn check.
        On Universal-3.5 Pro Streaming the check is punctuation-based (if
        terminal punctuation is found the turn ends, otherwise a partial is
        emitted and the turn continues) and the default is mode-dependent, set
        by the `mode` preset. On Universal Streaming the check is
        confidence-based and the default is 400 ms. Clamped to the range 50 to
        10000 ms. See [Configuring Turn
        Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
        for configuration details.
      examples:
        - '100'
        - '200'
    description: >-
      Silence duration in milliseconds before a speculative end-of-turn check.
      On Universal-3.5 Pro Streaming the check is punctuation-based (if terminal
      punctuation is found the turn ends, otherwise a partial is emitted and the
      turn continues) and the default is mode-dependent, set by the `mode`
      preset. On Universal Streaming the check is confidence-based and the
      default is 400 ms. Clamped to the range 50 to 10000 ms. See [Configuring
      Turn
      Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
      for configuration details.
    type: string
    required: true
    deprecated: false
  - id: max_turn_silence
    jsonSchema:
      type: string
      description: >-
        Maximum silence in milliseconds before the turn is forced to end,
        regardless of punctuation. Defaults are 1536 ms on Universal-3.5 Pro
        Streaming (768 ms when `speaker_labels` is enabled) and 1280 ms on
        Universal Streaming. See [Configuring Turn
        Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
        for configuration details.
      examples:
        - '700'
        - '1000'
    description: >-
      Maximum silence in milliseconds before the turn is forced to end,
      regardless of punctuation. Defaults are 1536 ms on Universal-3.5 Pro
      Streaming (768 ms when `speaker_labels` is enabled) and 1280 ms on
      Universal Streaming. See [Configuring Turn
      Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
      for configuration details.
    type: string
    required: true
    deprecated: false
  - id: end_of_turn_confidence_threshold
    jsonSchema:
      type: string
      description: >
        The confidence threshold (0.0 to 1.0) to use when determining if the end
        of a turn has been reached. See [Turn
        Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
        for configuration details. Universal Streaming (English and
        Multilingual) only.
      default: '0.4'
      examples:
        - '0.4'
        - '0.7'
    description: >
      The confidence threshold (0.0 to 1.0) to use when determining if the end
      of a turn has been reached. See [Turn
      Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
      for configuration details. Universal Streaming (English and Multilingual)
      only.
    type: string
    required: true
    deprecated: false
  - id: vad_threshold
    jsonSchema:
      type: string
      description: >-
        The confidence threshold (0.0 to 1.0) for classifying audio frames as
        silence. Frames with VAD confidence below this value are considered
        silent. Increase for noisy environments to reduce false speech
        detection. Defaults are 0.2 on Universal-3.5 Pro Streaming (0.5 when
        `speaker_labels` is enabled) and 0.4 on Universal Streaming.
    description: >-
      The confidence threshold (0.0 to 1.0) for classifying audio frames as
      silence. Frames with VAD confidence below this value are considered
      silent. Increase for noisy environments to reduce false speech detection.
      Defaults are 0.2 on Universal-3.5 Pro Streaming (0.5 when `speaker_labels`
      is enabled) and 0.4 on Universal Streaming.
    type: string
    required: true
    deprecated: false
  - id: interruption_delay
    jsonSchema:
      type: string
      description: >-
        How soon the first partial is emitted in milliseconds. Accepts a value
        from 0 to 1000. Useful for tuning voice agent barge-in responsiveness or
        allowing earlier partials for early LLM inference. Larger values are
        more confident on interruptions, smaller values result in faster time to
        first partial. The server adds a fixed 256 ms on top of this value, so
        `0` yields an effective delay of 256 ms and `500` yields 756 ms. The
        default is mode-dependent and set by the server based on the `mode`
        preset. Universal-3.5 Pro Streaming only.
      examples:
        - '0'
        - '500'
    description: >-
      How soon the first partial is emitted in milliseconds. Accepts a value
      from 0 to 1000. Useful for tuning voice agent barge-in responsiveness or
      allowing earlier partials for early LLM inference. Larger values are more
      confident on interruptions, smaller values result in faster time to first
      partial. The server adds a fixed 256 ms on top of this value, so `0`
      yields an effective delay of 256 ms and `500` yields 756 ms. The default
      is mode-dependent and set by the server based on the `mode` preset.
      Universal-3.5 Pro Streaming only.
    type: string
    required: true
    deprecated: false
  - id: include_partial_turns
    jsonSchema:
      type: string
      description: >-
        Whether to emit partial transcripts during the turn. When enabled
        (default), partial transcripts are forwarded as speech is still in
        progress alongside final turns. When disabled, only final turns (with
        end_of_turn true) are sent. Defaults to false when redact_pii is
        enabled, to prevent unredacted partial transcripts from reaching the
        client; set explicitly to true to override.
      default: 'true'
    description: >-
      Whether to emit partial transcripts during the turn. When enabled
      (default), partial transcripts are forwarded as speech is still in
      progress alongside final turns. When disabled, only final turns (with
      end_of_turn true) are sent. Defaults to false when redact_pii is enabled,
      to prevent unredacted partial transcripts from reaching the client; set
      explicitly to true to override.
    type: string
    required: true
    deprecated: false
  - id: format_turns
    jsonSchema:
      type: string
      description: >-
        Whether to return formatted final transcripts. Universal Streaming
        (English and Multilingual) only.
      enum:
        - 'true'
        - 'false'
      default: 'false'
    description: >-
      Whether to return formatted final transcripts. Universal Streaming
      (English and Multilingual) only.
    type: string
    required: true
    deprecated: false
  - id: prompt
    jsonSchema:
      type: string
      description: >-
        A contextual prompt describing what the audio is about, such as its
        domain, scenario, or full conversation details. The model uses this
        context to better recognize the vocabulary it makes likely, for example
        priming medical terminology for a cardiology call. It carries context
        about your audio, not transcription instructions, so formatting or
        behavioral commands (such as punctuation rules) are not supported.
        Maximum 1750 characters. Universal-3.5 Pro Streaming only. See
        [Prompting and
        keyterms](https://www.assemblyai.com/docs/streaming/prompting-and-keyterms)
        for details.
    description: >-
      A contextual prompt describing what the audio is about, such as its
      domain, scenario, or full conversation details. The model uses this
      context to better recognize the vocabulary it makes likely, for example
      priming medical terminology for a cardiology call. It carries context
      about your audio, not transcription instructions, so formatting or
      behavioral commands (such as punctuation rules) are not supported. Maximum
      1750 characters. Universal-3.5 Pro Streaming only. See [Prompting and
      keyterms](https://www.assemblyai.com/docs/streaming/prompting-and-keyterms)
      for details.
    type: string
    required: true
    deprecated: false
  - id: keyterms_prompt
    jsonSchema:
      type: string
      description: >-
        A list of words and phrases to improve recognition accuracy for. Maximum
        100 terms. See [Keyterms
        Prompting](https://www.assemblyai.com/docs/streaming/keyterms-prompting)
        for more details.
    description: >-
      A list of words and phrases to improve recognition accuracy for. Maximum
      100 terms. See [Keyterms
      Prompting](https://www.assemblyai.com/docs/streaming/keyterms-prompting)
      for more details.
    type: string
    required: true
    deprecated: false
  - id: agent_context
    jsonSchema:
      type: string
      description: >-
        Your voice agent's spoken text (TTS reply). The model uses this as
        context for the next user turn, which improves accuracy on short or
        ambiguous replies and on spelled-out entities like emails or IDs. Set at
        connection time to seed the model with your agent's opening greeting,
        and/or update mid-stream via `UpdateConfiguration` after each agent
        reply. Each `UpdateConfiguration` replaces the previously set value.
        Maximum 1750 characters per value. Universal-3.6 Pro and Universal-3.5
        Pro Streaming only. See [Context
        Carryover](https://www.assemblyai.com/docs/streaming/universal-3-5-pro/context-carryover).
      examples:
        - >-
          Welcome to the Krusty Krab, home of the Krabby Patty, may I take your
          order?
    description: >-
      Your voice agent's spoken text (TTS reply). The model uses this as context
      for the next user turn, which improves accuracy on short or ambiguous
      replies and on spelled-out entities like emails or IDs. Set at connection
      time to seed the model with your agent's opening greeting, and/or update
      mid-stream via `UpdateConfiguration` after each agent reply. Each
      `UpdateConfiguration` replaces the previously set value. Maximum 1750
      characters per value. Universal-3.6 Pro and Universal-3.5 Pro Streaming
      only. See [Context
      Carryover](https://www.assemblyai.com/docs/streaming/universal-3-5-pro/context-carryover).
    type: string
    required: true
    deprecated: false
  - id: previous_context_n_turns
    jsonSchema:
      type: string
      description: >-
        Advanced. Maximum number of prior conversation entries (user transcripts
        and any `agent_context` values) carried forward as context for each
        transcription. Range 0 to 100. Set to `0` to disable automatic context
        carryover entirely. When unset, the server default applies (currently 5
        turns). Most integrations should leave this unset. Universal-3.5 Pro
        Streaming only.
    description: >-
      Advanced. Maximum number of prior conversation entries (user transcripts
      and any `agent_context` values) carried forward as context for each
      transcription. Range 0 to 100. Set to `0` to disable automatic context
      carryover entirely. When unset, the server default applies (currently 5
      turns). Most integrations should leave this unset. Universal-3.5 Pro
      Streaming only.
    type: string
    required: true
    deprecated: false
  - id: speaker_labels
    jsonSchema:
      type: string
      description: >-
        Whether to enable [Streaming Speaker
        Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels).
        When enabled, each Turn event will include a `speaker_label` field and
        each final word in the `words` array will include a `speaker` field for
        word-level speaker attribution.
      enum:
        - 'true'
        - 'false'
      default: 'false'
    description: >-
      Whether to enable [Streaming Speaker
      Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels).
      When enabled, each Turn event will include a `speaker_label` field and
      each final word in the `words` array will include a `speaker` field for
      word-level speaker attribution.
    type: string
    required: true
    deprecated: false
  - id: max_speakers
    jsonSchema:
      type: string
      description: >-
        A hard cap on the number of speaker labels in the audio stream (integer,
        1-10). This is a strict limit, not a hint — once it is reached, any
        additional speakers are merged into the closest existing label rather
        than given a new one. Give the model a little headroom above the number
        of speakers you expect; setting it too high can cause over-splitting and
        return more speakers than are actually present. Only used when
        `speaker_labels` is enabled. See [Streaming
        Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)
        for more details.
      examples:
        - '2'
        - '4'
    description: >-
      A hard cap on the number of speaker labels in the audio stream (integer,
      1-10). This is a strict limit, not a hint — once it is reached, any
      additional speakers are merged into the closest existing label rather than
      given a new one. Give the model a little headroom above the number of
      speakers you expect; setting it too high can cause over-splitting and
      return more speakers than are actually present. Only used when
      `speaker_labels` is enabled. See [Streaming
      Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)
      for more details.
    type: string
    required: true
    deprecated: false
  - id: speaker_labels_revision_interval_ms
    jsonSchema:
      type: string
      description: >-
        Interval in milliseconds of audio between mid-session `SpeakerRevision`
        messages (integer). With a value greater than `0`, the server emits a
        revision roughly every interval of audio, and the first one no sooner
        than about 2 minutes of audio; the recommended value is `300000` (5
        minutes). The minimum is `120000` (lower values are adjusted up); larger
        values are supported, and revisions arrive at approximately the
        requested interval. With `0` or the parameter unset, only the
        end-of-session revision is sent. The message schema is identical either
        way, and the final end-of-session revision is always sent. Only used
        when `speaker_labels` is enabled. See [Revised speaker
        labels](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#revised-speaker-labels)
        for more details.
      default: '0'
      examples:
        - '300000'
    description: >-
      Interval in milliseconds of audio between mid-session `SpeakerRevision`
      messages (integer). With a value greater than `0`, the server emits a
      revision roughly every interval of audio, and the first one no sooner than
      about 2 minutes of audio; the recommended value is `300000` (5 minutes).
      The minimum is `120000` (lower values are adjusted up); larger values are
      supported, and revisions arrive at approximately the requested interval.
      With `0` or the parameter unset, only the end-of-session revision is sent.
      The message schema is identical either way, and the final end-of-session
      revision is always sent. Only used when `speaker_labels` is enabled. See
      [Revised speaker
      labels](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#revised-speaker-labels)
      for more details.
    type: string
    required: true
    deprecated: false
  - id: voice_focus
    jsonSchema:
      type: string
      description: >-
        Enable [Voice
        Focus](https://www.assemblyai.com/docs/streaming/voice-focus) to isolate
        the primary voice and suppress background noise before transcription.
        Set to `near-field` for close-talking microphones (for example, headsets
        or phones) or `far-field` for distant microphones (for example,
        conference rooms). When unset, Voice Focus is off.
      enum:
        - near-field
        - far-field
    description: >-
      Enable [Voice
      Focus](https://www.assemblyai.com/docs/streaming/voice-focus) to isolate
      the primary voice and suppress background noise before transcription. Set
      to `near-field` for close-talking microphones (for example, headsets or
      phones) or `far-field` for distant microphones (for example, conference
      rooms). When unset, Voice Focus is off.
    type: string
    required: true
    deprecated: false
  - id: voice_focus_threshold
    jsonSchema:
      type: string
      description: >-
        Controls how aggressively Voice Focus suppresses background audio, from
        `0.0` (least) to `1.0` (most). Higher values are more aggressive.
        Requires `voice_focus` to be set, otherwise a validation error is
        returned.
      default: '0.7'
    description: >-
      Controls how aggressively Voice Focus suppresses background audio, from
      `0.0` (least) to `1.0` (most). Higher values are more aggressive. Requires
      `voice_focus` to be set, otherwise a validation error is returned.
    type: string
    required: true
    deprecated: false
  - id: redact_pii
    jsonSchema:
      type: string
      description: >-
        Redact PII from the transcribed text using the Redact PII model, can be
        true or false. Only applies to final turns. See [PII
        Redaction](https://www.assemblyai.com/docs/streaming/pii-redaction) for
        more details.
      enum:
        - 'true'
        - 'false'
      default: 'false'
    description: >-
      Redact PII from the transcribed text using the Redact PII model, can be
      true or false. Only applies to final turns. See [PII
      Redaction](https://www.assemblyai.com/docs/streaming/pii-redaction) for
      more details.
    type: string
    required: true
    deprecated: false
  - id: redact_pii_policies
    jsonSchema:
      type: string
      description: >-
        The list of PII Redaction policies to enable. Requires `redact_pii` to
        be `true`. See [PII
        redaction](https://www.assemblyai.com/docs/streaming/pii-redaction) for
        more details.
    description: >-
      The list of PII Redaction policies to enable. Requires `redact_pii` to be
      `true`. See [PII
      redaction](https://www.assemblyai.com/docs/streaming/pii-redaction) for
      more details.
    type: string
    required: true
    deprecated: false
  - id: redact_pii_sub
    jsonSchema:
      type: string
      description: >-
        The replacement logic for detected PII, can be `entity_name` or `hash`.
        Requires `redact_pii` to be `true`. See [PII
        redaction](https://www.assemblyai.com/docs/streaming/pii-redaction) for
        more details.
      enum:
        - entity_name
        - hash
      default: hash
    description: >-
      The replacement logic for detected PII, can be `entity_name` or `hash`.
      Requires `redact_pii` to be `true`. See [PII
      redaction](https://www.assemblyai.com/docs/streaming/pii-redaction) for
      more details.
    type: string
    required: true
    deprecated: false
  - id: filter_profanity
    jsonSchema:
      type: string
      description: >-
        Filter profanity from the transcribed text, can be true or false. See
        [Profanity
        Filtering](https://www.assemblyai.com/docs/streaming/filter-profanity-from-transcripts)
        for more details.
      enum:
        - 'true'
        - 'false'
      default: 'false'
    description: >-
      Filter profanity from the transcribed text, can be true or false. See
      [Profanity
      Filtering](https://www.assemblyai.com/docs/streaming/filter-profanity-from-transcripts)
      for more details.
    type: string
    required: true
    deprecated: false
  - id: llm_gateway
    jsonSchema:
      type: string
      description: >-
        JSON-stringified LLM Gateway configuration that processes each finalized
        turn. Follows the same interface as the [Chat
        Completions](/llm-gateway/chat-completions) endpoint and accepts
        `model`, `messages`, `tools`, `tool_choice`, `post_processing_steps`,
        and `max_tokens`. See [Apply LLM Gateway to
        Streaming](https://www.assemblyai.com/docs/guides/real_time_llm_gateway)
        for the full schema and examples.
    description: >-
      JSON-stringified LLM Gateway configuration that processes each finalized
      turn. Follows the same interface as the [Chat
      Completions](/llm-gateway/chat-completions) endpoint and accepts `model`,
      `messages`, `tools`, `tool_choice`, `post_processing_steps`, and
      `max_tokens`. See [Apply LLM Gateway to
      Streaming](https://www.assemblyai.com/docs/guides/real_time_llm_gateway)
      for the full schema and examples.
    type: string
    required: true
    deprecated: false
  - id: inactivity_timeout
    jsonSchema:
      type: string
      description: >-
        Optional time in seconds of inactivity before session is terminated
        (integer, minimum 5, maximum 3600). If not set, no inactivity timeout is
        applied.
      examples:
        - '5'
        - '3600'
    description: >-
      Optional time in seconds of inactivity before session is terminated
      (integer, minimum 5, maximum 3600). If not set, no inactivity timeout is
      applied.
    type: string
    required: true
    deprecated: false
bindings: []
operations:
  - &ref_1
    id: audio
    title: Audio
    description: >-
      Send audio data chunks for transcription. The payload must be of type
      bytes and contain audio data between 50ms and 1000ms in length. When
      streaming from a pre-recorded file, pace the chunks at approximately
      real-time (for example, sleep for the chunk's duration between sends) —
      sending chunks in a tight loop can produce inconsistent Turn messages. See
      the [Streaming
      quickstart](https://www.assemblyai.com/docs/streaming/getting-started/transcribe-streaming-audio)
      to get started.
    type: receive
    messages:
      - &ref_13
        id: audioChunk
        contentType: application/octet-stream
        payload:
          - type: string
            format: binary
            x-parser-schema-id: <anonymous-schema-48>
            name: Audio Data Chunk
            description: Client sends audio data as raw binary.
        headers: []
        jsonPayloadSchema:
          type: string
          format: binary
          x-parser-schema-id: <anonymous-schema-48>
        title: Audio Data Chunk
        description: Client sends audio data as raw binary.
        example: >-
          "\\x10\\x00\\x20\\x00\\x30\\x00\\x40\\x00\\x30\\x00\\x20\\x00\\x10\\x00\\x00\\x00\\xf0\\xff\\xe0\\xff\\xd0\\xff\\xc0\\xff"
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: audioChunk
    bindings: []
    extensions: &ref_0
      - id: x-parser-unique-object-id
        value: streaming
  - &ref_2
    id: updateConfiguration
    title: Update configuration
    description: >-
      Update streaming configuration parameters during an active session. You
      can update `prompt`, `keyterms_prompt`, `min_turn_silence`,
      `max_turn_silence`, `end_of_turn_confidence_threshold`, `vad_threshold`,
      `interruption_delay`, `mode`, `language_codes`, `session_heartbeat`, and
      `agent_context`.
    type: receive
    messages:
      - &ref_14
        id: updateConfiguration
        contentType: application/json
        payload:
          - name: Update Streaming Configuration
            description: >-
              Client message to update streaming configuration parameters during
              an active session.
            type: object
            properties:
              - name: type
                type: string
                description: UpdateConfiguration
                required: true
              - name: prompt
                type: string
                description: >-
                  A contextual prompt describing what the audio is about, such
                  as its domain, scenario, or full conversation details. The
                  model uses this context to better recognize the vocabulary it
                  makes likely. It carries context about your audio, not
                  transcription instructions, so formatting or behavioral
                  commands are not supported. Maximum 1750 characters. See
                  [Prompting and
                  keyterms](https://www.assemblyai.com/docs/streaming/prompting-and-keyterms)
                  for details.
                required: false
              - name: keyterms_prompt
                type: array
                description: >-
                  A list of words and phrases to boost recognition for. See
                  [Keyterms
                  Prompting](https://www.assemblyai.com/docs/streaming/keyterms-prompting)
                  for more details.
                required: false
                properties:
                  - name: item
                    type: string
                    required: false
              - name: min_turn_silence
                type: integer
                description: >-
                  Silence duration in milliseconds before a speculative
                  end-of-turn check. See [Configuring Turn
                  Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                  for configuration details.
                required: false
              - name: max_turn_silence
                type: integer
                description: >-
                  Maximum silence in milliseconds before the turn is forced to
                  end, regardless of punctuation. See [Configuring Turn
                  Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                  for configuration details.
                required: false
              - name: vad_threshold
                type: number
                description: >-
                  The confidence threshold (0.0 to 1.0) for classifying audio
                  frames as silence. Frames with VAD confidence below this value
                  are considered silent. Increase for noisy environments to
                  reduce false speech detection.
                required: false
              - name: interruption_delay
                type: integer
                description: >-
                  How soon the first partial is emitted in milliseconds. Useful
                  for tuning voice agent barge-in responsiveness or allowing
                  earlier partials for early LLM inference. Larger values are
                  more confident on interruptions, smaller values result in
                  faster time to first partial.
                required: false
              - name: agent_context
                type: string
                description: >-
                  Your voice agent's most recent spoken reply (TTS text). The
                  model uses this as context for the next user turn, which
                  improves accuracy on short or ambiguous replies and on
                  spelled-out entities like emails or IDs. Each
                  `UpdateConfiguration` replaces the previously set value.
                  Maximum 1750 characters. See [Context
                  Carryover](https://www.assemblyai.com/docs/streaming/universal-3-5-pro/context-carryover#passing-your-agents-reply-as-context).
                required: false
              - name: mode
                type: string
                description: >-
                  Switch the latency and accuracy preset mid-session. See the
                  `mode` connection parameter for the behavior of each preset.
                  Universal-3.5 Pro Streaming only.
                enumValues:
                  - max_accuracy
                  - min_latency
                  - balanced
                required: false
              - name: end_of_turn_confidence_threshold
                type: number
                description: >-
                  The confidence threshold (0.0 to 1.0) to use when determining
                  if the end of a turn has been reached. Universal Streaming
                  (English and Multilingual) only. See [Turn
                  Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                  for configuration details.
                required: false
              - name: language_codes
                type: array
                description: >-
                  Update the set of languages transcription is steered toward.
                  Takes effect from the next turn. See the `language_codes`
                  connection parameter for accepted codes and behavior. Pass an
                  empty list to clear steering and return to native
                  code-switching across all supported languages. Universal-3.6
                  Pro and Universal-3.5 Pro Streaming only.
                required: false
                properties:
                  - name: item
                    type: string
                    required: false
              - name: session_heartbeat
                type: boolean
                description: >-
                  Turn periodic `Heartbeat` liveness messages on or off
                  mid-session. See the `session_heartbeat` connection parameter
                  for behavior.
                required: false
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: UpdateConfiguration
              x-parser-schema-id: <anonymous-schema-32>
            prompt:
              type: string
              description: >-
                A contextual prompt describing what the audio is about, such as
                its domain, scenario, or full conversation details. The model
                uses this context to better recognize the vocabulary it makes
                likely. It carries context about your audio, not transcription
                instructions, so formatting or behavioral commands are not
                supported. Maximum 1750 characters. See [Prompting and
                keyterms](https://www.assemblyai.com/docs/streaming/prompting-and-keyterms)
                for details.
              x-parser-schema-id: <anonymous-schema-33>
            keyterms_prompt:
              type: array
              items:
                type: string
                x-parser-schema-id: <anonymous-schema-35>
              description: >-
                A list of words and phrases to boost recognition for. See
                [Keyterms
                Prompting](https://www.assemblyai.com/docs/streaming/keyterms-prompting)
                for more details.
              x-parser-schema-id: <anonymous-schema-34>
            min_turn_silence:
              type: integer
              description: >-
                Silence duration in milliseconds before a speculative
                end-of-turn check. See [Configuring Turn
                Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                for configuration details.
              x-parser-schema-id: <anonymous-schema-36>
            max_turn_silence:
              type: integer
              description: >-
                Maximum silence in milliseconds before the turn is forced to
                end, regardless of punctuation. See [Configuring Turn
                Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                for configuration details.
              x-parser-schema-id: <anonymous-schema-37>
            vad_threshold:
              type: number
              description: >-
                The confidence threshold (0.0 to 1.0) for classifying audio
                frames as silence. Frames with VAD confidence below this value
                are considered silent. Increase for noisy environments to reduce
                false speech detection.
              x-parser-schema-id: <anonymous-schema-38>
            interruption_delay:
              type: integer
              minimum: 0
              maximum: 1000
              description: >-
                How soon the first partial is emitted in milliseconds. Useful
                for tuning voice agent barge-in responsiveness or allowing
                earlier partials for early LLM inference. Larger values are more
                confident on interruptions, smaller values result in faster time
                to first partial.
              x-parser-schema-id: <anonymous-schema-39>
            agent_context:
              type: string
              description: >-
                Your voice agent's most recent spoken reply (TTS text). The
                model uses this as context for the next user turn, which
                improves accuracy on short or ambiguous replies and on
                spelled-out entities like emails or IDs. Each
                `UpdateConfiguration` replaces the previously set value. Maximum
                1750 characters. See [Context
                Carryover](https://www.assemblyai.com/docs/streaming/universal-3-5-pro/context-carryover#passing-your-agents-reply-as-context).
              x-parser-schema-id: <anonymous-schema-40>
            mode:
              type: string
              enum:
                - max_accuracy
                - min_latency
                - balanced
              description: >-
                Switch the latency and accuracy preset mid-session. See the
                `mode` connection parameter for the behavior of each preset.
                Universal-3.5 Pro Streaming only.
              x-parser-schema-id: <anonymous-schema-41>
            end_of_turn_confidence_threshold:
              type: number
              description: >-
                The confidence threshold (0.0 to 1.0) to use when determining if
                the end of a turn has been reached. Universal Streaming (English
                and Multilingual) only. See [Turn
                Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                for configuration details.
              x-parser-schema-id: <anonymous-schema-42>
            language_codes:
              type: array
              items:
                type: string
                x-parser-schema-id: <anonymous-schema-44>
              description: >-
                Update the set of languages transcription is steered toward.
                Takes effect from the next turn. See the `language_codes`
                connection parameter for accepted codes and behavior. Pass an
                empty list to clear steering and return to native code-switching
                across all supported languages. Universal-3.6 Pro and
                Universal-3.5 Pro Streaming only.
              x-parser-schema-id: <anonymous-schema-43>
            session_heartbeat:
              type: boolean
              description: >-
                Turn periodic `Heartbeat` liveness messages on or off
                mid-session. See the `session_heartbeat` connection parameter
                for behavior.
              x-parser-schema-id: <anonymous-schema-45>
          required:
            - type
          x-parser-schema-id: UpdateConfigurationPayload
        title: Update Streaming Configuration
        description: >-
          Client message to update streaming configuration parameters during an
          active session.
        example: |-
          {
            "type": "UpdateConfiguration",
            "prompt": "Transcribe product names accurately.",
            "keyterms_prompt": [
              "AssemblyAI",
              "Krabby Patty"
            ],
            "min_turn_silence": 700,
            "max_turn_silence": 1600,
            "agent_context": "Sure — what date would you like to book?"
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: updateConfiguration
    bindings: []
    extensions: *ref_0
  - &ref_3
    id: forceEndpoint
    title: Force endpoint
    description: Manually force an endpoint in the transcription.
    type: receive
    messages:
      - &ref_15
        id: forceEndpoint
        contentType: application/json
        payload:
          - name: Force Endpoint
            description: Client message to manually force an endpoint in the transcription.
            type: object
            properties:
              - name: type
                type: string
                description: ForceEndpoint
                required: true
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: ForceEndpoint
              x-parser-schema-id: <anonymous-schema-46>
          required:
            - type
          x-parser-schema-id: ForceEndpointPayload
        title: Force Endpoint
        description: Client message to manually force an endpoint in the transcription.
        example: |-
          {
            "type": "ForceEndpoint"
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: forceEndpoint
    bindings: []
    extensions: *ref_0
  - &ref_4
    id: terminateSession
    title: Terminate session
    description: Gracefully terminate the streaming session.
    type: receive
    messages:
      - &ref_16
        id: sessionTermination
        contentType: application/json
        payload:
          - name: Terminate Session (Client Initiated)
            description: Client message to gracefully terminate the streaming session.
            type: object
            properties:
              - name: type
                type: string
                description: Terminate
                required: true
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: Terminate
              x-parser-schema-id: <anonymous-schema-47>
          required:
            - type
          x-parser-schema-id: SessionTerminationPayload
        title: Terminate Session (Client Initiated)
        description: Client message to gracefully terminate the streaming session.
        example: |-
          {
            "type": "Terminate"
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: sessionTermination
    bindings: []
    extensions: *ref_0
  - &ref_5
    id: keepAlive
    title: Keep alive
    description: >-
      Send a keep-alive message to reset the `inactivity_timeout` timer. This is
      not necessary by default — sessions remain open until explicitly
      terminated or until the 3-hour maximum session duration is reached. This
      message is only needed if you have set `inactivity_timeout` and want to
      keep the session open during periods where no audio is being sent.
    type: receive
    messages:
      - &ref_17
        id: keepAlive
        contentType: application/json
        payload:
          - name: Keep Alive
            description: >-
              Client message to reset the inactivity timeout timer. This is not
              necessary by default — sessions remain open until explicitly
              terminated or until the 3-hour maximum session duration is
              reached. This message is only needed if you have set
              `inactivity_timeout` and want to keep the session open during
              periods where no audio is being sent.
            type: object
            properties:
              - name: type
                type: string
                description: KeepAlive
                required: true
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: KeepAlive
              x-parser-schema-id: <anonymous-schema-49>
          required:
            - type
          x-parser-schema-id: KeepAlivePayload
        title: Keep Alive
        description: >-
          Client message to reset the inactivity timeout timer. This is not
          necessary by default — sessions remain open until explicitly
          terminated or until the 3-hour maximum session duration is reached.
          This message is only needed if you have set `inactivity_timeout` and
          want to keep the session open during periods where no audio is being
          sent.
        example: |-
          {
            "type": "KeepAlive"
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: keepAlive
    bindings: []
    extensions: *ref_0
  - &ref_6
    id: sessionBegins
    title: Session begins
    description: Receive confirmation that the streaming session has successfully started.
    type: send
    messages:
      - &ref_18
        id: sessionBegins
        contentType: application/json
        payload:
          - name: Session Begins Confirmation
            description: >-
              Server message indicating the streaming session has successfully
              started.
            type: object
            properties:
              - name: type
                type: string
                description: Identifies the type of the message.
                required: true
              - name: id
                type: string
                description: Unique identifier for the streaming session.
                required: true
              - name: expires_at
                type: integer
                description: Unix timestamp indicating when the session will expire.
                required: true
              - name: configuration
                type: object
                description: >-
                  Echo of the configuration the server applied to the session.
                  Always check that `model` matches the `speech_model` you
                  requested — unrecognized or misspelled query parameters are
                  ignored rather than rejected. Optional settings that were not
                  set are null.
                required: false
                properties:
                  - name: model
                    type: string
                    description: The speech model applied to the session.
                    required: false
                  - name: mode
                    type: string
                    description: >-
                      The latency/accuracy preset in effect. Universal-3.5 Pro
                      Streaming only; null otherwise.
                    required: false
                  - name: api_version
                    type: string
                    description: >-
                      The API version in effect for the session (see the
                      `AssemblyAI-Version` header).
                    required: false
                  - name: speaker_labels
                    type: boolean
                    description: Whether speaker diarization is enabled.
                    required: false
                  - name: redact_pii
                    type: boolean
                    description: Whether PII redaction is enabled.
                    required: false
                  - name: filter_profanity
                    type: boolean
                    description: Whether profanity filtering is enabled.
                    required: false
                  - name: domain
                    type: string
                    description: >-
                      The domain specialization in effect (for example
                      `medical-v1`), or null.
                    required: false
                  - name: voice_focus
                    type: string
                    description: >-
                      The Voice Focus model in effect (`near-field` or
                      `far-field`), or null.
                    required: false
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: Begin
              description: Identifies the type of the message.
              x-parser-schema-id: <anonymous-schema-50>
            id:
              type: string
              format: uuid
              description: Unique identifier for the streaming session.
              x-parser-schema-id: <anonymous-schema-51>
            expires_at:
              type: integer
              description: Unix timestamp indicating when the session will expire.
              x-parser-schema-id: <anonymous-schema-52>
            configuration:
              type: object
              description: >-
                Echo of the configuration the server applied to the session.
                Always check that `model` matches the `speech_model` you
                requested — unrecognized or misspelled query parameters are
                ignored rather than rejected. Optional settings that were not
                set are null.
              properties:
                model:
                  type: string
                  description: The speech model applied to the session.
                  x-parser-schema-id: <anonymous-schema-54>
                mode:
                  type: string
                  nullable: true
                  description: >-
                    The latency/accuracy preset in effect. Universal-3.5 Pro
                    Streaming only; null otherwise.
                  x-parser-schema-id: <anonymous-schema-55>
                api_version:
                  type: string
                  description: >-
                    The API version in effect for the session (see the
                    `AssemblyAI-Version` header).
                  x-parser-schema-id: <anonymous-schema-56>
                speaker_labels:
                  type: boolean
                  description: Whether speaker diarization is enabled.
                  x-parser-schema-id: <anonymous-schema-57>
                redact_pii:
                  type: boolean
                  description: Whether PII redaction is enabled.
                  x-parser-schema-id: <anonymous-schema-58>
                filter_profanity:
                  type: boolean
                  description: Whether profanity filtering is enabled.
                  x-parser-schema-id: <anonymous-schema-59>
                domain:
                  type: string
                  nullable: true
                  description: >-
                    The domain specialization in effect (for example
                    `medical-v1`), or null.
                  x-parser-schema-id: <anonymous-schema-60>
                voice_focus:
                  type: string
                  nullable: true
                  description: >-
                    The Voice Focus model in effect (`near-field` or
                    `far-field`), or null.
                  x-parser-schema-id: <anonymous-schema-61>
              x-parser-schema-id: <anonymous-schema-53>
          required:
            - type
            - id
            - expires_at
          x-parser-schema-id: SessionBeginsPayload
        title: Session Begins Confirmation
        description: >-
          Server message indicating the streaming session has successfully
          started.
        example: |-
          {
            "type": "Begin",
            "id": "3207b601-2054-48df-ba77-8784dfcf9fb8",
            "expires_at": 1772570132,
            "configuration": {
              "model": "universal-3-6-pro",
              "mode": "balanced",
              "api_version": "2025-05-12",
              "speaker_labels": false,
              "redact_pii": false,
              "filter_profanity": false,
              "domain": null,
              "voice_focus": null
            }
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: sessionBegins
    bindings: []
    extensions: *ref_0
  - &ref_7
    id: speechStarted
    title: Speech started
    description: >-
      Receive a notification that speech has been detected. This event is only
      emitted when the model produces a transcript. Every `SpeechStarted` is
      guaranteed to be followed by one or more Turn messages.
    type: send
    messages:
      - &ref_19
        id: speechStarted
        contentType: application/json
        payload:
          - name: Speech Started
            description: Server message indicating that speech has been detected.
            type: object
            properties:
              - name: type
                type: string
                description: Identifies the type of the message.
                required: true
              - name: timestamp
                type: integer
                description: >-
                  The timestamp in milliseconds when speech was detected,
                  relative to the beginning of the audio stream.
                required: true
              - name: confidence
                type: number
                description: The confidence score that speech has started.
                required: true
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: SpeechStarted
              description: Identifies the type of the message.
              x-parser-schema-id: <anonymous-schema-62>
            timestamp:
              type: integer
              description: >-
                The timestamp in milliseconds when speech was detected, relative
                to the beginning of the audio stream.
              format: ms
              x-parser-schema-id: <anonymous-schema-63>
            confidence:
              type: number
              format: float
              description: The confidence score that speech has started.
              x-parser-schema-id: <anonymous-schema-64>
          required:
            - type
            - timestamp
            - confidence
          x-parser-schema-id: SpeechStartedPayload
        title: Speech Started
        description: Server message indicating that speech has been detected.
        example: |-
          {
            "type": "SpeechStarted",
            "timestamp": 1200,
            "confidence": 0.99
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: speechStarted
    bindings: []
    extensions: *ref_0
  - &ref_8
    id: turn
    title: Turn
    description: Receive a turn-based transcription result (partial or final).
    type: send
    messages:
      - &ref_20
        id: turn
        contentType: application/json
        payload:
          - name: Turn Transcript
            description: Server message containing a turn-based transcription result.
            type: object
            properties:
              - name: type
                type: string
                description: Turn
                required: true
              - name: turn_order
                type: integer
                description: Order of this turn in the conversation.
                required: true
              - name: turn_is_formatted
                type: boolean
                description: >-
                  Whether this turn has been formatted. For Universal-3.5 Pro
                  Streaming, this always matches `end_of_turn`.
                required: true
              - name: end_of_turn
                type: boolean
                description: >-
                  Whether this marks the end of a turn. See [Turn
                  Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                  for more information.
                required: true
              - name: transcript
                type: string
                description: Transcript of all finalized words in the turn.
                required: true
              - name: utterance
                type: string
                description: >-
                  Finalized transcript of the turn, populated only on
                  end_of_turn messages. Empty string on all other Turn messages.
                  Equivalent to transcript when populated.
                required: false
              - name: language_code
                type: string
                description: >-
                  The language of the turn. Only populated when language
                  detection is enabled and an utterance is complete or turn is
                  final.
                required: false
              - name: language_confidence
                type: number
                description: >-
                  The confidence score for the detected language, between 0 (low
                  confidence) and 1 (high confidence). Only populated when
                  language detection is enabled and an utterance is complete or
                  turn is final.
                required: false
              - name: speaker_label
                type: string
                description: >-
                  The speaker label for this turn (e.g. `A`, `B`). Only present
                  when `speaker_labels` is enabled. Short turns with less than
                  approximately 1 second of audio will have the label `UNKNOWN`.
                  See [Streaming
                  Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)
                  for more details.
                required: false
              - name: speaker_confidence
                type: number
                description: >-
                  Experimental. Turn-level score for the emitted `speaker_label`
                  (0.0 to 1.0), aggregated from the words attributed to that
                  speaker, so a turn that mixes speakers scores lower than a
                  clean one. Only present when `speaker_labels` is enabled. A
                  value of `0.0` means no score was available, which happens
                  rarely and early in a session — it does not mean the label is
                  wrong. The score is not calibrated and is not the probability
                  that the label is correct — use it for relative comparison
                  rather than absolute thresholds. See [Speaker
                  confidence](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#speaker-confidence)
                  for more details.
                required: false
              - name: end_of_turn_confidence
                type: number
                description: >-
                  The confidence score that this is the end of a turn, between
                  0.0 (low confidence) and 1.0 (high confidence). For
                  Universal-3.5 Pro Streaming, this is 1.0 when `end_of_turn` is
                  true and 0.0 otherwise.
                required: true
              - name: words
                type: array
                description: Array of word-level details for this turn.
                required: true
                properties:
                  - name: text
                    type: string
                    description: The transcribed word.
                    required: true
                  - name: start
                    type: integer
                    description: >-
                      Start time in milliseconds relative to the beginning of
                      the audio stream.
                    required: true
                  - name: end
                    type: integer
                    description: >-
                      End time in milliseconds relative to the beginning of the
                      audio stream.
                    required: true
                  - name: confidence
                    type: number
                    description: Confidence score for the word (0.0 to 1.0).
                    required: true
                  - name: word_is_final
                    type: boolean
                    description: Whether the word is final.
                    required: true
                  - name: speaker
                    type: string
                    description: >-
                      The speaker label for this word (e.g. `A`, `B`,
                      `UNKNOWN`). Only present on final words (`word_is_final`
                      is `true`) when `speaker_labels` is enabled. May be absent
                      on individual words even when diarization is enabled —
                      treat absent as unattributed and fall back to the
                      turn-level `speaker_label` if needed. See [Streaming
                      Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)
                      for more details.
                    required: false
                  - name: speaker_confidence
                    type: number
                    description: >-
                      Experimental. How clearly this word's audio matched the
                      speaker it was assigned to, compared with the next-closest
                      speaker (0.0 to 1.0). Only present on final words when
                      `speaker_labels` is enabled; when unavailable it is
                      omitted from the JSON rather than sent as `null`, which is
                      expected on the first words of a session. The model scores
                      a whole sentence-level segment at once, so every word in
                      the same sentence carries the same value. The score is not
                      calibrated and is not the probability that the label is
                      correct — use it for relative comparison rather than
                      absolute thresholds. `SpeakerRevision` messages carry no
                      confidences. See [Speaker
                      confidence](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#speaker-confidence)
                      for more details.
                    required: false
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: Turn
              x-parser-schema-id: <anonymous-schema-65>
            turn_order:
              type: integer
              description: Order of this turn in the conversation.
              x-parser-schema-id: <anonymous-schema-66>
            turn_is_formatted:
              type: boolean
              description: >-
                Whether this turn has been formatted. For Universal-3.5 Pro
                Streaming, this always matches `end_of_turn`.
              x-parser-schema-id: <anonymous-schema-67>
            end_of_turn:
              type: boolean
              description: >-
                Whether this marks the end of a turn. See [Turn
                Detection](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency)
                for more information.
              x-parser-schema-id: <anonymous-schema-68>
            transcript:
              type: string
              description: Transcript of all finalized words in the turn.
              x-parser-schema-id: <anonymous-schema-69>
            utterance:
              type: string
              description: >-
                Finalized transcript of the turn, populated only on end_of_turn
                messages. Empty string on all other Turn messages. Equivalent to
                transcript when populated.
              x-parser-schema-id: <anonymous-schema-70>
            language_code:
              type: string
              description: >-
                The language of the turn. Only populated when language detection
                is enabled and an utterance is complete or turn is final.
              x-parser-schema-id: <anonymous-schema-71>
            language_confidence:
              type: number
              format: float
              minimum: 0
              maximum: 1
              description: >-
                The confidence score for the detected language, between 0 (low
                confidence) and 1 (high confidence). Only populated when
                language detection is enabled and an utterance is complete or
                turn is final.
              x-parser-schema-id: <anonymous-schema-72>
            speaker_label:
              type: string
              description: >-
                The speaker label for this turn (e.g. `A`, `B`). Only present
                when `speaker_labels` is enabled. Short turns with less than
                approximately 1 second of audio will have the label `UNKNOWN`.
                See [Streaming
                Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)
                for more details.
              x-parser-schema-id: <anonymous-schema-73>
            speaker_confidence:
              type: number
              format: float
              minimum: 0
              maximum: 1
              description: >-
                Experimental. Turn-level score for the emitted `speaker_label`
                (0.0 to 1.0), aggregated from the words attributed to that
                speaker, so a turn that mixes speakers scores lower than a clean
                one. Only present when `speaker_labels` is enabled. A value of
                `0.0` means no score was available, which happens rarely and
                early in a session — it does not mean the label is wrong. The
                score is not calibrated and is not the probability that the
                label is correct — use it for relative comparison rather than
                absolute thresholds. See [Speaker
                confidence](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#speaker-confidence)
                for more details.
              x-parser-schema-id: <anonymous-schema-74>
            end_of_turn_confidence:
              type: number
              format: float
              minimum: 0
              maximum: 1
              description: >-
                The confidence score that this is the end of a turn, between 0.0
                (low confidence) and 1.0 (high confidence). For Universal-3.5
                Pro Streaming, this is 1.0 when `end_of_turn` is true and 0.0
                otherwise.
              x-parser-schema-id: <anonymous-schema-75>
            words:
              type: array
              items:
                type: object
                properties:
                  text:
                    type: string
                    description: The transcribed word.
                    x-parser-schema-id: <anonymous-schema-77>
                  start:
                    type: integer
                    description: >-
                      Start time in milliseconds relative to the beginning of
                      the audio stream.
                    format: ms
                    x-parser-schema-id: <anonymous-schema-78>
                  end:
                    type: integer
                    description: >-
                      End time in milliseconds relative to the beginning of the
                      audio stream.
                    format: ms
                    x-parser-schema-id: <anonymous-schema-79>
                  confidence:
                    type: number
                    format: float
                    minimum: 0
                    maximum: 1
                    description: Confidence score for the word (0.0 to 1.0).
                    x-parser-schema-id: <anonymous-schema-80>
                  word_is_final:
                    type: boolean
                    description: Whether the word is final.
                    x-parser-schema-id: <anonymous-schema-81>
                  speaker:
                    type: string
                    description: >-
                      The speaker label for this word (e.g. `A`, `B`,
                      `UNKNOWN`). Only present on final words (`word_is_final`
                      is `true`) when `speaker_labels` is enabled. May be absent
                      on individual words even when diarization is enabled —
                      treat absent as unattributed and fall back to the
                      turn-level `speaker_label` if needed. See [Streaming
                      Diarization](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)
                      for more details.
                    x-parser-schema-id: <anonymous-schema-82>
                  speaker_confidence:
                    type: number
                    format: float
                    minimum: 0
                    maximum: 1
                    description: >-
                      Experimental. How clearly this word's audio matched the
                      speaker it was assigned to, compared with the next-closest
                      speaker (0.0 to 1.0). Only present on final words when
                      `speaker_labels` is enabled; when unavailable it is
                      omitted from the JSON rather than sent as `null`, which is
                      expected on the first words of a session. The model scores
                      a whole sentence-level segment at once, so every word in
                      the same sentence carries the same value. The score is not
                      calibrated and is not the probability that the label is
                      correct — use it for relative comparison rather than
                      absolute thresholds. `SpeakerRevision` messages carry no
                      confidences. See [Speaker
                      confidence](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#speaker-confidence)
                      for more details.
                    x-parser-schema-id: <anonymous-schema-83>
                required:
                  - text
                  - start
                  - end
                  - confidence
                  - word_is_final
                x-parser-schema-id: Word
              description: Array of word-level details for this turn.
              x-parser-schema-id: <anonymous-schema-76>
          required:
            - type
            - turn_order
            - turn_is_formatted
            - end_of_turn
            - transcript
            - end_of_turn_confidence
            - words
          x-parser-schema-id: TurnPayload
        title: Turn Transcript
        description: Server message containing a turn-based transcription result.
        example: |-
          {
            "type": "Turn",
            "turn_order": 0,
            "turn_is_formatted": true,
            "end_of_turn": true,
            "transcript": "Hello world.",
            "end_of_turn_confidence": 1,
            "words": [
              {
                "text": "Hello",
                "start": 0,
                "end": 500,
                "confidence": 0.99
              },
              {
                "text": "world.",
                "start": 500,
                "end": 1000,
                "confidence": 0.98
              }
            ]
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: turn
    bindings: []
    extensions: *ref_0
  - &ref_9
    id: speakerRevision
    title: Speaker revision
    description: >-
      Receive revised speaker labels for earlier turns. A final message is
      always emitted immediately before `Termination` when `speaker_labels` is
      enabled, and additional messages are emitted mid-session when
      `speaker_labels_revision_interval_ms` is set. Each message contains a
      `revisions` array with only the turns whose labels changed since the
      previous message — unchanged turns are omitted and are not re-sent later.
      Apply revisions in arrival order; for a given `turn_order` the last one
      wins. Text and word timestamps are never changed — only speaker
      assignments. The end-of-session refinement adds approximately 400ms of
      latency at session close. See [Revised speaker
      labels](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#revised-speaker-labels)
      for details.
    type: send
    messages:
      - &ref_21
        id: speakerRevision
        contentType: application/json
        payload:
          - name: Revised Speaker Labels
            description: >-
              Server message containing corrected speaker labels for any turns
              that changed. When `speaker_labels` is enabled, a final message is
              emitted after the client sends `Terminate`; setting
              `speaker_labels_revision_interval_ms` adds further messages during
              the session. A session may therefore produce one or many
              `SpeakerRevision` messages, each listing only the turns changed
              since the previous one. See [Revised speaker
              labels](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#revised-speaker-labels)
              for details.
            type: object
            properties:
              - name: type
                type: string
                description: Identifies the type of the message.
                required: true
              - name: revisions
                type: array
                description: >-
                  Array of turn corrections. Only turns whose speaker labels
                  changed are included.
                required: true
                properties:
                  - name: turn_order
                    type: integer
                    description: >-
                      Matches the `turn_order` of the original Turn message
                      being corrected.
                    required: true
                  - name: speaker_label
                    type: string
                    description: >-
                      The corrected turn-level speaker label (e.g. `A`, `B`,
                      `UNKNOWN`). Replaces the `speaker_label` originally
                      delivered on the matching Turn message.
                    required: true
                  - name: words
                    type: array
                    description: >-
                      Words with corrected per-word `speaker` assignments. Text
                      and timestamps match the original Turn — only the
                      `speaker` field may change.
                    required: true
                    properties:
                      - name: text
                        type: string
                        description: The word text (unchanged from the original Turn).
                        required: true
                      - name: speaker
                        type: string
                        description: >-
                          The revised speaker label for this word (e.g. `A`,
                          `B`, `UNKNOWN`).
                        required: true
                      - name: start
                        type: integer
                        description: >-
                          Start time of the word in milliseconds from the start
                          of the session.
                        required: true
                      - name: end
                        type: integer
                        description: >-
                          End time of the word in milliseconds from the start of
                          the session.
                        required: true
        headers: []
        jsonPayloadSchema:
          type: object
          description: >-
            Sent at the end of a streaming session when `speaker_labels` is
            enabled, and additionally during the session when
            `speaker_labels_revision_interval_ms` is set. Contains corrections
            for any turns whose speaker labels changed since the previous
            message. Text content and word timestamps are never changed — only
            speaker assignments.
          properties:
            type:
              type: string
              const: SpeakerRevision
              description: Identifies the type of the message.
              x-parser-schema-id: <anonymous-schema-84>
            revisions:
              type: array
              description: >-
                Array of turn corrections. Only turns whose speaker labels
                changed are included.
              items:
                type: object
                properties:
                  turn_order:
                    type: integer
                    description: >-
                      Matches the `turn_order` of the original Turn message
                      being corrected.
                    x-parser-schema-id: <anonymous-schema-87>
                  speaker_label:
                    type: string
                    nullable: true
                    description: >-
                      The corrected turn-level speaker label (e.g. `A`, `B`,
                      `UNKNOWN`). Replaces the `speaker_label` originally
                      delivered on the matching Turn message.
                    x-parser-schema-id: <anonymous-schema-88>
                  words:
                    type: array
                    description: >-
                      Words with corrected per-word `speaker` assignments. Text
                      and timestamps match the original Turn — only the
                      `speaker` field may change.
                    items:
                      type: object
                      properties:
                        text:
                          type: string
                          description: The word text (unchanged from the original Turn).
                          x-parser-schema-id: <anonymous-schema-91>
                        speaker:
                          type: string
                          description: >-
                            The revised speaker label for this word (e.g. `A`,
                            `B`, `UNKNOWN`).
                          x-parser-schema-id: <anonymous-schema-92>
                        start:
                          type: integer
                          description: >-
                            Start time of the word in milliseconds from the
                            start of the session.
                          x-parser-schema-id: <anonymous-schema-93>
                        end:
                          type: integer
                          description: >-
                            End time of the word in milliseconds from the start
                            of the session.
                          x-parser-schema-id: <anonymous-schema-94>
                      required:
                        - text
                        - speaker
                        - start
                        - end
                      x-parser-schema-id: <anonymous-schema-90>
                    x-parser-schema-id: <anonymous-schema-89>
                required:
                  - turn_order
                  - speaker_label
                  - words
                x-parser-schema-id: <anonymous-schema-86>
              x-parser-schema-id: <anonymous-schema-85>
          required:
            - type
            - revisions
          x-parser-schema-id: SpeakerRevisionPayload
        title: Revised Speaker Labels
        description: >-
          Server message containing corrected speaker labels for any turns that
          changed. When `speaker_labels` is enabled, a final message is emitted
          after the client sends `Terminate`; setting
          `speaker_labels_revision_interval_ms` adds further messages during the
          session. A session may therefore produce one or many `SpeakerRevision`
          messages, each listing only the turns changed since the previous one.
          See [Revised speaker
          labels](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels#revised-speaker-labels)
          for details.
        example: |-
          {
            "type": "SpeakerRevision",
            "revisions": [
              {
                "turn_order": 3,
                "speaker_label": "B",
                "words": [
                  {
                    "text": "Hello",
                    "speaker": "B",
                    "start": 1200,
                    "end": 1450
                  },
                  {
                    "text": "there.",
                    "speaker": "B",
                    "start": 1450,
                    "end": 1780
                  }
                ]
              },
              {
                "turn_order": 7,
                "speaker_label": "A",
                "words": [
                  {
                    "text": "Got it.",
                    "speaker": "A",
                    "start": 4100,
                    "end": 4520
                  }
                ]
              }
            ]
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: speakerRevision
    bindings: []
    extensions: *ref_0
  - &ref_10
    id: sessionTermination
    title: Session termination
    description: Receive confirmation that the session has been terminated by the server.
    type: send
    messages:
      - &ref_22
        id: termination
        contentType: application/json
        payload:
          - name: Session Terminated (Server Confirmation)
            description: >-
              Server message confirming session termination with session
              statistics.
            type: object
            properties:
              - name: type
                type: string
                description: Indicates the session has been terminated.
                required: true
              - name: audio_duration_seconds
                type: integer
                description: Duration of the audio in seconds.
                required: true
              - name: session_duration_seconds
                type: integer
                description: Duration of the session in seconds.
                required: true
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: Termination
              description: Indicates the session has been terminated.
              x-parser-schema-id: <anonymous-schema-95>
            audio_duration_seconds:
              type: integer
              description: Duration of the audio in seconds.
              x-parser-schema-id: <anonymous-schema-96>
            session_duration_seconds:
              type: integer
              description: Duration of the session in seconds.
              x-parser-schema-id: <anonymous-schema-97>
          required:
            - type
            - audio_duration_seconds
            - session_duration_seconds
          x-parser-schema-id: TerminationPayload
        title: Session Terminated (Server Confirmation)
        description: Server message confirming session termination with session statistics.
        example: |-
          {
            "type": "Termination",
            "audio_duration_seconds": 45,
            "session_duration_seconds": 47
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: termination
    bindings: []
    extensions: *ref_0
  - &ref_11
    id: heartbeat
    title: Heartbeat
    description: >-
      Receive a periodic liveness message. Emitted every 5 seconds of wall-clock
      time for the life of the session when `session_heartbeat` is enabled,
      during both speech and silence.
    type: send
    messages:
      - &ref_23
        id: heartbeat
        contentType: application/json
        payload:
          - name: Heartbeat
            description: >-
              Server liveness message sent at a fixed interval when
              `session_heartbeat` is enabled.
            type: object
            properties:
              - name: type
                type: string
                description: Identifies the type of the message.
                required: true
              - name: total_audio_received_ms
                type: integer
                description: >-
                  Total audio received since the session started, in
                  milliseconds.
                required: true
              - name: total_duration_ms
                type: integer
                description: Wall-clock time since the session started, in milliseconds.
                required: true
              - name: realtime_factor
                type: number
                description: >-
                  Ratio of audio received to wall-clock time over the window
                  since the previous heartbeat. Around 1.0 when the client
                  streams in real time, and below 1.0 when the client is
                  under-delivering audio.
                required: true
              - name: max_speech_probability
                type: number
                description: >-
                  Maximum voice-activity speech probability observed since the
                  previous heartbeat. Near 1.0 during speech and near 0.0 during
                  silence.
                required: true
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: Heartbeat
              description: Identifies the type of the message.
              x-parser-schema-id: <anonymous-schema-98>
            total_audio_received_ms:
              type: integer
              format: ms
              description: Total audio received since the session started, in milliseconds.
              x-parser-schema-id: <anonymous-schema-99>
            total_duration_ms:
              type: integer
              format: ms
              description: Wall-clock time since the session started, in milliseconds.
              x-parser-schema-id: <anonymous-schema-100>
            realtime_factor:
              type: number
              format: float
              description: >-
                Ratio of audio received to wall-clock time over the window since
                the previous heartbeat. Around 1.0 when the client streams in
                real time, and below 1.0 when the client is under-delivering
                audio.
              x-parser-schema-id: <anonymous-schema-101>
            max_speech_probability:
              type: number
              format: float
              minimum: 0
              maximum: 1
              description: >-
                Maximum voice-activity speech probability observed since the
                previous heartbeat. Near 1.0 during speech and near 0.0 during
                silence.
              x-parser-schema-id: <anonymous-schema-102>
          required:
            - type
            - total_audio_received_ms
            - total_duration_ms
            - realtime_factor
            - max_speech_probability
          x-parser-schema-id: HeartbeatPayload
        title: Heartbeat
        description: >-
          Server liveness message sent at a fixed interval when
          `session_heartbeat` is enabled.
        example: |-
          {
            "type": "Heartbeat",
            "total_audio_received_ms": 45000,
            "total_duration_ms": 45205,
            "realtime_factor": 0.9964,
            "max_speech_probability": 0.999954
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: heartbeat
    bindings: []
    extensions: *ref_0
  - &ref_12
    id: llmGatewayResponse
    title: Llm gateway response
    description: >-
      Receive an LLM Gateway response for a finalized turn. Emitted once per
      turn when `llm_gateway` is configured on the connection.
    type: send
    messages:
      - &ref_24
        id: llmGatewayResponse
        contentType: application/json
        payload:
          - name: LLM Gateway Response
            description: >-
              Server message containing an LLM Gateway response for a finalized
              turn.
            type: object
            properties:
              - name: type
                type: string
                description: Identifies the type of the message.
                required: true
              - name: turn_order
                type: integer
                description: >-
                  The order of the finalized turn that triggered the LLM Gateway
                  call.
                required: true
              - name: transcript
                type: string
                description: >-
                  The finalized turn transcript that triggered the LLM Gateway
                  call.
                required: true
              - name: data
                type: object
                description: The chat completions response from the LLM Gateway.
                required: true
                properties:
                  - name: request_id
                    type: string
                    description: Unique identifier for the LLM Gateway request.
                    required: false
                  - name: choices
                    type: array
                    description: Array of completion choices returned by the model.
                    required: false
                    properties:
                      - name: index
                        type: integer
                        description: The index of the choice in the response.
                        required: false
                      - name: message
                        type: object
                        required: false
                        properties:
                          - name: role
                            type: string
                            required: false
                          - name: content
                            type: string
                            description: >-
                              The text content of the model's response. Null
                              when only tool_calls are present.
                            required: false
                          - name: tool_calls
                            type: array
                            description: >-
                              Tool calls requested by the model. Present when
                              the model invokes tools.
                            required: false
                            properties:
                              - name: id
                                type: string
                                description: Unique identifier for the tool call.
                                required: true
                              - name: type
                                type: string
                                enumValues:
                                  - function
                                required: true
                              - name: function
                                type: object
                                required: true
                                properties:
                                  - name: name
                                    type: string
                                    description: The name of the function to call.
                                    required: true
                                  - name: arguments
                                    type: string
                                    description: >-
                                      The arguments to call the function with,
                                      as a JSON-formatted string.
                                    required: true
                      - name: finish_reason
                        type: string
                        description: The reason the model stopped generating tokens.
                        required: false
                  - name: usage
                    type: object
                    description: Token usage statistics for the request.
                    required: false
                    properties:
                      - name: input_tokens
                        type: integer
                        description: Number of tokens in the prompt.
                        required: false
                      - name: output_tokens
                        type: integer
                        description: Number of tokens in the completion.
                        required: false
                      - name: total_tokens
                        type: integer
                        description: Total tokens used (prompt + completion).
                        required: false
                      - name: prompt_tokens_details
                        type: object
                        description: Detailed breakdown of prompt token usage.
                        required: false
                        properties: []
                      - name: completion_tokens_details
                        type: object
                        description: Detailed breakdown of completion token usage.
                        required: false
                        properties: []
                  - name: request
                    type: object
                    description: >-
                      A copy of the original request, excluding `prompt` and
                      `messages`.
                    required: false
                    properties: []
                  - name: response_time
                    type: integer
                    description: The response time in nanoseconds.
                    required: false
                  - name: llm_status_code
                    type: integer
                    description: The status code from the LLM provider.
                    required: false
        headers: []
        jsonPayloadSchema:
          type: object
          properties:
            type:
              type: string
              const: LLMGatewayResponse
              description: Identifies the type of the message.
              x-parser-schema-id: <anonymous-schema-103>
            turn_order:
              type: integer
              description: >-
                The order of the finalized turn that triggered the LLM Gateway
                call.
              x-parser-schema-id: <anonymous-schema-104>
            transcript:
              type: string
              description: >-
                The finalized turn transcript that triggered the LLM Gateway
                call.
              x-parser-schema-id: <anonymous-schema-105>
            data:
              type: object
              description: The chat completions response from the LLM Gateway.
              required: []
              properties:
                request_id:
                  type: string
                  format: uuid
                  description: Unique identifier for the LLM Gateway request.
                  x-parser-schema-id: <anonymous-schema-107>
                choices:
                  type: array
                  items:
                    type: object
                    required: []
                    properties:
                      index:
                        type: integer
                        description: The index of the choice in the response.
                        x-parser-schema-id: <anonymous-schema-110>
                      message:
                        type: object
                        required: []
                        properties:
                          role:
                            type: string
                            x-parser-schema-id: <anonymous-schema-112>
                          content:
                            type: string
                            description: >-
                              The text content of the model's response. Null
                              when only tool_calls are present.
                            x-parser-schema-id: <anonymous-schema-113>
                          tool_calls:
                            type: array
                            items:
                              type: object
                              properties:
                                id:
                                  type: string
                                  description: Unique identifier for the tool call.
                                  x-parser-schema-id: <anonymous-schema-116>
                                type:
                                  type: string
                                  enum:
                                    - function
                                  x-parser-schema-id: <anonymous-schema-117>
                                function:
                                  type: object
                                  properties:
                                    name:
                                      type: string
                                      description: The name of the function to call.
                                      x-parser-schema-id: <anonymous-schema-119>
                                    arguments:
                                      type: string
                                      description: >-
                                        The arguments to call the function with,
                                        as a JSON-formatted string.
                                      x-parser-schema-id: <anonymous-schema-120>
                                  required:
                                    - name
                                    - arguments
                                  x-parser-schema-id: <anonymous-schema-118>
                              required:
                                - id
                                - type
                                - function
                              x-parser-schema-id: <anonymous-schema-115>
                            description: >-
                              Tool calls requested by the model. Present when
                              the model invokes tools.
                            x-parser-schema-id: <anonymous-schema-114>
                        x-parser-schema-id: <anonymous-schema-111>
                      finish_reason:
                        type: string
                        description: The reason the model stopped generating tokens.
                        x-parser-schema-id: <anonymous-schema-121>
                    x-parser-schema-id: <anonymous-schema-109>
                  description: Array of completion choices returned by the model.
                  x-parser-schema-id: <anonymous-schema-108>
                usage:
                  type: object
                  description: Token usage statistics for the request.
                  required: []
                  properties:
                    input_tokens:
                      type: integer
                      description: Number of tokens in the prompt.
                      x-parser-schema-id: <anonymous-schema-123>
                    output_tokens:
                      type: integer
                      description: Number of tokens in the completion.
                      x-parser-schema-id: <anonymous-schema-124>
                    total_tokens:
                      type: integer
                      description: Total tokens used (prompt + completion).
                      x-parser-schema-id: <anonymous-schema-125>
                    prompt_tokens_details:
                      type: object
                      additionalProperties: true
                      required: []
                      properties: {}
                      description: Detailed breakdown of prompt token usage.
                      x-parser-schema-id: <anonymous-schema-126>
                    completion_tokens_details:
                      type: object
                      additionalProperties: true
                      required: []
                      properties: {}
                      description: Detailed breakdown of completion token usage.
                      x-parser-schema-id: <anonymous-schema-127>
                  x-parser-schema-id: <anonymous-schema-122>
                request:
                  type: object
                  additionalProperties: true
                  required: []
                  properties: {}
                  description: >-
                    A copy of the original request, excluding `prompt` and
                    `messages`.
                  x-parser-schema-id: <anonymous-schema-128>
                response_time:
                  type: integer
                  description: The response time in nanoseconds.
                  x-parser-schema-id: <anonymous-schema-129>
                llm_status_code:
                  type: integer
                  description: The status code from the LLM provider.
                  x-parser-schema-id: <anonymous-schema-130>
              x-parser-schema-id: <anonymous-schema-106>
          required:
            - type
            - turn_order
            - transcript
            - data
          x-parser-schema-id: LLMGatewayResponsePayload
        title: LLM Gateway Response
        description: >-
          Server message containing an LLM Gateway response for a finalized
          turn.
        example: |-
          {
            "type": "LLMGatewayResponse",
            "turn_order": 0,
            "transcript": "Hello world.",
            "data": {
              "request_id": "3c90c3cc-0d44-4b50-8888-8dd25736052a",
              "choices": [
                {
                  "index": 0,
                  "message": {
                    "role": "assistant",
                    "content": "Hello! How can I help?"
                  },
                  "finish_reason": "stop"
                }
              ],
              "usage": {
                "input_tokens": 12,
                "output_tokens": 8,
                "total_tokens": 20,
                "prompt_tokens_details": {},
                "completion_tokens_details": {}
              },
              "request": {},
              "response_time": 123456789
            }
          }
        bindings: []
        extensions:
          - id: x-parser-unique-object-id
            value: llmGatewayResponse
    bindings: []
    extensions: *ref_0
sendOperations:
  - *ref_1
  - *ref_2
  - *ref_3
  - *ref_4
  - *ref_5
receiveOperations:
  - *ref_6
  - *ref_7
  - *ref_8
  - *ref_9
  - *ref_10
  - *ref_11
  - *ref_12
sendMessages:
  - *ref_13
  - *ref_14
  - *ref_15
  - *ref_16
  - *ref_17
receiveMessages:
  - *ref_18
  - *ref_19
  - *ref_20
  - *ref_21
  - *ref_22
  - *ref_23
  - *ref_24
extensions:
  - id: x-parser-unique-object-id
    value: streaming
securitySchemes: []

````