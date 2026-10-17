import WebSocket from "ws";
import type { TtsPort, Word } from "../ports.js";

// AssemblyAI streaming TTS (Preview). Protocol verified by probe, see
// docs/reference/assemblyai/tts-protocol.md. One socket per reply: the voice is fixed per
// connection, and an idle session never times out, so we always Terminate.

export const TTS_URL = "wss://streaming-tts.assemblyai.com/v1/ws";

type ServerFrame =
  | { type: "Begin" }
  | { type: "Audio"; audio: string }
  | { type: "FlushDone"; flush_id: number }
  | { type: "WordBoundaries"; words: Word[] }
  | { type: "Cancelled" }
  | { type: "Error"; error_code: number; error: string };

/** Counting semaphore: the account allows only a few TTS sessions at once. */
function createSlots(max: number) {
  let free = max;
  const waiting: (() => void)[] = [];
  return {
    /** Resolves when a slot is ours; calls onWait first if we have to queue. */
    async acquire(onWait?: () => void): Promise<void> {
      if (free > 0) {
        free--;
        return;
      }
      onWait?.();
      await new Promise<void>((r) => waiting.push(r));
    },
    release() {
      const next = waiting.shift();
      if (next) next();
      else free++;
    },
  };
}

export function createAssemblyTts(opts: {
  apiKey: string;
  url?: string;
  sampleRate?: number;
  maxConcurrent?: number;
  /** Give up if the server sends nothing for this long while audio is owed. */
  idleTimeoutMs?: number;
}): TtsPort {
  const base = opts.url ?? TTS_URL;
  const slots = createSlots(opts.maxConcurrent ?? 3);

  return {
    async speak(args) {
      await slots.acquire(args.onQueued);
      if (args.signal.aborted) return slots.release();
      const closed = speakOnce(args);
      // Free the slot only once the server has closed the session, or the next reply would
      // briefly be a 4th session and get error 3009.
      try {
        await closed.spoken;
      } finally {
        void closed.socketClosed.then(() => slots.release());
      }
    },
  };

  function speakOnce({ voice, sentences, signal, onAudio, onWords }: Parameters<TtsPort["speak"]>[0]) {
    let markClosed!: () => void;
    const socketClosed = new Promise<void>((r) => (markClosed = r));
    const spoken = (async () => {
      const url = new URL(base);
      url.searchParams.set("voice", voice);
      url.searchParams.set("sample_rate", String(opts.sampleRate ?? 24_000));
      const ws = new WebSocket(url, { headers: { Authorization: opts.apiKey } });

      let flushesSent = 0;
      let flushesDone = 0;
      let inputDone = false;
      let settle!: { resolve(): void; reject(e: Error): void };
      const finished = new Promise<void>((resolve, reject) => (settle = { resolve, reject }));

      const send = (msg: object) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      };
      const maybeDone = () => {
        if (inputDone && flushesDone >= flushesSent) settle.resolve();
      };

      // Watchdog: once text is flushed, the server must keep talking or we give up.
      let idle: NodeJS.Timeout | undefined;
      const armWatchdog = () => {
        clearTimeout(idle);
        idle = setTimeout(() => {
          if (flushesSent > flushesDone) settle.reject(new Error("TTS went silent"));
        }, opts.idleTimeoutMs ?? 8_000);
        idle.unref();
      };
      finished.finally(() => clearTimeout(idle)).catch(() => {});

      ws.on("message", (raw) => {
        armWatchdog();
        const frame = JSON.parse(raw.toString()) as ServerFrame;
        if (frame.type === "Audio") {
          if (!signal.aborted) onAudio(new Uint8Array(Buffer.from(frame.audio, "base64")));
        }
        else if (frame.type === "FlushDone") {
          flushesDone++;
          maybeDone();
        } else if (frame.type === "WordBoundaries") onWords?.(frame.words);
        else if (frame.type === "Error") settle.reject(new Error(`TTS ${frame.error_code}: ${frame.error}`));
      });
      ws.on("close", (code) => settle.reject(new Error(`TTS socket closed (${code})`)));
      ws.on("error", (err) => settle.reject(err));

      const begun = new Promise<void>((resolve, reject) => {
        ws.on("message", function onBegin(raw) {
          if ((JSON.parse(raw.toString()) as ServerFrame).type === "Begin") {
            ws.off("message", onBegin);
            resolve();
          }
        });
        finished.catch(reject);
      });

      // Barge-in: stop the utterance server-side and return at once.
      const onAbort = () => {
        send({ type: "Cancel" });
        settle.resolve();
      };
      signal.addEventListener("abort", onAbort, { once: true });

      const feed = async () => {
        let pending = false; // text generated since the last flush
        for await (const sentence of sentences) {
          if (signal.aborted) return;
          send({ type: "Generate", text: sentence + " " });
          pending = true;
          // No audio is produced until Flush, so flush the first sentence straight away.
          if (flushesSent === 0) {
            send({ type: "Flush" });
            flushesSent++;
            pending = false;
            armWatchdog();
          }
        }
        if (pending) {
          send({ type: "Flush" });
          flushesSent++;
          armWatchdog();
        }
        inputDone = true;
        maybeDone();
      };

      try {
        await Promise.race([begun, finished]);
        if (!signal.aborted) feed().catch((e: Error) => settle.reject(e));
        await finished;
      } finally {
        signal.removeEventListener("abort", onAbort);
        send({ type: "Terminate" });
        ws.removeAllListeners("close");
        ws.once("close", markClosed);
        if (ws.readyState === WebSocket.CLOSED) markClosed();
        // If the server doesn't close after Terminate, close it ourselves.
        setTimeout(() => {
          ws.terminate();
          markClosed();
        }, 1500).unref();
      }
    })();
    return { spoken, socketClosed };
  }
}
