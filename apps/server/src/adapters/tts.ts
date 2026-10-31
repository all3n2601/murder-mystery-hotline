import WebSocket from "ws";
import type { TtsLine, TtsPort, Word } from "../ports.js";

// AssemblyAI streaming TTS (AssemblyAI-TTS-1). Protocol checked against the docs and by probe, see
// docs/reference/assemblyai/tts-protocol.md.
//
// The free plan allows only 5 NEW sessions a minute, so a phone call keeps one socket (a "line")
// per voice and speaks every reply over it. The voice is fixed per socket. The server closes a
// session idle for 120 s, so an open line sends KeepAlive, and always ends with Terminate.

export const TTS_URL = "wss://tts.us.assemblyai.com/v1/ws";
const WORDS_GRACE_MS = 500;

/** The account's session cap refused this connection before it began; safe to retry. */
class TtsRefused extends Error {}

type ServerFrame =
  | { type: "Begin" }
  | { type: "Audio"; audio: string }
  | { type: "FlushDone"; flush_id: number }
  | { type: "WordBoundaries"; flush_id: number; audio_start_ms?: number; words: Word[] }
  | { type: "Cancelled" }
  | { type: "Termination" }
  | { type: "Error"; error_code: number; error: string };

type SpeakArgs = Parameters<TtsLine["speak"]>[0];

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

type Utterance = {
  args: SpeakArgs;
  flushesSent: number;
  flushesDone: number;
  /** WordBoundaries arrive after each FlushDone; the reply isn't done until the last ones do. */
  wordsDone: number;
  /** Where this reply's audio begins on the connection (its first flush's audio_start_ms). */
  startMs: number | null;
  inputDone: boolean;
  resolve(): void;
  reject(err: Error): void;
};

/** One open TTS socket. Speaks one utterance at a time; reusable after each. */
type Connection = {
  readonly alive: boolean;
  utter(args: SpeakArgs): Promise<void>;
  /** Sends Terminate; resolves once the socket has closed. */
  terminate(): Promise<void>;
};

