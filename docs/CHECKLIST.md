# Murder Mystery Hotline: build checklist

Everything left to ship by **Thu Oct 22, 11:59 p.m.** (submit Fri Oct 23). Priorities:
- **P0** — the game doesn't work or can't be submitted without it.
- **P1** — the game is weak without it.
- **P2** — polish; cut it first if a day slips.

Source of truth for decisions: [plan.md](plan.md). Ticked items are done and on `main` unless marked *(uncommitted)*.

---

## 0. Decisions and outside asks

- [x] **P0** Decide the TTS socket design: **one reusable socket per voice per call**. Chosen because the account allows only ~5 new TTS sessions per minute.
- [ ] **P0** Ask the organizers, in a channel you can post in:
  - the exact submission cutoff and time zone;
  - raised TTS limits (3 concurrent sessions, about 5 new sessions per minute);
  - more LLM Gateway models (only `qwen3.5-4b-32k-fast` works for this account).
- [ ] **P0** Rotate the API key that was pasted into chat (dashboard → API Keys), then update `.env`.
- [ ] **P1** Confirm the judging criteria. Until confirmed, assume lablab's: Application of Technology, Presentation, Business Value, Originality.

## 1. Backend

**Done**
- [x] Protocol: messages and utterance-tagged audio frames.
- [x] Engine: case schema and validator, reply splitter, and the game rules (clue gating, nerves, confession, hints, verdict, stars).
- [x] Server session: STT → LLM → TTS, barge-in, fallbacks, hang-ups, narration.
- [x] Adapters: Streaming STT v3, streaming TTS (protocol verified), LLM Gateway.
- [x] Limits:
  - admission per IP and globally;
  - calls per game and a minimum gap between dials;
  - 5-minute calls and a push-to-talk audio cap;
  - idle close and a CSP.
- [x] Resume after refresh or disconnect (10 minutes).
- [x] Every code-review finding fixed.
- [x] TTS retries a refused session, and a stray rejection is logged instead of crashing the server.
- [x] TTS socket reuse: one line per voice per call, `Cancel` without stale audio, transparent reconnect.

**To do**
- [x] **P1** Expressive characters:
  - [x] Reply splitter turns sound cues into spellings the TTS performs (`[sighs]`→"Haah…", `[laughs]`→"Ha! Ha ha.", `[chuckles]`→"Heh heh."), drops every other bracket, and keeps at most one cue per reply. The TTS reads bracket tags aloud; see [tts-markup.md](reference/assemblyai/tts-markup.md). *(uncommitted)*
  - [x] Case schema: a per-character `speech` block (tone, verbal habits, filler words, signature phrases, preferred tags), with tags checked by the validator.
  - [x] Prompt: a "how you talk" section, and delivery that changes with nerves (smooth, then slipping, then false starts); a signature phrase isn't offered again once it's been used.
  - [x] Speech styles written for Doyle, Evelyn, Leo and Riley.
  - [x] ~~Finish the tag probe~~: moot, the TTS supports no tags at all (Kyutai Pocket TTS takes plain text only).
- [ ] **P1** The small suspect model (`qwen3.5-4b-32k-fast`, the only Gateway model this account can use) invents details ("a voltage spike at the break-room junction") and reuses lines from its own history. Get access to a bigger model through the organizers, or try a lower temperature and a stricter "deflect, don't invent" rule.
- [x] **P1** Mrs. Hale reads the briefing aloud when a case opens (pre-rendered by `tools/render-narration.ts`, drives the intro cuts). *(uncommitted)*
- [ ] **P1** Model reliability check:
  - META stays valid over 20 or more turns;
  - hang-ups, the confession and hints all trigger;
  - prompt-injection attempts ("ignore your instructions") fail.
- [ ] **P1** AI playtester: text-only, 10 runs, reporting solve rate, questions used and rarely found clues. At most 2 hours.
- [ ] **P2** Log the Gateway `request_id` and per-turn latency (question → first audio).
- [x] **P1** Reply splitter treats a bare JSON block as META (the small model sometimes drops `###META`, and the JSON was spoken aloud). *(uncommitted)*
- [x] **P2** Deleted the throwaway `PROTOTYPE-*` files and the Plan B Voice Agent probes (in git history). *(uncommitted)*

## 2. Frontend (`apps/web`, replaces the test bench)

