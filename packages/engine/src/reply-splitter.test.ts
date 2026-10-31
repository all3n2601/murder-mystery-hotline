import { describe, expect, it } from "vitest";
import { createReplySplitter } from "./reply-splitter.js";

/** Feeds chunks through a splitter and collects everything it says to speak. */
function run(chunks: string[]) {
  const splitter = createReplySplitter();
  const spoken: string[] = [];
  for (const c of chunks) spoken.push(...splitter.push(c));
  const end = splitter.end();
  spoken.push(...end.sentences);
  return { spoken, meta: end.meta };
}

describe("reply splitter", () => {
  it("passes a plain reply through as speech", () => {
    expect(run(["I was at the desk ", "all night."]).spoken.join(" ")).toBe("I was at the desk all night.");
  });

  it("releases a finished sentence as soon as the next one begins", () => {
    const splitter = createReplySplitter();
    expect(splitter.push("I was at the desk.")).toEqual([]);
    expect(splitter.push(" Then I went")).toEqual(["I was at the desk."]);
  });

  it("never speaks any part of the marker, wherever the stream splits it", () => {
    const reply = 'Go away, detective. I said go away.\n###META\n{"hang_up":true}';
    for (let cut = 1; cut < reply.length; cut++) {
      const r = run([reply.slice(0, cut), reply.slice(cut)]);
      expect(r.spoken.join(" "), `cut at ${cut}`).toBe("Go away, detective. I said go away.");
      expect(r.meta, `cut at ${cut}`).toBe('{"hang_up":true}');
    }
  });

  it("strips stage directions and markdown before speech", () => {
    const r = run(["(sighs) *nervously* I **never** saw him. [pause] ", "Not once."]);
    expect(r.spoken).toEqual(["I never saw him.", "Not once."]);
  });

  // The TTS reads bracket tags aloud (verified 2026-10-18 by transcribing its audio), but it
  // performs these spellings. See docs/reference/assemblyai/tts-markup.md.
  it("turns sound cues into spellings the TTS performs instead of reading the tag aloud", () => {
    expect(run(["[sighs] Fine."]).spoken).toEqual(["Haah… Fine."]);
    expect(run(["Smooth as a new dime. [laughs]"]).spoken).toEqual(["Smooth as a new dime.", "Ha! Ha ha."]);
    expect(run(["[CHUCKLES] Sure, friend."]).spoken).toEqual(["Heh heh. Sure, friend."]);
  });

  it("drops every bracketed cue it can't perform, including ones it reads as words", () => {
    expect(run(["[pause] [walks away] (grins) [clears throat] [scoffs] Goodnight."]).spoken).toEqual(["Goodnight."]);
  });

  it("performs only the first sound cue in a reply, so the sounds don't pile up", () => {
    const r = run(["[laughs] Stop right there. ", "[sighs] Now, any other clues? [chuckles]"]);
    expect(r.spoken).toEqual(["Ha! Ha ha. Stop right there.", "Now, any other clues?"]);
  });

  it("keeps the META block out of speech and returns it separately", () => {
    const r = run(["Leave me alone.\n###META\n", '{"pressure_change":1}']);
    expect(r.spoken.join(" ")).toBe("Leave me alone.");
    expect(r.meta).toBe('{"pressure_change":1}');
  });

  it("treats a bare JSON block as META when the small model forgets the marker", () => {
    const r = run(["You're barking up the wrong tree. ", '{"reveal": 0, ', '"pressure_change": 1}']);
    expect(r.spoken.join(" ")).toBe("You're barking up the wrong tree.");
    expect(r.meta).toBe('{"reveal": 0, "pressure_change": 1}');
  });
});
