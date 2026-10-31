import { describe, expect, it } from "vitest";
import { layoutNarration } from "./narration.js";

const w = (word: string, start: number, end: number) => ({ word, start, end });

describe("layoutNarration", () => {
  it("places each line after the last, with that line's pause, and shifts its words to match", () => {
    const layout = layoutNarration(
      [
        {
          id: "night",
          lines: [
            { durationMs: 1000, words: [w("MAdison", 100, 500), w("Exchange.", 500, 900)], pause: 0.5 },
            { durationMs: 800, words: [w("Raining.", 100, 700)] },
          ],
        },
      ],
      { leadInMs: 600, trimLeadMs: 0, trimTailMs: 0, defaultPauseMs: 400 },
    );
    // Line 1 clip [100, 900) sits at 600; line 2 starts 500 ms after line 1 ends (1400 + 500).
    expect(layout.words).toEqual([w("MAdison", 600, 1000), w("Exchange.", 1000, 1400), w("Raining.", 1900, 2500)]);
    expect(layout.durationMs).toBe(2500 + 400); // ends with the default pause after the last line
  });

  it("trims the TTS's own padding to just around the words", () => {
    const layout = layoutNarration([{ id: "a", lines: [{ durationMs: 2000, words: [w("Hello.", 600, 1000)] }] }], {
      leadInMs: 0,
      trimLeadMs: 80,
      trimTailMs: 150,
      defaultPauseMs: 0,
    });
    expect(layout.clips).toEqual([{ act: 0, line: 0, fromMs: 520, toMs: 1150, atMs: 0 }]);
    expect(layout.words).toEqual([w("Hello.", 80, 480)]);
  });

  it("never trims past the ends of the clip", () => {
    const layout = layoutNarration([{ id: "a", lines: [{ durationMs: 1000, words: [w("Hi.", 20, 990)] }] }], {
      leadInMs: 0,
      trimLeadMs: 80,
      trimTailMs: 150,
      defaultPauseMs: 0,
    });
    expect(layout.clips[0]).toMatchObject({ fromMs: 0, toMs: 1000 });
  });

  it("reports when each act starts, so shots can cut on it", () => {
    const line = { durationMs: 1000, words: [w("x", 0, 1000)], pause: 1 };
    const layout = layoutNarration(
      [
        { id: "night", lines: [line, line] },
        { id: "victim", lines: [line] },
      ],
      { leadInMs: 500, trimLeadMs: 0, trimTailMs: 0, defaultPauseMs: 0 },
    );
    expect(layout.acts).toEqual([
      { id: "night", startMs: 500 },
      { id: "victim", startMs: 4500 },
    ]);
  });
});
