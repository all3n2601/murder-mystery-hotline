import WebSocket from "ws";
import type { SttPort, SttSession } from "../ports.js";

// AssemblyAI Streaming STT v3. One session per phone call; push-to-talk release sends
// ForceEndpoint so we never wait for silence detection. Billing runs while the socket is
// open, so close() always sends Terminate.

export const STT_URL = "wss://streaming.assemblyai.com/v3/ws";

type Turn = { type: "Turn"; turn_order: number; end_of_turn: boolean; transcript: string };

export function createAssemblyStt(opts: { apiKey: string; url?: string; keyterms?: string[]; speechModel?: string }): SttPort {
  return {
    open(handlers): SttSession {
      const url = new URL(opts.url ?? STT_URL);
      url.searchParams.set("sample_rate", "16000");
      url.searchParams.set("encoding", "pcm_s16le");
      url.searchParams.set("speech_model", opts.speechModel ?? "universal-3-6-pro");
      if (opts.keyterms?.length) url.searchParams.set("keyterms_prompt", JSON.stringify(opts.keyterms));

      const ws = new WebSocket(url, { headers: { Authorization: opts.apiKey } });
      const queue: (Uint8Array | string)[] = []; // anything sent before the socket opens
      let lastFinalTurn = -1;

      const send = (data: Uint8Array | string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
        else if (ws.readyState === WebSocket.CONNECTING) queue.push(data);
      };

      ws.on("open", () => {
        for (const item of queue.splice(0)) ws.send(item);
      });
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString()) as { type: string } & Partial<Turn>;
        if (msg.type !== "Turn") return;
        const turn = msg as Turn;
        if (!turn.end_of_turn) return handlers.onPartial(turn.transcript);
        // The first end-of-turn is the fastest; a formatted copy may follow. Report it once.
        if (turn.turn_order <= lastFinalTurn) return;
        lastFinalTurn = turn.turn_order;
        handlers.onFinal(turn.transcript);
      });
      ws.on("error", (err) => handlers.onError(err));
      ws.on("close", (code) => {
        if (code !== 1000 && code !== 1005) handlers.onError(new Error(`STT closed (${code})`));
      });

      return {
        sendAudio: (pcm) => send(pcm),
        endTurn: () => send(JSON.stringify({ type: "ForceEndpoint" })),
        close() {
          send(JSON.stringify({ type: "Terminate" }));
          setTimeout(() => ws.terminate(), 2_000).unref();
        },
      };
    },
  };
}
