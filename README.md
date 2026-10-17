# Murder Mystery Hotline

A voice-driven 1947 detective game built on the AssemblyAI Voice Agent API. Plan: [docs/plan.md](docs/plan.md).

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in ASSEMBLYAI_API_KEY
```

## Day 1 probes

**Probe A** uses AssemblyAI's managed model. It records two voices, measures reply latency, and checks token minting:

```bash
pnpm probe:agent
```

**Probe B** puts our own LLM endpoint in the loop. It needs a public HTTPS URL, so run `ngrok http 8787` in another terminal first. Then put the ngrok URL in `PUBLIC_URL` and a random string in `LLM_ENDPOINT_SECRET` (`openssl rand -hex 24`).

```bash
pnpm probe:llm             # stub replies: logs what AssemblyAI sends us
pnpm probe:llm --gateway   # real replies from the LLM Gateway
```

Output goes to `probe-out/`: a WAV per voice, a JSON summary, and `llm-requests.jsonl`.

## Checks

```bash
pnpm typecheck && pnpm test
```
