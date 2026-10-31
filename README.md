# Murder Mystery Hotline

A voice-driven 1947 detective game built on the AssemblyAI Voice Agent API. Plan: [docs/plan.md](docs/plan.md).

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in ASSEMBLYAI_API_KEY
```

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
