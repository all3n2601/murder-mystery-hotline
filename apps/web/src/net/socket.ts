// The game socket: JSON messages both ways, binary audio frames down, PCM16 mic audio up.
// Resumes the same server session after a refresh or a dropped line (the server keeps the
// game for 10 minutes), retrying on a fixed schedule before giving up.

import { parseServerMessage, type ClientMessage, type ServerMessage } from "@mmh/protocol";

export type LinkStatus = "connecting" | "open" | "reconnecting" | "offline";

type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const SESSION_KEY = "hotline-session";

export function createGameSocket(opts: {
  url: string;
  storage: SessionStorage | null;
  WebSocket: typeof WebSocket;
  onMessage: (m: ServerMessage) => void;
  onAudio: (frame: Uint8Array) => void;
  onStatus: (s: LinkStatus) => void;
  retryDelays?: number[];
}) {
  const { storage, retryDelays = [500, 1000, 2000, 4000, 8000, 15000] } = opts;
  // Private mode or blocked site data can make storage throw; the game still works, it just can't resume.
  const read = () => {
    try {
      return storage?.getItem(SESSION_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  };
  const write = (fn: (s: SessionStorage) => void) => {
    try {
      if (storage) fn(storage);
    } catch {}
  };

  let ws: WebSocket;
  let attempt = 0;
  let closing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function connect() {
    ws = new opts.WebSocket(opts.url);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      attempt = 0;
      const sessionId = read();
      ws.send(JSON.stringify(sessionId ? { type: "hello", sessionId } : { type: "hello" }));
      opts.onStatus("open");
    };
    ws.onmessage = (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) return opts.onAudio(new Uint8Array(e.data));
      if (typeof e.data !== "string") return;
      const parsed = parseServerMessage(e.data);
      if (!parsed.ok) return;
      if (parsed.message.type === "welcome") {
        const { sessionId } = parsed.message;
        write((s) => s.setItem(SESSION_KEY, sessionId));
      }
      opts.onMessage(parsed.message);
    };
    ws.onclose = () => {
      if (closing) return;
      const delay = retryDelays[attempt++];
      if (delay === undefined) return opts.onStatus("offline");
      opts.onStatus("reconnecting");
      timer = setTimeout(connect, delay);
    };
  }

  opts.onStatus("connecting");
  connect();

  const isOpen = () => ws.readyState === opts.WebSocket.OPEN;

  return {
    send(m: ClientMessage): boolean {
      if (!isOpen()) return false;
      ws.send(JSON.stringify(m));
      return true;
    },
    sendAudio(pcm: Int16Array) {
      if (isOpen()) ws.send(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
    },
    forgetSession() {
      write((s) => s.removeItem(SESSION_KEY));
    },
    /** Try again from scratch after the line went offline. */
    retry() {
      if (isOpen()) return;
      clearTimeout(timer);
      attempt = 0;
      opts.onStatus("connecting");
      connect();
    },
    close() {
      closing = true;
      clearTimeout(timer);
      ws.close();
    },
  };
}
