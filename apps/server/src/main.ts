import { existsSync, readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyReply } from "fastify";
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
// One bad promise in one player's call must never take every other call down with it.
process.on("unhandledRejection", (err) => app.log.error({ err }, "unhandled rejection"));
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

// The game is the Vite build in apps/web/dist; the old test bench stays at /bench until launch.
const bench = readFileSync(join(import.meta.dirname, "../public/index.html"), "utf8");
const WEB_DIST = join(ROOT, "apps/web/dist");
const game = existsSync(join(WEB_DIST, "index.html")) ? readFileSync(join(WEB_DIST, "index.html"), "utf8") : null;
const MIME: Record<string, string> = {
  js: "text/javascript",
  css: "text/css",
  woff: "font/woff",
  woff2: "font/woff2",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  wav: "audio/wav",
  json: "application/json",
};
// File names are matched against this before touching the disk, so no path can escape its folder.
const SAFE_FILE = /^[a-z0-9][a-z0-9._-]{0,80}\.(js|css|woff2?|png|jpe?g|webp|svg|wav|json)$/i;
const CASE_FILE = /^[a-z0-9][a-z0-9_-]{0,63}\.(png|jpe?g|webp|wav|json)$/i;

async function sendFile(reply: FastifyReply, path: string, cache: string) {
  try {
    const body = await readFile(path);
    return reply.type(MIME[path.split(".").pop()!.toLowerCase()] ?? "application/octet-stream").header("cache-control", cache).send(body);
  } catch {
    return reply.code(404).send({ error: "not_found" });
  }
}

const caseFiles = (caseId: string, kind: "art" | "intro") => {
  const dir = join(ROOT, "cases", caseId, kind);
  return existsSync(dir) ? readdirSync(dir).filter((f) => CASE_FILE.test(f)) : [];
};
app.addHook("onSend", async (_req, reply) => {
  reply.header(
    "content-security-policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' data: blob:; worker-src 'self' blob:; media-src 'self' blob:",
  );
  reply.header("x-content-type-options", "nosniff");
  reply.header("referrer-policy", "no-referrer");
});
app.get("/", (_req, reply) => reply.type("text/html").header("cache-control", "no-store").send(game ?? bench));
app.get("/bench", (_req, reply) => reply.type("text/html").header("cache-control", "no-store").send(bench));
app.get<{ Params: { file: string } }>("/assets/:file", (req, reply) => {
  if (!SAFE_FILE.test(req.params.file)) return reply.code(404).send({ error: "not_found" });
  return sendFile(reply, join(WEB_DIST, "assets", req.params.file), "public, max-age=31536000, immutable");
});
// Which painted art and narration a case has, so the client never requests missing files.
app.get<{ Params: { caseId: string } }>("/cases/:caseId/manifest.json", (req, reply) => {
  if (!cases.has(req.params.caseId)) return reply.code(404).send({ error: "not_found" });
  return reply.header("cache-control", "no-cache").send({ art: caseFiles(req.params.caseId, "art"), intro: caseFiles(req.params.caseId, "intro") });
});
app.get<{ Params: { caseId: string; kind: string; file: string } }>("/cases/:caseId/:kind/:file", (req, reply) => {
  const { caseId, kind, file } = req.params;
  if (!cases.has(caseId) || (kind !== "art" && kind !== "intro") || !CASE_FILE.test(file)) return reply.code(404).send({ error: "not_found" });
  return sendFile(reply, join(ROOT, "cases", caseId, kind, file), "public, max-age=300");
});
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
