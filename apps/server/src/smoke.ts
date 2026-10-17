// Smoke test against a running server: plays typed turns with the real AssemblyAI stack and
// reports latency per turn. Usage: start the server, then pnpm smoke ["question" | "q1|q2|q3"]
import WebSocket from "ws";
import { decodeAudioFrame } from "@mmh/protocol";

const questions = (process.argv.slice(2).join(" ") || "Mr. Doyle, where were you between one and two this morning?").split("|");
let turn = 0;
const ws = new WebSocket(process.env.SMOKE_URL ?? "ws://localhost:8787/game");
const t0 = { ask: 0 };
let firstAudio: number | null = null;
let audioBytes = 0;
const lines: string[] = [];

const send = (m: object) => ws.send(JSON.stringify(m));
const ms = () => Math.round(performance.now() - t0.ask);

ws.on("open", () => {
  send({ type: "start", caseId: "night-operator" });
  send({ type: "dial", suspectId: "doyle" });
  ask();
});

function ask() {
  t0.ask = performance.now();
  firstAudio = null;
  audioBytes = 0;
  send({ type: "ask", text: questions[turn]! });
}

ws.on("message", (data, isBinary) => {
  if (isBinary) {
    const f = decodeAudioFrame(new Uint8Array(data as Buffer));
    if (!f) return;
    firstAudio ??= ms();
    audioBytes += f.pcm.length;
    return;
  }
  const m = JSON.parse(data.toString());
  // Only the suspect's own replies count as answers; narration (hints) is printed but skipped.
  if (m.type === "line" && m.speaker === "doyle") lines[m.utteranceId] = m.text;
  if (m.type === "line" && m.speaker !== "doyle") console.log(`  (${m.speaker}: ${m.text})`);
  if (["clues", "state", "error", "fallback_speech", "call"].includes(m.type)) console.log(`${String(ms()).padStart(6)}ms ${m.type}`, JSON.stringify(m).slice(0, 220));
  if (m.type === "line_end" && lines[m.utteranceId] !== undefined) {
    console.log(`\nQ${turn + 1}: ${questions[turn]}\nA: ${lines[m.utteranceId]}`);
    console.log(`first audio after ${firstAudio}ms, ${(audioBytes / 48000).toFixed(2)}s of audio, done at ${ms()}ms`);
    if (++turn < questions.length) return void setTimeout(ask, 300);
    send({ type: "hangup" });
    setTimeout(() => process.exit(0), 500);
  }
});
ws.on("error", (e) => {
  console.error("socket error:", e.message);
  process.exit(1);
});
setTimeout(() => {
  console.error("timed out after 120s");
  process.exit(1);
}, 120_000);
