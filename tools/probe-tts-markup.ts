// Feedback loop for TTS markup: render each candidate, transcribe the audio with AssemblyAI STT,
// and report whether any of the markup's words were SPOKEN, plus the longest silence (for pauses).
//   pnpm tsx --env-file=.env tools/probe-tts-markup.ts <candidates.json> [voice ...]
// candidates.json: [{ "name": "...", "text": "...", "leak": ["sigh"], "query": { "k": "v" } }]
//   leak  = words that must NOT appear in the transcript if the markup is performed, not read.
//   query = optional extra query-string parameters for the TTS connection.
// TTS_LEGACY=1 targets the pre-launch host (streaming-tts, voice=); default is TTS-1 (voice_id=aai-*).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import WebSocket from "ws";
import { join } from "node:path";
import { wav } from "./wav.js";

type Candidate = { name: string; text: string; leak: string[]; query?: Record<string, string> };
const KEY = process.env.ASSEMBLYAI_API_KEY!;
const OUT = join(import.meta.dirname, "..", "probe-out", "markup-loop");
mkdirSync(OUT, { recursive: true });
const candidates = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as Candidate[];
const voices = process.argv.slice(3).length ? process.argv.slice(3) : ["anna"];
const RATE = 24_000;

/** One raw TTS session (so arbitrary query parameters can be tried). Returns PCM or an error. */
function render(voice: string, text: string, query: Record<string, string> = {}): Promise<Buffer> {
  const legacy = process.env.TTS_LEGACY === "1";
  const qs = new URLSearchParams({ ...(legacy ? { voice } : { voice_id: `aai-${voice}` }), sample_rate: String(RATE), ...query });
  const host = legacy ? "wss://streaming-tts.assemblyai.com/v1/ws" : "wss://tts.us.assemblyai.com/v1/ws";
  const ws = new WebSocket(`${host}?${qs}`, { headers: { authorization: KEY } });
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => (ws.terminate(), reject(new Error("timeout"))), 30_000);
    ws.on("message", (raw) => {
      const f = JSON.parse(raw.toString());
      if (f.type === "Begin") {
        ws.send(JSON.stringify({ type: "Generate", text }));
        ws.send(JSON.stringify({ type: "Flush" }));
      } else if (f.type === "Audio") chunks.push(Buffer.from(f.audio, "base64"));
      else if (f.type === "FlushDone") {
        clearTimeout(timer);
        ws.send(JSON.stringify({ type: "Terminate" }));
        setTimeout(() => ws.close(), 200);
        resolve(Buffer.concat(chunks));
      } else if (f.type === "Error") {
        clearTimeout(timer);
        reject(new Error(`${f.error_code}: ${f.error}`));
      }
    });
    ws.on("error", (e) => (clearTimeout(timer), reject(e)));
  });
}

async function transcribe(audio: Buffer): Promise<string> {
  const up = await fetch("https://api.assemblyai.com/v2/upload", { method: "POST", headers: { authorization: KEY }, body: new Uint8Array(audio) });
  const { upload_url } = (await up.json()) as { upload_url: string };
  const job = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: KEY, "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, disfluencies: true }),
  });
  const { id } = (await job.json()) as { id: string };
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const r = (await (await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, { headers: { authorization: KEY } })).json()) as { status: string; text: string; error?: string };
    if (r.status === "completed") return r.text ?? "";
    if (r.status === "error") throw new Error(r.error);
  }
}

/** Longest run of near-silence, in ms. */
function longestSilence(pcm: Buffer): number {
  let run = 0;
  let best = 0;
  const win = RATE / 100; // 10 ms windows
  for (let i = 0; i + win * 2 <= pcm.length / 2; i += win) {
    let peak = 0;
    for (let j = 0; j < win; j++) peak = Math.max(peak, Math.abs(pcm.readInt16LE((i + j) * 2)));
    run = peak < 600 ? run + 10 : 0;
    best = Math.max(best, run);
  }
  return best;
}

let sessions = 0;
for (const voice of voices) {
  for (const c of candidates) {
    if (sessions && sessions % 4 === 0) await new Promise((r) => setTimeout(r, 62_000)); // ~5 new sessions/min
    sessions++;
    try {
      const pcm = await render(voice, c.text, c.query);
      writeFileSync(`${OUT}/${voice}-${c.name}.wav`, wav(pcm, RATE));
      const heard = await transcribe(wav(pcm, RATE));
      const leaked = c.leak.filter((w) => new RegExp(`\\b${w}`, "i").test(heard));
      const verdict = c.leak.length === 0 ? "control" : leaked.length ? `READ ALOUD (${leaked.join(",")})` : "not spoken";
      console.log(`${voice.padEnd(5)} ${c.name.padEnd(18)} ${verdict.padEnd(26)} ${(pcm.length / 2 / RATE).toFixed(1)}s  gap ${longestSilence(pcm)}ms  "${heard}"`);
    } catch (e) {
      console.log(`${voice.padEnd(5)} ${c.name.padEnd(18)} ERROR ${(e as Error).message}`);
    }
  }
}
process.exit(0);