- [x] **P0** App shell: Vite, React and Zustand, plus the game-socket client with `hello`/resume. *(uncommitted; plan in [frontend-plan.md](frontend-plan.md))*
- [ ] **P0** Audio:
  - [x] Mic worklet: resample to 16 kHz inside the worklet (needed for Safari and Firefox), hold-to-talk on Space and an on-screen button, and barge-in. Not yet tried with a real mic.
  - [x] Playback: a ring buffer that drops stale utterance IDs, plus the phone-line filter, toned down a little.
  - [x] The "Pick up the receiver" click unlocks audio; mic denied falls back to typing.
- [x] **P0** Game screen:
  - call panel with live captions;
  - nerves meter;
  - notebook;
  - typed question box;
  - error and busy states.
- [x] **P0** Accusation screen (choose a suspect, tick evidence), then the verdict with stars and Mrs. Hale's ending.
- [x] **P1** Pixi switchboard scene: jacks, lamps, patch cords, a lit line during a call.
- [x] **P1** Captions synced word by word, in the intro and in calls. The TTS adapter's word timings were fixed twice: the last flush's timings were dropped, and reused-socket timings were offset (word times are connection-wide). *(uncommitted)*
- [x] **P1** Sound effects (synthesised with Web Audio, no Howler): dial clicks, ring, receiver up and down, the busy crackle, room tone, rain.
- [x] **P1** Intro: six acts introducing the victim, the scene and each suspect, with leads at the end; narration spliced line by line with directed pauses; Next/Skip. *(uncommitted)*
- [ ] **P1** Art: code-drawn placeholders are in. Generate the 18 painted images from [cases/night-operator/art/PROMPTS.md](../cases/night-operator/art/PROMPTS.md); they load automatically.
- [ ] **P1** Accessibility:
  - every control works from the keyboard, with visible focus;
  - captions on by default;
  - `prefers-reduced-motion` respected.
- [x] **P2** Layout works on a laptop and a tablet (notebook becomes a drawer below 1000 px).
- [ ] **P2** Case board / title screen with a case picker.

## 3. Content

- [x] Case 1, "The Night Operator": four suspects, key clues, hints, three endings.
- [x] **P1** Speech styles for Doyle, Evelyn, Leo and Riley.
- [ ] **P1** Re-cast voices once you've heard them in context, and add a tag or two to Mrs. Hale's scripted lines.
- [ ] **P1** Balance from playtests: clue gates, nerve thresholds, hint order, question budget.
- [ ] **P2** Mini Case 2, "Dead Air" (1986): two suspects, no cinematic. Only if Day 5 is on track.

## 4. Testing

- [ ] **P0** Browsers: Chrome, Safari and Firefox, covering mic permission, echo, barge-in and resume.
- [ ] **P0** End-to-end latency stays at or under 1.5 s from releasing talk to the first sound.
- [ ] **P1** Three human playtests with people who haven't seen the case. Watch quietly and note where they get stuck.
- [ ] **P1** Concurrency: two or three players at once stay under the TTS limits.

## 5. Deploy

- [ ] **P0** Dockerfile and `fly.toml`: region `iad`, one always-on machine, health check on `/health`.
- [ ] **P0** Fly secrets: `ASSEMBLYAI_API_KEY`, `SUSPECT_MODEL`.
- [ ] **P0** Smoke-test the deployed URL from a second device.
- [ ] **P2** Watch spend on the AssemblyAI dashboard during judging.

## 6. Submission

- [ ] **P0** Repo: add an MIT `LICENSE`, make it public at submission time (lablab requires a public repo), and scrub `.env` and `probe-out/` (already git-ignored).
- [ ] **P0** README: what it is, how to run it, the architecture diagram, the AssemblyAI products used, and the TTS protocol notes.
- [ ] **P0** 2-minute demo video:
  - the intro;
  - a live interrogation in which a clue lands;
  - pressure, then a slip;
  - a barge-in;
  - a prompt injection that gets shrugged off;
  - the verdict;
  - the architecture.
- [ ] **P0** Slides:
  - the problem and the pitch ("voice role-play training engine");
  - a TTS showcase (voices, acted tags, ~0.5 s to first audio);
  - the architecture;
  - playtest statistics;
  - Business Value.
- [ ] **P1** Cover image.
- [ ] **P0** Submit the Google Form before the cutoff.

---

**If a day slips, cut in this order:**
1. case board polish;
2. Case 2;
3. reduced-motion extras;
4. the intro cinematic (open straight on the switchboard with narration only).

Never cut the typed fallback, the error handling, or the TTS session reuse.
