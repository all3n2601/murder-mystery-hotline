// Bookkeeping for suspect audio, kept apart from the Web Audio graph so it can be tested
// with plain numbers. Times are AudioContext seconds. Replies play one after another on a
// single queue; a stopped reply's late frames are dropped (see protocol frames.ts).

export type Interruption = { utteranceId: number; playedMs: number };

type Utterance = { startedAt: number; endsAt: number };

export function createUtteranceTracker({ leadIn = 0.05 }: { leadIn?: number } = {}) {
  const live = new Map<number, Utterance>();
  const stopped = new Set<number>();
  const firstAudio = new Map<number, number>(); // when each reply began playing, kept after it ends

  const queueEnd = () => Math.max(0, ...[...live.values()].map((u) => u.endsAt));

  function audible(now: number): number | null {
    for (const [id, u] of live) if (u.startedAt <= now && now < u.endsAt) return id;
    return null;
  }

  function stop(id: number) {
    stopped.add(id);
    live.delete(id);
  }

  return {
    /** Where to schedule a frame of `seconds` length, or null to drop it. */
    frame(id: number, seconds: number, now: number): number | null {
      if (stopped.has(id)) return null;
      for (const [old, u] of live) if (old !== id && u.endsAt < now) live.delete(old);
      const end = queueEnd();
      const at = end > now ? end : now + leadIn;
      const u = live.get(id);
      if (u) u.endsAt = at + seconds;
      else live.set(id, { startedAt: at, endsAt: at + seconds });
      if (!firstAudio.has(id)) {
        firstAudio.set(id, at);
        if (firstAudio.size > 50) firstAudio.delete(firstAudio.keys().next().value!);
      }
      return at;
    },
    audible,
    stop,
    /** Milliseconds of a reply played so far (0 before it starts), or null if it never played. */
    elapsedMs(id: number, now: number): number | null {
      const start = firstAudio.get(id);
      return start === undefined ? null : Math.max(0, Math.round((now - start) * 1000));
    },
    /** The player talked over a suspect: report what was heard and drop the rest. */
    interrupt(now: number): Interruption | null {
      const id = audible(now);
      if (id === null) return null;
      const playedMs = Math.round((now - live.get(id)!.startedAt) * 1000);
      stop(id);
      return { utteranceId: id, playedMs };
    },
  };
}
