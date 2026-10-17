// Day 1 probe A: managed-LLM Voice Agent sessions, one per voice.
// Answers: do voices sound distinct, what does the event stream look like, how fast is a reply,
// and can we mint browser tokens on this account.
//
//   pnpm probe:agent              # voices george + vera
//   pnpm probe:agent mary charles # any voice ids
import { writeFileSync, mkdirSync } from "node:fs";
import { askTyped, requireEnv, VA_REST_URL, VoiceAgentSession } from "./va-client.js";

const apiKey = requireEnv("ASSEMBLYAI_API_KEY");
const voices = process.argv.slice(2).length ? process.argv.slice(2) : ["george", "vera"];

const SYSTEM_PROMPT = [
  "You are Rosa Vance, a hat-check girl at the Blue Lantern nightclub in 1947.",
  "A detective is phoning you about last night's murder. Stay in character.",
  "Speak one to three short sentences. No stage directions, no lists.",
].join(" ");

const QUESTIONS = [
  "Miss Vance, where were you at eleven o'clock last night?",
  "Did you see anyone go into the back office?",
];

async function probeVoice(voice: string) {
  const session = new VoiceAgentSession(apiKey, voice);
  await session.opened();
  const tOpen = session.now();
  session.send({
    type: "session.update",
    session: { system_prompt: SYSTEM_PROMPT, output: { voice } },
  });
  await session.waitFor("session.ready");
  const sessionReadyMs = Math.round(session.now() - tOpen);
  const turns = [];
  for (const q of QUESTIONS) turns.push(await askTyped(session, q));
  await session.end();
  session.writeWav(`probe-out/${voice}.wav`);
  return { voice, sessionReadyMs, turns, eventTypes: [...new Set(session.events.map((e) => e.event.type))] };
}

async function probeToken() {
  const url = new URL(`${VA_REST_URL}/token`);
  url.searchParams.set("expires_in_seconds", "60");
  url.searchParams.set("max_session_duration_seconds", "300");
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const limits = Object.fromEntries([...res.headers].filter(([k]) => /rate|limit|retry/i.test(k)));
  return { status: res.status, gotToken: typeof body.token === "string", expiresIn: body.expires_in_seconds, limits };
}

const results = { at: new Date().toISOString(), token: await probeToken(), voices: [] as unknown[] };
for (const voice of voices) {
  try {
    results.voices.push(await probeVoice(voice));
  } catch (err) {
    results.voices.push({ voice, error: (err as Error).message });
  }
}

mkdirSync("probe-out", { recursive: true });
writeFileSync("probe-out/voice-agent.json", JSON.stringify(results, null, 2));
console.log("\n=== summary ===");
console.log(JSON.stringify(results, null, 2));
console.log("\nAudio: probe-out/<voice>.wav  Full results: probe-out/voice-agent.json");
