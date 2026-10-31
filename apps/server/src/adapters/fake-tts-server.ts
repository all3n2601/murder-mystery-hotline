import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";

// A local stand-in for wss://tts.us.assemblyai.com/v1/ws (AssemblyAI-TTS-1), following the
// protocol in docs/reference/assemblyai/tts-protocol.md. Audio is the UTF-8 bytes of the flushed
// text, so tests can read what was "spoken".

export async function startFakeTtsServer(
  opts: {
    maxConcurrent?: number;
    flushDelayMs?: number;
    failWith?: string;
    /**
     * Like the real server (probed 2026-10-17): audio already being generated keeps arriving
     * after a Cancel, up to the Cancelled ack, and never after it.
     */
    lateAudioAfterCancel?: boolean;
    /** Like TTS-1 (120 s by default): closes a session that receives no frame for this long. */
    inactivityTimeoutMs?: number;
  } = {},
) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((r) => wss.once("listening", () => r()));
  const log: { voiceId: string | null; auth: string | undefined; received: string[] }[] = [];
  let open = 0;
  let peakOpen = 0;

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "/", "http://x");
    const entry = { voiceId: url.searchParams.get("voice_id"), auth: req.headers.authorization, received: [] as string[] };
    log.push(entry);
    if (open >= (opts.maxConcurrent ?? 3)) {
      ws.send(JSON.stringify({ type: "Error", error_code: 3009, error: "Too many concurrent sessions for this account; try again later" }));
      ws.close(3009, "See Error message for details");
      return;
    }
    open++;
    peakOpen = Math.max(peakOpen, open);
    ws.once("close", () => open--);
    ws.send(JSON.stringify({ type: "Begin", id: "fake", configuration: { voice_id: entry.voiceId ?? "aai-jane", sample_rate: 24000 } }));

    let buffered = "";
    let flushId = 0;
    let audioMs = 0; // audio_start_ms and word times run across the whole connection
    const cancelled = new Set<number>(); // flushes a Cancel arrived for before their audio went out
    let idle: NodeJS.Timeout | undefined;
    const resetIdle = () => {
      if (!opts.inactivityTimeoutMs) return;
      clearTimeout(idle);
      idle = setTimeout(() => {
        ws.send(JSON.stringify({ type: "Error", error_code: 3006, error: "Session inactive", error_type: "inactivity_timeout" }));
        ws.close(3006, "See Error message for details");
      }, opts.inactivityTimeoutMs);
    };
    resetIdle();
    ws.once("close", () => clearTimeout(idle));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as { type: string; text?: string };
      entry.received.push(msg.type);
      resetIdle();
      if (opts.failWith && msg.type === "Generate") {
        ws.send(JSON.stringify({ type: "Error", error_code: 3006, error: opts.failWith }));
        ws.close(3006, "See Error message for details");
        return;
      }
      if (msg.type === "Generate") buffered += msg.text ?? "";
      if (msg.type === "Cancel") {
        buffered = "";
        for (let id = 0; id < flushId; id++) cancelled.add(id);
        if (opts.lateAudioAfterCancel) ws.send(JSON.stringify({ type: "Audio", audio: Buffer.from("STALE").toString("base64") }));
        ws.send(JSON.stringify({ type: "Cancelled", audio_duration_seconds: 0 }));
      }
      if (msg.type === "Flush") {
        const text = buffered;
        const id = flushId++;
        buffered = "";
        setTimeout(() => {
          if (ws.readyState !== ws.OPEN) return;
          if (cancelled.has(id)) return; // nothing for a cancelled flush after the ack, not even FlushDone
          ws.send(JSON.stringify({ type: "Audio", audio: Buffer.from(text).toString("base64") }));
          ws.send(JSON.stringify({ type: "FlushDone", flush_id: id, audio_duration_ms: 100 }));
          // Like the real server (probed 2026-10-18): word times count from the start of the
          // connection, and audio_start_ms is where this flush's audio begins on it.
          ws.send(JSON.stringify({ type: "WordBoundaries", flush_id: id, audio_start_ms: audioMs, words: [{ word: text, start: audioMs, end: audioMs + 100 }] }));
          audioMs += 100;
        }, opts.flushDelayMs ?? 5);
      }
      if (msg.type === "Terminate") {
        ws.send(JSON.stringify({ type: "Termination" }));
        ws.close(1000);
      }
    });
  });

  return {
    url: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    log,
    peakOpen: () => peakOpen,
    openNow: () => open,
    /** Drops every open connection, as a flaky network would. */
    dropAll: () => wss.clients.forEach((c) => c.terminate()),
    close: () => new Promise<void>((r) => wss.close(() => r())),
  };
}
