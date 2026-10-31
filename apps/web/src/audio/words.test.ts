import { describe, expect, it } from "vitest";
import { wordsSaid } from "./words.js";

const words = [
  { word: "Well,", start: 0, end: 300 },
  { word: "friend,", start: 350, end: 700 },
  { word: "no.", start: 900, end: 1100 },
];

describe("wordsSaid", () => {
  it("counts the words whose sound has started by now", () => {
    expect(wordsSaid(words, 0)).toBe(1);
    expect(wordsSaid(words, 349)).toBe(1);
    expect(wordsSaid(words, 350)).toBe(2);
    expect(wordsSaid(words, 5000)).toBe(3);
  });

  it("says nothing before the first word or without timings", () => {
    expect(wordsSaid(words.map((w) => ({ ...w, start: w.start + 100 })), 50)).toBe(0);
    expect(wordsSaid([], 500)).toBe(0);
  });
});
