import { describe, expect, it } from "vitest";
import { parseClientMessage, parseServerMessage, MAX_TEXT } from "./messages.js";

describe("client messages", () => {
  it("accepts a dial to a suspect", () => {
    expect(parseClientMessage('{"type":"dial","suspectId":"doyle"}')).toEqual({
      ok: true,
      message: { type: "dial", suspectId: "doyle" },
    });
  });

  it("accepts the push-to-talk boundaries, with an optional barge-in position", () => {
    expect(parseClientMessage('{"type":"ptt_start"}').ok).toBe(true);
    expect(parseClientMessage('{"type":"ptt_start","interrupted":{"utteranceId":3,"playedMs":1200}}').ok).toBe(true);
    expect(parseClientMessage('{"type":"ptt_end"}').ok).toBe(true);
  });

  it("accepts a typed question and rejects one over the length cap", () => {
    expect(parseClientMessage('{"type":"ask","text":"Where were you?"}').ok).toBe(true);
    const long = JSON.stringify({ type: "ask", text: "x".repeat(MAX_TEXT + 1) });
    expect(parseClientMessage(long).ok).toBe(false);
  });

  it("rejects an empty typed question", () => {
    expect(parseClientMessage('{"type":"ask","text":"   "}').ok).toBe(false);
  });

  it("rejects malformed JSON without throwing", () => {
    expect(parseClientMessage("{not json")).toEqual({ ok: false, error: "invalid_json" });
  });

  it("rejects unknown message types", () => {
    expect(parseClientMessage('{"type":"reveal_solution"}').ok).toBe(false);
  });

  it("rejects ids with path or prompt-marker characters", () => {
    expect(parseClientMessage('{"type":"start","caseId":"../etc"}').ok).toBe(false);
    expect(parseClientMessage('{"type":"dial","suspectId":"]]x"}').ok).toBe(false);
  });

  it("rejects accusations with too much evidence", () => {
    const evidence = Array.from({ length: 21 }, (_, i) => `c${i}`);
    expect(parseClientMessage(JSON.stringify({ type: "accuse", suspectId: "doyle", evidence })).ok).toBe(false);
  });

  it("rejects oversized raw payloads before parsing", () => {
    expect(parseClientMessage("x".repeat(20_000))).toEqual({ ok: false, error: "too_large" });
  });
});

describe("server messages", () => {
  it("accepts a spoken line with its utterance id", () => {
    const msg = { type: "line", utteranceId: 7, speaker: "doyle", text: "I was at the desk." };
    expect(parseServerMessage(JSON.stringify(msg))).toEqual({ ok: true, message: msg });
  });

  it("accepts a busy notice for an utterance waiting on the TTS pool", () => {
    expect(parseServerMessage('{"type":"busy","utteranceId":4}').ok).toBe(true);
  });

  it("accepts a verdict with stars and rejects an unknown outcome", () => {
    const ok = { type: "verdict", outcome: "solved", stars: 3, text: "Case closed.", solution: { culprit: "doyle", explanation: "x" } };
    expect(parseServerMessage(JSON.stringify(ok)).ok).toBe(true);
    expect(parseServerMessage(JSON.stringify({ ...ok, outcome: "maybe" })).ok).toBe(false);
  });
});