export function createAssemblyTts(opts: {
  apiKey: string;
  url?: string;
  sampleRate?: number;
  maxConcurrent?: number;
  /** Give up if the server sends nothing for this long while audio is owed. */
  idleTimeoutMs?: number;
  /** Waits before retrying a connection the account cap refused (3009). */
  retryBusyMs?: number[];
  /** How often an open line pings the server, which closes sessions idle for 120 s. */
  keepAliveMs?: number;
}): TtsPort {
  const base = opts.url ?? TTS_URL;
  const slots = createSlots(opts.maxConcurrent ?? 3);
  const retryBusyMs = opts.retryBusyMs ?? [1000, 2000, 4000, 8000];
  const idleTimeoutMs = opts.idleTimeoutMs ?? 8_000;
  const keepAliveMs = opts.keepAliveMs ?? 60_000;

  /** Opens a socket for one voice and resolves once the server says Begin. */
  function connect(voice: string): Promise<Connection> {
    const url = new URL(base);
    // TTS-1 retired `voice=`; built-in voices are the old names with an "aai-" prefix.
    url.searchParams.set("voice_id", `aai-${voice}`);
    url.searchParams.set("sample_rate", String(opts.sampleRate ?? 24_000));
    const ws = new WebSocket(url, { headers: { Authorization: opts.apiKey } });

    let alive = false;
    let current: Utterance | null = null;
    // Between our Cancel and the server's Cancelled, audio of the cut-off reply still arrives.
    let discarding = false;
    let watchdog: NodeJS.Timeout | undefined;
    const closed = new Promise<void>((r) => ws.once("close", () => r()));
    const keepAlive = setInterval(() => send({ type: "KeepAlive" }), keepAliveMs);
    keepAlive.unref();
    void closed.then(() => clearInterval(keepAlive));

    const send = (msg: object) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };
    const fail = (err: Error) => {
      alive = false;
      clearTimeout(watchdog);
      const failed = current;
      current = null;
      failed?.reject(err);
    };
    const armWatchdog = () => {
      clearTimeout(watchdog);
      if (!current || current.flushesSent <= current.flushesDone) return;
      watchdog = setTimeout(() => fail(new Error("TTS went silent")), idleTimeoutMs);
      watchdog.unref();
    };
    let wordsGrace: ReturnType<typeof setTimeout> | undefined;
    const finishIfDone = (force = false) => {
      if (!current || !current.inputDone || current.flushesDone < current.flushesSent) return;
      if (!force && current.wordsDone < current.flushesSent) {
        // Don't hang a reply on timings that never come; captions just stop short.
        clearTimeout(wordsGrace);
        const waiting = current;
        wordsGrace = setTimeout(() => current === waiting && finishIfDone(true), WORDS_GRACE_MS);
        wordsGrace.unref();
        return;
      }
      clearTimeout(watchdog);
      clearTimeout(wordsGrace);
      const done = current;
      current = null;
      done.resolve();
    };

    function utter(args: SpeakArgs): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          if (current !== u) return;
          send({ type: "Cancel" });
          discarding = true;
          clearTimeout(watchdog);
          current = null;
          settled();
          resolve(); // barge-in: return at once; the socket is reusable after Cancelled
        };
        const settled = () => args.signal.removeEventListener("abort", onAbort);
        const u: Utterance = {
          args,
          flushesSent: 0,
          flushesDone: 0,
          wordsDone: 0,
          startMs: null,
          inputDone: false,
          resolve: () => (settled(), resolve()),
          reject: (e) => (settled(), reject(e)),
        };
        current = u;
        args.signal.addEventListener("abort", onAbort, { once: true });

        void (async () => {
          let pending = false; // text generated since the last flush
          for await (const sentence of args.sentences) {
            if (current !== u) return;
            send({ type: "Generate", text: sentence + " " });
            pending = true;
            // No audio is produced until Flush, so flush the first sentence straight away.
            if (u.flushesSent === 0) {
              send({ type: "Flush" });
              u.flushesSent++;
              pending = false;
              armWatchdog();
            }
          }
          if (current !== u) return;
          if (pending) {
            send({ type: "Flush" });
            u.flushesSent++;
            armWatchdog();
          }
          u.inputDone = true;
          finishIfDone();
        })().catch((e: Error) => {
          if (current === u) fail(e);
        });
      });
    }

    function terminate(): Promise<void> {
      alive = false;
      if (ws.readyState === WebSocket.CONNECTING) ws.once("open", () => ws.send(JSON.stringify({ type: "Terminate" })));
      else send({ type: "Terminate" });
      // If the server doesn't close after Terminate, close it ourselves.
      const force = setTimeout(() => ws.terminate(), 1500);
      force.unref();
      return closed.finally(() => clearTimeout(force));
    }

    const connection: Connection = {
      get alive() {
        return alive;
      },
      utter,
      terminate,
    };

    return new Promise<Connection>((resolveOpen, rejectOpen) => {
      ws.on("message", (raw) => {
        const frame = JSON.parse(raw.toString()) as ServerFrame;
        if (frame.type === "Begin") {
          alive = true;
          return resolveOpen(connection);
        }
        if (frame.type === "Error") {
          const message = `TTS ${frame.error_code}: ${frame.error}`;
          if (!alive) return rejectOpen(frame.error_code === 3009 ? new TtsRefused(message) : new Error(message));
          return fail(new Error(message));
        }
        if (frame.type === "Cancelled") {
          discarding = false;
          return;
        }
        if (discarding || !current) return;
        armWatchdog();
        if (frame.type === "Audio") current.args.onAudio(new Uint8Array(Buffer.from(frame.audio, "base64")));
        else if (frame.type === "WordBoundaries") {
          // Word times count from the start of the connection (probed 2026-10-18); the reply's
          // first flush starts at its audio_start_ms. Report them from the reply's start.
          current.startMs ??= frame.audio_start_ms ?? 0;
          const from = current.startMs;
          current.args.onWords?.(frame.words.map((w) => ({ ...w, start: w.start - from, end: w.end - from })));
          current.wordsDone++;
          finishIfDone();
        }
        else if (frame.type === "FlushDone") {
          current.flushesDone++;
          finishIfDone();
        }
      });
      ws.on("close", (code) => {
        const err = new Error(`TTS socket closed (${code})`);
        if (!alive) rejectOpen(err);
        fail(err);
      });
      ws.on("error", (err) => {
        if (!alive) rejectOpen(err);
        fail(err);
      });
    });
  }

  function openLine(voice: string): TtsLine {
    let connection: Connection | null = null;
    let connecting: Promise<Connection> | null = null;
    let holdsSlot = false;
    let closed = false;
    let queue: Promise<void> = Promise.resolve(); // one utterance at a time per line

    /** A live connection, opening (and retrying a refused one) if needed. */
    async function ensure(onQueued: () => void): Promise<Connection> {
      if (connection?.alive) return connection;
      connecting ??= (async () => {
        if (!holdsSlot) {
          await slots.acquire(onQueued);
          holdsSlot = true;
        }
        for (let attempt = 0; ; attempt++) {
          try {
            return await connect(voice);
          } catch (err) {
            // Closed sessions keep counting against the account for up to a minute.
            const wait = retryBusyMs[attempt];
            if (!(err instanceof TtsRefused) || wait === undefined) throw err;
            onQueued();
            await new Promise((r) => setTimeout(r, wait));
          }
        }
      })().finally(() => (connecting = null));
      connection = await connecting;
      return connection;
    }

    async function run(args: SpeakArgs) {
      if (closed || args.signal.aborted) return;
      let toldQueued = false;
      const onQueued = () => {
        if (!toldQueued) args.onQueued?.();
        toldQueued = true;
      };
      const live = await ensure(onQueued);
      if (args.signal.aborted) return;
      await live.utter(args);
    }

    return {
      speak(args) {
        const turn = queue.then(() => run(args));
        queue = turn.catch(() => {});
        return turn;
      },
      close() {
        if (closed) return;
        closed = true;
        void (async () => {
          const live = connection ?? (await connecting?.catch(() => null)) ?? null;
          await live?.terminate();
          if (holdsSlot) slots.release();
          holdsSlot = false;
        })();
      },
    };
  }

  return {
    openLine,
    /** Speaks once on a short-lived line: for narration and other one-off lines. */
    async speak({ voice, ...args }) {
      const line = openLine(voice);
      try {
        await line.speak(args);
      } finally {
        line.close();
      }
    },
  };
}
