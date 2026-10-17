// Smoke test against a running server: plays one typed turn with the real AssemblyAI stack
// and reports latency. Usage: pnpm dev:server (in another terminal), then pnpm smoke [question]
import WebSocket from "ws";
import { decodeAudioFrame } from "@mmh/protocol";

const question = process.argv.slice(2).join(" ") || "Mr. Doyle, where were you between one and two this morning?";
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
  t0.ask = performance.now();
  send({ type: "ask", text: question });
});

ws.on("message", (data, isBinary) => {
  if (isBinary) {
    const f = decodeAudioFrame(new Uint8Array(data as Buffer));
    if (!f) return;
    firstAudio ??= ms();
    audioBytes += f.pcm.length;
    return;
  }
  const m = JSON.parse(data.toString());
  if (m.type === "line") lines[m.utteranceId] = m.text;
  if (["clues", "state", "error", "fallback_speech", "call"].includes(m.type)) console.log(`${String(ms()).padStart(6)}ms ${m.type}`, JSON.stringify(m).slice(0, 220));
  if (m.type === "line_end") {
    console.log(`\nQ: ${question}\nA: ${lines.filter(Boolean).join(" | ")}`);
    console.log(`first audio after ${firstAudio}ms, ${(audioBytes / 48000).toFixed(2)}s of audio, done at ${ms()}ms`);
    send({ type: "hangup" });
    setTimeout(() => process.exit(0), 500);
  }
});
ws.on("error", (e) => {
  console.error("socket error:", e.message);
  process.exit(1);
});
setTimeout(() => {
  console.error("timed out after 30s");
  process.exit(1);
}, 30_000);
