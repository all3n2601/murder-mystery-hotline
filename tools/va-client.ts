// Minimal Node client for the AssemblyAI Voice Agent WebSocket, shared by the Day 1 probes.
// Protocol: docs/reference/assemblyai/voice-agents_voice-agent-api_message-sequence.md
import { mkdirSync, writeFileSync } from "node:fs";
import WebSocket from "ws";

export const VA_WS_URL = "wss://agents.assemblyai.com/v1/ws";
export const VA_REST_URL = "https://agents.assemblyai.com/v1";
export const SAMPLE_RATE = 24_000;

export type VaEvent = { type: string; [key: string]: unknown };

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export class VoiceAgentSession {
  readonly events: { t: number; event: VaEvent }[] = [];
  private readonly ws: WebSocket;
  private readonly started = performance.now();
  private waiters: { match: (e: VaEvent) => boolean; resolve: (e: VaEvent) => void }[] = [];
  readonly audio: Buffer[] = [];

  constructor(apiKey: string, private readonly label: string) {
    this.ws = new WebSocket(VA_WS_URL, { headers: { Authorization: apiKey } });
    this.ws.on("message", (raw) => this.onMessage(raw.toString()));
    this.ws.on("close", (code, reason) => this.log(`socket closed ${code} ${reason.toString()}`));
    this.ws.on("error", (err) => this.log(`socket error ${err.message}`));
  }

  now(): number {
    return performance.now() - this.started;
  }

  opened(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
    });
  }

  send(event: VaEvent): void {
    if (event.type !== "input.audio") this.log(`-> ${JSON.stringify(event).slice(0, 200)}`);
    this.ws.send(JSON.stringify(event));
  }

  waitFor(type: string | ((e: VaEvent) => boolean), timeoutMs = 20_000): Promise<VaEvent> {
    const match = typeof type === "string" ? (e: VaEvent) => e.type === type : type;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${String(type)}`)), timeoutMs);
      this.waiters.push({
        match,
        resolve: (e) => {
          clearTimeout(timer);
          resolve(e);
        },
      });
    });
  }

  async end(): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.send({ type: "session.end" });
    await this.waitFor("session.ended", 5_000).catch(() => this.log("no session.ended"));
    this.ws.close();
  }

  writeWav(path: string): void {
    mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    writeFileSync(path, wav(Buffer.concat(this.audio)));
  }

  private onMessage(raw: string): void {
    let event: VaEvent;
    try {
      event = JSON.parse(raw) as VaEvent;
    } catch {
      this.log(`non-JSON frame (${raw.length} bytes)`);
      return;
    }
    this.events.push({ t: this.now(), event });
    if (event.type === "reply.audio" && typeof event.data === "string") {
      this.audio.push(Buffer.from(event.data, "base64"));
    } else {
      this.log(`<- ${JSON.stringify(event).slice(0, 300)}`);
    }
    const ready = this.waiters.filter((w) => w.match(event));
    this.waiters = this.waiters.filter((w) => !w.match(event));
    for (const w of ready) w.resolve(event);
  }

  private log(line: string): void {
    console.log(`[${this.label} ${this.now().toFixed(0).padStart(6)}ms] ${line}`);
  }
}

/** Wraps mono PCM16 in a WAV header so probe output opens in any player. */
export function wav(pcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Asks one typed question and measures the reply timeline. */
export async function askTyped(session: VoiceAgentSession, question: string) {
  // Timings come from the event log, not from awaiting each event: ws can emit several
  // frames in one tick, so a waiter registered after reply.started could miss the first audio.
  const audioBefore = session.audio.length;
  const eventsBefore = session.events.length;
  const t0 = session.now();
  const done = session.waitFor("reply.done", 30_000);
  session.send({ type: "conversation.message", role: "user", content: question });
  session.send({ type: "reply.create" });
  await done;
  const after = session.events.slice(eventsBefore);
  const at = (type: string) => after.find((e) => e.event.type === type);
  const bytes = session.audio.slice(audioBefore).reduce((n, b) => n + b.length, 0);
  const ms = (type: string) => {
    const e = at(type);
    return e ? Math.round(e.t - t0) : null;
  };
  return {
    question,
    text: at("transcript.agent")?.event.text ?? null,
    replyStartedMs: ms("reply.started"),
    firstAudioMs: ms("reply.audio"),
    audioSeconds: +(bytes / 2 / SAMPLE_RATE).toFixed(2),
  };
}
