import { randomUUID } from "node:crypto";
import type { ServerMessage } from "@mmh/protocol";

// Keeps a player's game alive across a dropped socket or a page refresh. A game whose socket
// is gone survives for ttlMs, then is disposed so its STT line stops billing.

export type Transport = { send(message: ServerMessage): void; sendAudio(frame: Uint8Array): void };

type Resumable = { resync(): void; dispose(): void };

export function createRegistry<S extends Resumable>(opts: {
  ttlMs: number;
  create(transport: Transport): S;
  now?: () => number;
}) {
  const now = opts.now ?? Date.now;
  const games = new Map<string, { session: S; socket: Transport | null; detachedAt: number }>();

  /** Sends to whichever socket currently owns the game; drops output while it has none. */
  function relay(id: string): Transport {
    return {
      send: (m) => games.get(id)?.socket?.send(m),
      sendAudio: (f) => games.get(id)?.socket?.sendAudio(f),
    };
  }

  return {
    connect(socket: Transport, resumeId: string | undefined): { sessionId: string; session: S; resumed: boolean } {
      const existing = resumeId ? games.get(resumeId) : undefined;
      // Only a detached game within its window can be resumed: a live one can't be stolen.
      if (resumeId && existing && !existing.socket && now() - existing.detachedAt <= opts.ttlMs) {
        existing.socket = socket;
        existing.session.resync();
        return { sessionId: resumeId, session: existing.session, resumed: true };
      }
      const sessionId = randomUUID().replaceAll("-", "");
      const session = opts.create(relay(sessionId));
      games.set(sessionId, { session, socket, detachedAt: 0 });
      return { sessionId, session, resumed: false };
    },

    disconnect(sessionId: string) {
      const game = games.get(sessionId);
      if (!game) return;
      game.socket = null;
      game.detachedAt = now();
    },

    /** Disposes games whose players didn't come back in time. Call on a timer. */
    sweep() {
      for (const [id, game] of games) {
        if (!game.socket && now() - game.detachedAt > opts.ttlMs) {
          game.session.dispose();
          games.delete(id);
        }
      }
    },
  };
}
