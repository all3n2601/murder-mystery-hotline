// PROTOTYPE — throwaway. Discovers the undocumented AssemblyAI streaming TTS protocol by trial.
// Question it answers: how do we authenticate, pick a voice, send text, and receive audio on
// wss://streaming-tts.assemblyai.com/v1/ws ?
//
//   pnpm exec tsx --env-file=.env tools/PROTOTYPE-tts-probe.ts            # try every variant
//   pnpm exec tsx --env-file=.env tools/PROTOTYPE-tts-probe.ts <variant>  # one variant by name
//
// Each variant opens a fresh socket, logs every frame, and stops early once audio arrives.
import { mkdirSync, writeFileSync } from "node:fs";
import WebSocket from "ws";

const KEY = process.env.ASSEMBLYAI_API_KEY;
if (!KEY) throw new Error("ASSEMBLYAI_API_KEY missing from .env");
const BASE = "wss://streaming-tts.assemblyai.com/v1/ws";
const TEXT = "Detective, I only connected the calls. Nothing more.";

type Variant = { name: string; url: string; headers?: Record<string, string>; send: unknown[] };

const variants: Variant[] = [
  {
    name: "header-Generate-Flush",
    url: BASE,
    headers: { Authorization: KEY },
    send: [{ type: "Generate", text: TEXT }, { type: "Flush" }],
  },
  {
    name: "header-Generate-voice-Flush",
    url: BASE,
    headers: { Authorization: KEY },
    send: [{ type: "Generate", text: TEXT, voice: "eve" }, { type: "Flush" }],
  },
  {
    name: "query-voice-Generate-Flush",
    url: `${BASE}?voice=eve&sample_rate=24000`,
    headers: { Authorization: KEY },
    send: [{ type: "Generate", text: TEXT }, { type: "Flush" }],
  },
  {
    name: "bearer-Generate-Flush",
    url: BASE,
    headers: { Authorization: `Bearer ${KEY}` },
    send: [{ type: "Generate", text: TEXT }, { type: "Flush" }],
  },
  {
    name: "query-token-Generate-Flush",
    url: `${BASE}?token=${encodeURIComponent(KEY)}`,
    send: [{ type: "Generate", text: TEXT }, { type: "Flush" }],
  },
  // Round 2: the Begin frame echoes configuration {voice, language, sample_rate, encoding,
  // inactivity_timeout, word_boundaries, voice_clone}, which suggests query params.
  {
    name: "r2-query-voice-george",
    url: `${BASE}?voice=george`,
    headers: { Authorization: KEY },
    send: [{ type: "Generate", text: "This is George on the line." }, { type: "Flush" }],
  },
  {
    name: "r2-query-voice-invalid",
    url: `${BASE}?voice=zzznotavoice`,
    headers: { Authorization: KEY },
    send: [{ type: "Generate", text: "Testing." }, { type: "Flush" }],
  },
  {
    name: "r2-no-flush",
    url: BASE,
    headers: { Authorization: KEY },
    send: [{ type: "Generate", text: "Do I start speaking before you flush? Let us find out." }],
  },
  {
    name: "r2-update-voice-midsession",
    url: `${BASE}?voice=george`,
    headers: { Authorization: KEY },
    send: [
      { type: "UpdateConfiguration", voice: "vera" },
      { type: "Generate", text: "Am I Vera now?" },
      { type: "Flush" },
    ],
  },
  {
    name: "r2-query-sample-rate-16k",
    url: `${BASE}?voice=vera&sample_rate=16000`,
    headers: { Authorization: KEY },
    send: [{ type: "Generate", text: "Lower sample rate." }, { type: "Flush" }],
  },
  // Round 3: barge-in. Cancel right after the first audio would be ideal, but a fixed delay is enough here.
  {
    name: "r3-cancel",
    url: `${BASE}?voice=eve`,
    headers: { Authorization: KEY },
    send: [
      { type: "Generate", text: "This is a long sentence that should get cut off well before it finishes speaking out loud." },
      { type: "Flush" },
      { type: "Cancel" },
      { type: "Generate", text: "Second reply after cancel." },
      { type: "Flush" },
    ],
  },
  {
    name: "header-lowercase-types",
    url: BASE,
    headers: { Authorization: KEY },
    send: [{ type: "generate", text: TEXT }, { type: "flush" }],
  },
];

