import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";

// A local stand-in for AssemblyAI Streaming STT v3 (docs/reference/assemblyai/streaming_api-spec_streaming-websocket.md).
// The test scripts what the "speaker" said; ForceEndpoint ends the turn with that text.

export async function startFakeSttServer() {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((r) => wss.once("listening", () => r()));
  const sessions: { params: URLSearchParams; auth: string | undefined; audioBytes: number; control: string[] }[] = [];
  let script = "";

  wss.on("connection", (ws, req) => {
    const s = { params: new URL(req.url ?? "/", "http://x").searchParams, auth: req.headers.authorization, audioBytes: 0, control: [] as string[] };
    sessions.push(s);
    let turn = 0;
    ws.send(JSON.stringify({ type: "Begin", id: "fake", expires_at: 0 }));
    ws.on("message", (raw, isBinary) => {
      if (isBinary) {
        s.audioBytes += (raw as Buffer).length;
        // A partial arrives as audio streams in.
        ws.send(JSON.stringify({ type: "Turn", turn_order: turn, end_of_turn: false, transcript: script.split(" ")[0] }));
        return;
      }
      const msg = JSON.parse(raw.toString()) as { type: string };
      s.control.push(msg.type);
      if (msg.type === "ForceEndpoint") {
        // Real servers send the unformatted final, then (with format_turns) a formatted copy.
        ws.send(JSON.stringify({ type: "Turn", turn_order: turn, end_of_turn: true, turn_is_formatted: false, transcript: script.toLowerCase() }));
        ws.send(JSON.stringify({ type: "Turn", turn_order: turn, end_of_turn: true, turn_is_formatted: true, transcript: script }));
        turn++;
      }
      if (msg.type === "Terminate") {
        ws.send(JSON.stringify({ type: "Termination", audio_duration_seconds: 1 }));
        ws.close(1000);
      }
    });
  });

  return {
    url: `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    sessions,
    say: (text: string) => (script = text),
    close: () => new Promise<void>((r) => wss.close(() => r())),
  };
}
