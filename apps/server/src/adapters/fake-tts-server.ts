import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";

// A local stand-in for wss://streaming-tts.assemblyai.com/v1/ws, following the protocol we
// verified on 2026-10-17 (docs/reference/assemblyai/tts-protocol.md). Audio is the UTF-8
// bytes of the flushed text, so tests can read what was "spoken".

export async function startFakeTtsServer(opts: { maxConcurrent?: number; flushDelayMs?: number; failWith?: string } = {}) {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((r) => wss.once("listening", () => r()));
  const log: { voice: string | null; auth: string | undefined; received: string[] }[] = [];
  let open = 0;
  let peakOpen = 0;

  wss.on("connection", (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "/", "http://x");
    const entry = { voice: url.searchParams.get("voice"), auth: req.headers.authorization, received: [] as string[] };
    log.push(entry);
    if (open >= (opts.maxConcurrent ?? 3)) {
      ws.send(JSON.stringify({ type: "Error", error_code: 3009, error: "Too many concurrent sessions for this account; try again later" }));
      ws.close(3009, "See Error message for details");
      return;
    }
    open++;
    peakOpen = Math.max(peakOpen, open);
    ws.once("close", () => open--);
    ws.send(JSON.stringify({ type: "Begin", id: "fake", configuration: { voice: entry.voice ?? "jane", sample_rate: 24000 } }));

    let buffered = "";
    let flushId = 0;
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString()) as { type: string; text?: string };
      entry.received.push(msg.type);
      if (opts.failWith && msg.type === "Generate") {
        ws.send(JSON.stringify({ type: "Error", error_code: 3006, error: opts.failWith }));
        ws.close(3006, "See Error message for details");
        return;
      }
      if (msg.type === "Generate") buffered += msg.text ?? "";
      if (msg.type === "Cancel") {
        buffered = "";
        ws.send(JSON.stringify({ type: "Cancelled", audio_duration_seconds: 0 }));
      }
      if (msg.type === "Flush") {
        const text = buffered;
        const id = flushId++;
        buffered = "";
        setTimeout(() => {
          if (ws.readyState !== ws.OPEN) return;
          ws.send(JSON.stringify({ type: "Audio", audio: Buffer.from(text).toString("base64") }));
          ws.send(JSON.stringify({ type: "FlushDone", flush_id: id, audio_duration_ms: 100 }));
          ws.send(JSON.stringify({ type: "WordBoundaries", flush_id: id, audio_start_ms: 0, words: [{ word: text, start: 0, end: 100 }] }));
        }, opts.flushDelayMs ?? 5);
      }
      if (msg.type === "Terminate") ws.close(1000);
    });
  });

  return {
    url: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    log,
    peakOpen: () => peakOpen,
    openNow: () => open,
    close: () => new Promise<void>((r) => wss.close(() => r())),
  };
}
