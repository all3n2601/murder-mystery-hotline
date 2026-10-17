import { describe, expect, it } from "vitest";
import { createRegistry, type Transport } from "./registry.js";

function fakeSessions() {
  const made: { transportSends: () => number; resyncs: number; disposed: boolean }[] = [];
  return {
    made,
    factory: (transport: Transport) => {
      let sends = 0;
      const entry = { transportSends: () => sends, resyncs: 0, disposed: false };
      made.push(entry);
      return {
        ping: () => {
          transport.send({ type: "hint", text: "ping" });
          sends++;
        },
        resync: () => entry.resyncs++,
        dispose: () => (entry.disposed = true),
      };
    },
  };
}

const socket = () => {
  const sent: unknown[] = [];
  return { sent, transport: { send: (m: unknown) => sent.push(m), sendAudio: () => {} } as Transport };
};

describe("session registry", () => {
  it("resumes a dropped game by id within the window, sending to the new socket", () => {
    let now = 0;
    const fakes = fakeSessions();
    const registry = createRegistry({ ttlMs: 1000, now: () => now, create: fakes.factory });
    const first = socket();
    const a = registry.connect(first.transport, undefined);
    registry.disconnect(a.sessionId);
    now = 900;
    const second = socket();
    const b = registry.connect(second.transport, a.sessionId);
    expect(b).toMatchObject({ sessionId: a.sessionId, resumed: true });
    expect(fakes.made).toHaveLength(1);
    expect(fakes.made[0]!.resyncs).toBe(1);
    b.session.ping();
    expect(second.sent).toHaveLength(1); // goes to the new socket, not the dead one
    expect(first.sent).toHaveLength(0);
  });

  it("starts fresh, and disposes the old game, once the window has passed", () => {
    let now = 0;
    const fakes = fakeSessions();
    const registry = createRegistry({ ttlMs: 1000, now: () => now, create: fakes.factory });
    const a = registry.connect(socket().transport, undefined);
    registry.disconnect(a.sessionId);
    now = 1001;
    registry.sweep();
    expect(fakes.made[0]!.disposed).toBe(true);
    const b = registry.connect(socket().transport, a.sessionId);
    expect(b.resumed).toBe(false);
    expect(b.sessionId).not.toBe(a.sessionId);
  });

  it("won't let a second socket steal a game that is still connected", () => {
    const fakes = fakeSessions();
    const registry = createRegistry({ ttlMs: 1000, now: () => 0, create: fakes.factory });
    const a = registry.connect(socket().transport, undefined);
    const b = registry.connect(socket().transport, a.sessionId);
    expect(b.resumed).toBe(false);
  });
});
