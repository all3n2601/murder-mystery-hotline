import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { loadCase, type CasePack } from "@mmh/engine";
import { parseClientMessage } from "@mmh/protocol";
import { createGatewayLlm } from "./adapters/llm.js";
import { createAssemblyStt } from "./adapters/stt.js";
import { createAssemblyTts } from "./adapters/tts.js";
import { createSession } from "./session.js";

const ROOT = join(import.meta.dirname, "../../..");
const PORT = Number(process.env.PORT ?? 8787);
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS ?? 20);
const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) {
  console.error("ASSEMBLYAI_API_KEY is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

/** Every pack must pass the validator, or the server refuses to start. */
function loadCases(): Map<string, CasePack> {
  const cases = new Map<string, CasePack>();
  const dir = join(ROOT, "cases");
  for (const id of readdirSync(dir)) {
    const result = loadCase(JSON.parse(readFileSync(join(dir, id, "case.json"), "utf8")));
    if (!result.ok) throw new Error(`Case ${id} is invalid:\n  ${result.errors.join("\n  ")}`);
    cases.set(result.pack.id, result.pack);
  }
  return cases;
}

const cases = loadCases();
const keyterms = [...cases.values()].flatMap((p) => [...p.characters.map((c) => c.name), p.narrator.name]);
const llm = createGatewayLlm({ apiKey, model: process.env.SUSPECT_MODEL ?? "qwen3.5-4b-32k-fast" });
const tts = createAssemblyTts({ apiKey, maxConcurrent: Number(process.env.TTS_MAX_CONCURRENT ?? 3) });
const stt = createAssemblyStt({ apiKey, keyterms });

const app = Fastify({ logger: { level: "info" } });
await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

const page = readFileSync(join(import.meta.dirname, "../public/index.html"), "utf8");
app.get("/", (_req, reply) => reply.type("text/html").header("cache-control", "no-store").send(page));
app.get("/health", async () => ({ ok: true, cases: [...cases.keys()] }));

let open = 0;
app.get("/game", { websocket: true }, (socket, req) => {
  if (open >= MAX_SESSIONS) {
    socket.send(JSON.stringify({ type: "error", code: "busy", message: "All lines are busy. Try again in a minute." }));
    socket.close(1013);
    return;
  }
  open++;
  const log = req.log.child({ session: req.id });
  const session = createSession({
    cases,
    llm,
    tts,
    stt,
    send: (m) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(m)),
    sendAudio: (frame) => socket.readyState === socket.OPEN && socket.send(frame),
    onError: (where, err) => log.error({ err }, `${where} failed`),
  });

  socket.on("message", (data, isBinary) => {
    if (isBinary) return session.audio(new Uint8Array(data as Buffer));
    const parsed = parseClientMessage(data.toString());
    if (!parsed.ok) {
      socket.send(JSON.stringify({ type: "error", code: "bad_message", message: parsed.error }));
      return;
    }
    session.handle(parsed.message).catch((err: Error) => log.error({ err }, "session handler failed"));
  });
  socket.on("close", () => {
    open--;
    void session.handle({ type: "hangup" });
  });
});

await app.listen({ port: PORT, host: "0.0.0.0" });
