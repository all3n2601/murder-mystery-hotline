import { describe, expect, it } from "vitest";
import { loadCase } from "./case.js";
import { fixtureCase } from "./test-fixture.js";

function errorsFor(mutate: (c: ReturnType<typeof fixtureCase>) => void): string[] {
  const c = fixtureCase();
  mutate(c);
  const r = loadCase(c);
  return r.ok ? [] : r.errors;
}

describe("loadCase", () => {
  it("loads a valid case pack", () => {
    const r = loadCase(fixtureCase());
    expect(r.ok).toBe(true);
  });

  it("rejects references to clues and characters that do not exist", () => {
    const errors = errorsFor((c) => {
      c.characters[1]!.clues![1]!.requires = ["ghost"];
      c.solution.culprit = "gardener";
      c.solution.keyClues.push("phantom");
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ghost"),
        expect.stringContaining("gardener"),
        expect.stringContaining("phantom"),
      ]),
    );
  });

  it("rejects clues locked behind a circular requires chain", () => {
    const errors = errorsFor((c) => {
      c.characters[0]!.clues![0]!.requires = ["slip"]; // crumbs needs slip, slip needs crumbs
    });
    expect(errors).toEqual(expect.arrayContaining([expect.stringMatching(/(crumbs|slip) is unreachable/)]));
  });

  it("rejects a case whose key clues can't reach the minimum without the confession", () => {
    const errors = errorsFor((c) => {
      c.solution.minKeyClues = 4; // only 3 key clues exist
    });
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("minKeyClues")]));
  });

  it("rejects voices the TTS endpoint doesn't offer, and shared voices", () => {
    const errors = errorsFor((c) => {
      c.characters[0]!.voice = "giovanni"; // Voice Agent only, not on streaming TTS
      c.narrator.voice = "george"; // same as the butler
    });
    expect(errors).toEqual(
      expect.arrayContaining([expect.stringContaining("giovanni"), expect.stringContaining("george")]),
    );
  });

  it("loads a character's speech style", () => {
    const c = fixtureCase();
    c.characters[1]!.speech = { tone: "smooth, condescending", habits: ["calls everyone 'old sport'"], fillers: ["well"], phrases: ["Quite."], tags: ["chuckles"] };
    const r = loadCase(c);
    expect(r.ok && r.pack.characters[1]!.speech).toMatchObject({ tone: "smooth, condescending", tags: ["chuckles"] });
  });

  it("rejects speech tags the TTS isn't known to act out", () => {
    const errors = errorsFor((c) => {
      c.characters[1]!.speech = { tone: "smooth", tags: ["whistles"] };
    });
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("whistles")]));
  });

  it("rejects a case with fewer than two plausible motives", () => {
    const errors = errorsFor((c) => {
      c.characters[0]!.motive = null;
    });
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("motive")]));
  });
});
