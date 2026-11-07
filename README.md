# Murder Mystery Hotline

A detective game you play by voice. A switchboard operator has been strangled with a patch cord at 1:40 a.m. You sit at her board in a 1947 telephone exchange, phone the suspects, and question them out loud. Each suspect answers live in their own voice, gets more nervous under pressure, and the guilty one eventually slips. Collect the key clues, name the killer, and get your verdict.

Built for AssemblyAI's Voice Hackathon Week (October 2026), on the **AssemblyAI TTS API**.

**Play it:** https://murder-mystery-hotline.fly.dev (Chrome, headphones recommended).

## How it works

```
 Browser (React + PixiJS)                Server (Fastify)                         AssemblyAI
 ────────────────────────                ────────────────                         ──────────
 hold Space / talk button ──mic PCM──▶   session ──audio──────────────────────▶   Streaming STT v3
                                            │      ◀─────────── transcript ───
                                            ▼
                                         game engine (clue gating, nerves,
                                         truth tiers, confession, verdict)
                                            │      ──prompt──────────────────▶    LLM Gateway
                                            │      ◀────── streamed tokens ───    (qwen3.5-4b-32k-fast)
                                            ▼
                                         reply splitter (sentences)
                                            │      ──Generate / Flush────────▶    Streaming TTS
 speaker + captions  ◀──audio + words──     │      ◀──── audio + word times ──    (AssemblyAI-TTS-1)
```

Everything runs over one browser WebSocket (`/game`). The API key stays on the server.

- **About 0.5 s from question to first audio.** LLM tokens are split into sentences and each sentence goes to TTS as soon as it's complete.
- **Five voices.** Mrs. Hale the narrator (`anna`), Frank Doyle (`george`), Evelyn Ashford (`vera`), Leo Brandt (`michael`) and Officer Tom Riley (`jean`).
- **One reusable TTS socket per voice per call.** Many Generate/Flush rounds share one socket, and KeepAlive goes out every 60 s so a quiet line isn't dropped. This keeps us under the limit of about 5 new sessions per minute.
- **Barge-in.** Talking over a suspect sends TTS `Cancel`. Each reply has an utterance ID, and the browser drops stale audio.
- **Captions** come from TTS word timings.
- **Acted delivery.** Bracket tags like `[sighs]` are read aloud, so the engine writes performed spellings instead ("Haah...", "Heh heh."). As nerves rise, delivery shifts to false starts, stutters and trailing off.
- **The engine controls what suspects know.** Locked clues never reach the prompt, so a prompt injection gets shrugged off in character.

TTS protocol notes: [docs/reference/assemblyai/tts-protocol.md](docs/reference/assemblyai/tts-protocol.md). Design decisions: [docs/plan.md](docs/plan.md).

## Repo layout

| Path | What |
| --- | --- |
| `apps/server` | Fastify server: game sessions, STT / LLM / TTS adapters, serves the web build (test bench at `/bench`) |
| `apps/web` | React + Zustand + PixiJS frontend |
| `packages/engine` | Game rules, case schema and validator, prompts, reply splitter |
| `packages/protocol` | Zod schemas for browser ↔ server messages |
| `cases/night-operator` | Case 1, "The Night Operator": case JSON, art, intro narration |
| `tools` | Narration renderer and the TTS markup probe |

New scenarios are just case files. The engine needs no code changes.

## Run it

Needs Node 22+, pnpm and an AssemblyAI API key.

```bash
pnpm install
cp .env.example .env   # set ASSEMBLYAI_API_KEY (SUSPECT_MODEL defaults to qwen3.5-4b-32k-fast)
```

In two terminals:

```bash
pnpm dev:server        # http://localhost:8787
pnpm dev:web           # http://localhost:5173, proxies /game and /cases to the server
```

Open http://localhost:5173 in Chrome, allow the microphone, and hold Space to talk. A typed box works without a mic.

## Tools

```bash
pnpm narration                                   # re-render Mrs. Hale's intro after editing case.json
pnpm tsx --env-file=.env tools/probe-tts-markup.ts tools/tts-markup-candidates.json anna
                                                 # does the TTS perform or read a spelling? (transcribes its audio)
```

## Checks

```bash
pnpm typecheck && pnpm test
```

## License

[MIT](LICENSE)
