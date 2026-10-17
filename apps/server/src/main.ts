import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { loadCase, type CasePack } from "@mmh/engine";
import { parseClientMessage, type ClientMessage, type ServerMessage } from "@mmh/protocol";
import { createGatewayLlm } from "./adapters/llm.js";
import { createAssemblyStt } from "./adapters/stt.js";
import { createAssemblyTts } from "./adapters/tts.js";
import { createAdmission } from "./admission.js";
import { createRegistry } from "./registry.js";
import { createSession } from "./session.js";

const ROOT = join(import.meta.dirname, "../../..");
const PORT = Number(process.env.PORT ?? 8787);
const IDLE_MS = 10 * 60_000; // a socket with no messages this long is closed
const RESUME_MS = 10 * 60_000; // a closed socket's game can be resumed this long

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
const admission = createAdmission({
  maxOpen: Number(process.env.MAX_SESSIONS ?? 20),
  perIpPerHour: Number(process.env.SESSIONS_PER_IP_PER_HOUR ?? 30),
});

const app = Fastify({ logger: { level: "info" } });
await app.register(websocket, { options: { maxPayload: 64 * 1024 } });

const registry = createRegistry({
  ttlMs: RESUME_MS,
  create: (transport) =>
    createSession({
      cases,
      llm,
      tts,
      stt,
      ...transport,
      onError: (where, err) => app.log.error({ err }, `${where} failed`),
      onEvent: (event, data) => app.log.warn(data, event),
    }),
});
setInterval(() => registry.sweep(), 30_000).unref();

const page = readFileSync(join(import.meta.dirname, "../public/index.html"), "utf8");
app.addHook("onSend", async (_req, reply) => {
  reply.header(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src blob:; media-src 'self' blob:",
  );
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "no-referrer");
});
app.get("/", (_req, reply) => reply.type("text/html").header("cache-control", "no-store").send(page));
app.get("/health", async () => ({ ok: true, cases: [...cases.keys()] }));

app.get("/game", { websocket: true }, (socket, req) => {
  const sendJson = (m: ServerMessage) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(m));
  // Behind Fly's proxy every request comes from the proxy; the real client is in this header.
  const ip = (req.headers["fly-client-ip"] as string | undefined) ?? req.ip;
  const admitted = admission.admit(ip);
  if (!admitted.ok) {
    sendJson({
      type: "error",
      code: admitted.reason,
      message: admitted.reason === "full" ? "All lines are busy. Try again in a minute." : "You've rung too often tonight. Try again later.",
    });
    socket.close(1013);
    return;
  }

  const transport = {
    send: sendJson,
    sendAudio: (frame: Uint8Array) => socket.readyState === socket.OPEN && socket.send(frame),
  };
  let joined: ReturnType<typeof registry.connect> | null = null;
  const join = (resumeId: string | undefined) => {
    joined = registry.connect(transport, resumeId);
    sendJson({ type: "welcome", sessionId: joined.sessionId, resumed: joined.resumed });
    return joined;
  };

  let idle = setTimeout(() => socket.close(1000), IDLE_MS);
  const handleMessage = (msg: ClientMessage) => {
    // The first message may be hello; anything else starts a fresh game.
    if (msg.type === "hello") {
      if (!joined) join(msg.sessionId);
      return;
    }
    const { session } = joined ?? join(undefined);
    session.handle(msg).catch((err: Error) => req.log.error({ err }, "session handler failed"));
  };

  socket.on("message", (data, isBinary) => {
    clearTimeout(idle);
    idle = setTimeout(() => socket.close(1000), IDLE_MS);
    if (isBinary) return joined?.session.audio(new Uint8Array(data as Buffer));
    const parsed = parseClientMessage(data.toString());
    if (!parsed.ok) return void sendJson({ type: "error", code: "bad_message", message: parsed.error });
    handleMessage(parsed.message);
  });
  socket.on("close", () => {
    clearTimeout(idle);
    admitted.release();
    if (!joined) return;
    // Stop talking to nobody, but keep the game so a refresh can pick it back up.
    void joined.session.handle({ type: "hangup" });
    registry.disconnect(joined.sessionId);
  });
});

await app.listen({ port: PORT, host: "0.0.0.0" });