const redact = (s: string) => s.split(KEY).join("<KEY>");

function preview(buf: Buffer): string {
  const head = buf.subarray(0, 12);
  const ascii = head.toString("latin1").replace(/[^\x20-\x7e]/g, ".");
  return `${buf.length}B hex=${head.toString("hex")} ascii="${ascii}"`;
}

async function run(v: Variant): Promise<{ name: string; audioBytes: number; frames: string[]; close?: string }> {
  const frames: string[] = [];
  const audio: Buffer[] = [];
  const t0 = performance.now();
  const ms = () => `${(performance.now() - t0).toFixed(0).padStart(5)}ms`;
  const log = (line: string) => {
    const l = `${ms()} ${redact(line)}`;
    frames.push(l);
    console.log(`  [${v.name}] ${l}`);
  };
  let firstAudio: number | null = null;

  return new Promise((resolve) => {
    const ws = new WebSocket(v.url, { headers: v.headers });
    let close: string | undefined;
    const finish = () => {
      clearTimeout(timer);
      // Always end the server session: a bare close leaves it counted against the concurrency cap.
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "Terminate" }));
        setTimeout(() => ws.close(), 500);
      } else if (ws.readyState === WebSocket.CONNECTING) ws.terminate();
      const pcm = Buffer.concat(audio);
      if (pcm.length) {
        mkdirSync("probe-out", { recursive: true });
        writeFileSync(`probe-out/tts-${v.name}.raw`, pcm);
      }
      if (firstAudio !== null) log(`first audio at ${firstAudio.toFixed(0)}ms, total ${pcm.length} bytes`);
      resolve({ name: v.name, audioBytes: pcm.length, frames, close });
    };
    const timer = setTimeout(() => {
      log("timeout (8s)");
      finish();
    }, 8_000);

    ws.on("unexpected-response", (_req, res) => {
      log(`HTTP ${res.statusCode} ${res.statusMessage} on upgrade`);
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (body) log(`body: ${body.slice(0, 400)}`);
        finish();
      });
    });
    ws.on("open", () => {
      log("open");
      setTimeout(() => {
        for (const m of v.send) {
          log(`-> ${JSON.stringify(m).slice(0, 160)}`);
          ws.send(JSON.stringify(m));
        }
      }, 300); // give the server a moment to send any greeting first
    });
    ws.on("message", (data, isBinary) => {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      if (isBinary) {
        if (firstAudio === null) firstAudio = performance.now() - t0;
        audio.push(buf);
        if (audio.length <= 3) log(`<- binary ${preview(buf)}`);
        return;
      }
      const text = buf.toString();
      log(`<- text ${text.slice(0, 400)}`);
      try {
        const j = JSON.parse(text) as Record<string, unknown>;
        // Some servers put base64 audio inside JSON.
        for (const k of ["audio", "data", "chunk"]) {
          if (typeof j[k] === "string" && (j[k] as string).length > 100) {
            if (firstAudio === null) firstAudio = performance.now() - t0;
            audio.push(Buffer.from(j[k] as string, "base64"));
          }
        }
        if (/flush.?done|done|complete/i.test(String(j.type ?? j.event ?? ""))) setTimeout(finish, 300);
      } catch {
        /* not JSON */
      }
    });
    ws.on("close", (code, reason) => {
      close = `${code} ${reason.toString()}`;
      log(`close ${close}`);
      finish();
    });
    ws.on("error", (err) => log(`error ${err.message}`));
  });
}

const only = process.argv[2];
const results = [];
for (const v of variants.filter((x) => !only || x.name === only)) {
  console.log(`\n=== ${v.name}`);
  const r = await run(v);
  results.push(r);
  if (r.audioBytes > 0 && !only) {
    console.log(`\nAudio received with "${v.name}". Stopping.`);
    break;
  }
}

mkdirSync("probe-out", { recursive: true });
writeFileSync("probe-out/tts-probe.json", JSON.stringify(results, null, 2));
console.log("\n=== summary");
for (const r of results) console.log(`${r.name.padEnd(30)} audio=${r.audioBytes}B close=${r.close ?? "-"}`);
process.exit(0);
