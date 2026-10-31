import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerMessage } from "@mmh/protocol";
import { createGameSocket, type LinkStatus } from "./socket.js";

class FakeSocket {
  static all: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  binaryType = "blob";
  sent: (string | ArrayBufferLike | ArrayBufferView)[] = [];
  onopen: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string | ArrayBufferLike | ArrayBufferView) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
  receive(m: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }
  json() {
    return this.sent.filter((d): d is string => typeof d === "string").map((d) => JSON.parse(d));
  }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v), removeItem: (k: string) => void delete data[k], data };
}

function setup(storage = memoryStorage()) {
  const messages: ServerMessage[] = [];
  const audio: Uint8Array[] = [];
  const statuses: LinkStatus[] = [];
  const link = createGameSocket({
    url: "ws://test/game",
    storage,
    WebSocket: FakeSocket as unknown as typeof WebSocket,
    onMessage: (m) => messages.push(m),
    onAudio: (a) => audio.push(a),
    onStatus: (s) => statuses.push(s),
    retryDelays: [100, 200],
  });
  return { link, messages, audio, statuses, storage, ws: () => FakeSocket.all.at(-1)! };
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("createGameSocket", () => {
  it("says hello without a session on a first visit", () => {
    const { ws } = setup();
    ws().open();
    expect(ws().json()).toEqual([{ type: "hello" }]);
  });

  it("remembers the session from welcome and resumes it on the next visit", () => {
    const first = setup();
    first.ws().open();
    first.ws().receive({ type: "welcome", sessionId: "abc", resumed: false });

    const second = setup(first.storage);
    second.ws().open();
    expect(second.ws().json()).toEqual([{ type: "hello", sessionId: "abc" }]);
  });

  it("passes valid server messages on and ignores garbage", () => {
    const { ws, messages } = setup();
    ws().open();
    ws().onmessage?.({ data: "{not json" });
    ws().onmessage?.({ data: JSON.stringify({ type: "nonsense" }) });
    ws().receive({ type: "hint", text: "Ask Leo." });
    expect(messages).toEqual([{ type: "hint", text: "Ask Leo." }]);
  });

  it("hands binary frames to the audio handler", () => {
    const { ws, audio } = setup();
    ws().open();
    ws().onmessage?.({ data: new Uint8Array([1, 0, 0, 0, 9, 9]).buffer });
    expect(audio).toEqual([new Uint8Array([1, 0, 0, 0, 9, 9])]);
  });

  it("sends messages and audio only while the line is open", () => {
    const { link, ws } = setup();
    expect(link.send({ type: "hangup" })).toBe(false);
    ws().open();
    expect(link.send({ type: "hangup" })).toBe(true);
    link.sendAudio(new Int16Array([1, 2]));
    expect(ws().sent.at(-1)).toBeInstanceOf(ArrayBuffer);
  });

  it("reconnects after a drop and resumes the same session", () => {
    const { ws, statuses } = setup();
    ws().open();
    ws().receive({ type: "welcome", sessionId: "abc", resumed: false });
    ws().drop();
    expect(statuses.at(-1)).toBe("reconnecting");
    vi.advanceTimersByTime(100);
    ws().open();
    expect(ws().json()).toEqual([{ type: "hello", sessionId: "abc" }]);
    expect(statuses.at(-1)).toBe("open");
  });

  it("gives up after the last retry and reports the line as offline", () => {
    const { ws, statuses } = setup();
    ws().open();
    ws().drop();
    vi.advanceTimersByTime(100);
    ws().drop();
    vi.advanceTimersByTime(200);
    ws().drop();
    expect(statuses.at(-1)).toBe("offline");
    expect(FakeSocket.all).toHaveLength(3);
  });

  it("a successful reconnect resets the retry budget", () => {
    const { ws, statuses } = setup();
    ws().open();
    ws().drop();
    vi.advanceTimersByTime(100);
    ws().open();
    ws().drop();
    vi.advanceTimersByTime(100);
    ws().open();
    expect(statuses.at(-1)).toBe("open");
  });

  it("closing on purpose does not reconnect", () => {
    const { link, ws } = setup();
    ws().open();
    link.close();
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("can start fresh, forgetting the stored session", () => {
    const { link, ws, storage } = setup(memoryStorage({ "hotline-session": "old" }));
    link.forgetSession();
    ws().open();
    expect(ws().json()).toEqual([{ type: "hello" }]);
    expect(storage.data["hotline-session"]).toBeUndefined();
  });
});
