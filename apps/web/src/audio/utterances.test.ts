import { describe, expect, it } from "vitest";
import { createUtteranceTracker } from "./utterances.js";

describe("createUtteranceTracker", () => {
  it("schedules a reply's frames back to back after a short lead-in", () => {
    const t = createUtteranceTracker({ leadIn: 0.05 });
    expect(t.frame(1, 0.1, 10)).toBe(10.05);
    expect(t.frame(1, 0.1, 10.01)).toBeCloseTo(10.15);
  });

  it("restarts the queue from now when audio arrives after a gap", () => {
    const t = createUtteranceTracker({ leadIn: 0 });
    t.frame(1, 0.1, 0);
    expect(t.frame(1, 0.1, 5)).toBe(5);
  });

  it("reports who is audible, and nobody once their audio has run out", () => {
    const t = createUtteranceTracker({ leadIn: 0 });
    t.frame(7, 1, 0);
    expect(t.audible(0.5)).toBe(7);
    expect(t.audible(1.5)).toBeNull();
  });

  it("on interrupt, reports how much of the reply was heard and drops the rest", () => {
    const t = createUtteranceTracker({ leadIn: 0 });
    t.frame(3, 2, 0);
    expect(t.interrupt(0.75)).toEqual({ utteranceId: 3, playedMs: 750 });
    expect(t.audible(0.8)).toBeNull();
    expect(t.frame(3, 0.1, 0.9)).toBeNull(); // late frames from the cut reply are dropped
  });

  it("interrupting silence reports nothing", () => {
    const t = createUtteranceTracker({ leadIn: 0 });
    t.frame(3, 1, 0);
    expect(t.interrupt(5)).toBeNull();
  });

  it("drops frames for a reply the server stopped", () => {
    const t = createUtteranceTracker({ leadIn: 0 });
    t.stop(4);
    expect(t.frame(4, 0.1, 0)).toBeNull();
    expect(t.frame(5, 0.1, 0)).toBe(0);
  });

  it("a new reply waits for the previous one to finish instead of talking over it", () => {
    const t = createUtteranceTracker({ leadIn: 0 });
    t.frame(1, 1, 0);
    expect(t.frame(2, 0.5, 0.2)).toBe(1);
  });

  it("reports how far into a reply playback is, for synced captions", () => {
    const t = createUtteranceTracker({ leadIn: 0.1 });
    t.frame(5, 1, 2); // first audio plays from 2.1 s
    expect(t.elapsedMs(5, 2.0)).toBe(0); // not started yet
    expect(t.elapsedMs(5, 2.6)).toBe(500);
    expect(t.elapsedMs(9, 2.6)).toBeNull(); // never heard
  });
});
