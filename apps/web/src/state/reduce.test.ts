import { describe, expect, it } from "vitest";
import type { PublicCaseState, ServerMessage } from "@mmh/protocol";
import { initialState, reduce, type GameState } from "./reduce.js";

const publicState: PublicCaseState = {
  caseId: "night-operator",
  title: "The Night Operator",
  era: "1947",
  briefing: "Dot is dead.",
  questionBudget: 25,
  suspects: [{ id: "doyle", name: "Frank Doyle", role: "night manager", line: "MA-4410" }],
  startingEvidence: [{ id: "call_log", title: "Dot's call log", text: "1:15 …", source: "start" }],
  leads: [],
};
const clue = (id: string) => ({ id, title: id, text: `${id} text`, source: "doyle" });

const run = (...messages: ServerMessage[]): GameState => messages.reduce(reduce, initialState);

describe("reduce", () => {
  it("opening a case fills the notebook with the starting evidence and the full question budget", () => {
    const s = run({ type: "case", publicState });
    expect(s.case?.title).toBe("The Night Operator");
    expect(s.clues.map((c) => c.id)).toEqual(["call_log"]);
    expect(s.questionsLeft).toBe(25);
  });

  it("builds one caption per reply as its text grows", () => {
    const s = run(
      { type: "line", utteranceId: 1, speaker: "doyle", text: "Evening." },
      { type: "line", utteranceId: 1, speaker: "doyle", text: "Evening. What do you want, friend?" },
    );
    expect(s.transcript).toEqual([{ key: "u1", speaker: "doyle", text: "Evening. What do you want, friend?", interrupted: false }]);
  });

  it("shows what the player is saying live, then logs what was heard", () => {
    let s = run({ type: "partial", text: "where were" });
    expect(s.partial).toBe("where were");
    s = reduce(s, { type: "heard", text: "Where were you at one thirty?" });
    expect(s.partial).toBe("");
    expect(s.transcript.at(-1)).toMatchObject({ speaker: "you", text: "Where were you at one thirty?" });
  });

  it("marks a reply the player talked over as cut off", () => {
    const s = run(
      { type: "line", utteranceId: 2, speaker: "doyle", text: "I was at the—" },
      { type: "line_end", utteranceId: 2, interrupted: true },
    );
    expect(s.transcript[0]?.interrupted).toBe(true);
  });

  it("new clues join the notebook once and are flagged as fresh", () => {
    const s = run({ type: "case", publicState }, { type: "clues", clues: [clue("doyle_alibi")] }, { type: "clues", clues: [clue("doyle_alibi")] });
    expect(s.clues.map((c) => c.id)).toEqual(["call_log", "doyle_alibi"]);
    expect(s.freshClues).toEqual(["doyle_alibi"]);
  });

  it("a resumed game restores the notebook without flagging old clues as fresh", () => {
    const s = run(
      { type: "welcome", sessionId: "abc", resumed: true },
      { type: "case", publicState },
      { type: "clues", clues: [publicState.startingEvidence[0]!, clue("doyle_alibi")] },
    );
    expect(s.resumed).toBe(true);
    expect(s.clues.map((c) => c.id)).toEqual(["call_log", "doyle_alibi"]);
    expect(s.freshClues).toEqual([]);
    expect(reduce(s, { type: "clues", clues: [clue("leo_tip")] }).freshClues).toEqual(["leo_tip"]);
  });

  it("tracks the live call and why it ended", () => {
    let s = run({ type: "call", suspectId: "doyle", status: "connected" });
    expect(s.call).toEqual({ suspectId: "doyle", status: "connected" });
    s = reduce(s, { type: "call", suspectId: "doyle", status: "ended", reason: "suspect" });
    expect(s.call).toEqual({ suspectId: "doyle", status: "ended", reason: "suspect" });
  });

  it("takes questions left and nerves from the state message", () => {
    const s = run({ type: "case", publicState }, { type: "state", questionsLeft: 20, nerves: { doyle: 6 }, activeCall: "doyle" });
    expect(s.questionsLeft).toBe(20);
    expect(s.nerves).toEqual({ doyle: 6 });
  });

  it("shows all-lines-busy until that reply starts speaking or ends", () => {
    let s = run({ type: "busy", utteranceId: 5 });
    expect(s.busy).toBe(true);
    s = reduce(s, { type: "words", utteranceId: 5, words: [{ word: "Well", start: 0, end: 200 }] });
    expect(s.busy).toBe(false);
    expect(run({ type: "busy", utteranceId: 6 }, { type: "line_end", utteranceId: 6, interrupted: false }).busy).toBe(false);
  });

  it("keeps hints in order for the notebook", () => {
    const s = run({ type: "hint", text: "Ask Leo." }, { type: "hint", text: "Push Doyle." });
    expect(s.hints).toEqual(["Ask Leo.", "Push Doyle."]);
  });

  it("captions a fallback line like any other reply", () => {
    const s = run({ type: "fallback_speech", utteranceId: 9, speaker: "doyle", text: "Line's bad." });
    expect(s.transcript.at(-1)).toMatchObject({ key: "u9", speaker: "doyle", text: "Line's bad." });
  });

  it("keeps the verdict and the latest error", () => {
    const solution = { culprit: "doyle", explanation: "He did it." };
    const s = run(
      { type: "error", code: "no_call", message: "Plug into a line first." },
      { type: "verdict", outcome: "solved", stars: 3, text: "Well done.", solution },
    );
    expect(s.error).toEqual({ code: "no_call", message: "Plug into a line first." });
    expect(s.verdict).toEqual({ outcome: "solved", stars: 3, text: "Well done.", solution });
  });

  it("keeps the transcript bounded", () => {
    const lines = Array.from({ length: 120 }, (_, i): ServerMessage => ({ type: "heard", text: `q${i}` }));
    const s = run(...lines);
    expect(s.transcript).toHaveLength(80);
    expect(s.transcript.at(-1)?.text).toBe("q119");
  });

  it("waits on a reply from when the question is heard until the suspect starts answering", () => {
    let s = run({ type: "call", suspectId: "doyle", status: "connected" }, { type: "heard", text: "Where were you?" });
    expect(s.awaitingReply).toBe(true);
    s = reduce(s, { type: "line", utteranceId: 3, speaker: "hale", text: "A hint from Mrs. Hale." });
    expect(s.awaitingReply).toBe(true); // the narrator talking isn't the suspect answering
    s = reduce(s, { type: "line", utteranceId: 4, speaker: "doyle", text: "At the desk." });
    expect(s.awaitingReply).toBe(false);
  });

  it("stops waiting if the call ends or the question fails", () => {
    const heard = run({ type: "call", suspectId: "doyle", status: "connected" }, { type: "heard", text: "Where?" });
    expect(reduce(heard, { type: "call", suspectId: "doyle", status: "ended", reason: "suspect" }).awaitingReply).toBe(false);
    expect(reduce(heard, { type: "error", code: "llm", message: "Line's bad." }).awaitingReply).toBe(false);
  });

  it("keeps each reply's word timings for synced captions", () => {
    const s = run(
      { type: "words", utteranceId: 7, words: [{ word: "Well,", start: 0, end: 300 }] },
      { type: "words", utteranceId: 7, words: [{ word: "friend.", start: 300, end: 700 }] },
    );
    expect(s.words[7]).toEqual([
      { word: "Well,", start: 0, end: 300 },
      { word: "friend.", start: 300, end: 700 },
    ]);
  });

  it("remembers who you've called and who hung up on you, until you ring them back", () => {
    let s = run(
      { type: "call", suspectId: "doyle", status: "connected" },
      { type: "call", suspectId: "doyle", status: "ended", reason: "suspect" },
      { type: "call", suspectId: "leo", status: "connected" },
      { type: "call", suspectId: "leo", status: "ended", reason: "player" },
    );
    expect(s.called).toEqual(["doyle", "leo"]);
    expect(s.hungUpOn).toEqual(["doyle"]);
    s = reduce(s, { type: "call", suspectId: "doyle", status: "connected" });
    expect(s.hungUpOn).toEqual([]);
    expect(s.called).toEqual(["doyle", "leo"]);
  });

  it("files each caption under the call it was said on", () => {
    const s = run(
      { type: "call", suspectId: "doyle", status: "connected" },
      { type: "heard", text: "Where were you?" },
      { type: "line", utteranceId: 1, speaker: "doyle", text: "At the desk." },
    );
    expect(s.transcript.map((c) => c.call)).toEqual(["doyle", "doyle"]);
  });
});
