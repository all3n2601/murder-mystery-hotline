import { loadCase, type CasePack } from "@mmh/engine";
import { fixtureCase } from "@mmh/engine/test-fixture";
import { describe, expect, it } from "vitest";
import { createSession } from "./session.js";
import { fakeLlm, fakeStt, fakeTts, recorder } from "./test-fakes.js";

function pack(): CasePack {
  const r = loadCase(fixtureCase());
  if (!r.ok) throw new Error(r.errors.join("\n"));
  return r.pack;
}

function setup(opts: { replies?: string[][]; tts?: Parameters<typeof fakeTts>[0] } = {}) {
  const out = recorder();
  const llm = fakeLlm(opts.replies ?? []);
  const tts = fakeTts(opts.tts);
  const stt = fakeStt();
  const session = createSession({
    cases: new Map([["fixture", pack()]]),
    llm: llm.port,
    tts: tts.port,
    stt: stt.port,
    send: out.send,
    sendAudio: out.sendAudio,
  });
  return { session, out, llm, tts, stt };
}

async function onCallWith(s: ReturnType<typeof setup>, suspectId = "cook") {
  await s.session.handle({ type: "start", caseId: "fixture" });
  await s.session.handle({ type: "dial", suspectId });
}

describe("call session", () => {
  it("doesn't treat a finished reply as interrupted when the player hangs up afterwards", async () => {
    const s = setup({ replies: [["Goodnight."]] });
    await onCallWith(s);
    await s.session.handle({ type: "ask", text: "Anything?" });
    await s.session.idle();
    await s.session.handle({ type: "hangup" });
    expect(s.out.ofType("line_end")).toEqual([{ type: "line_end", utteranceId: 1, interrupted: false }]);
    expect(s.out.ofType("stop_audio")).toEqual([]);
  });

  it("speaks the scripted greeting when redialing someone who hung up", async () => {
    const s = setup({ replies: [["Goodbye!\n###META\n", '{"hang_up":true}']] });
    await onCallWith(s, "butler");
    await s.session.handle({ type: "ask", text: "Confess." });
    await s.session.idle();
    await s.session.handle({ type: "dial", suspectId: "butler" });
    await s.session.idle();
    expect(s.tts.spoken.at(-1)).toEqual({ voice: "george", text: "You again?" });
  });

  it("tells the player the lines are busy while their reply waits for a TTS slot", async () => {
    const s = setup({ replies: [["Hold on."]] });
    s.tts.port.speak = async ({ onQueued }) => onQueued?.();
    await onCallWith(s);
    await s.session.handle({ type: "ask", text: "Hello?" });
    await s.session.idle();
    expect(s.out.ofType("call").at(-1)).toEqual({ type: "call", suspectId: "cook", status: "busy" });
  });

  it("delivers the verdict and has the narrator read the ending", async () => {
    const s = setup();
    await onCallWith(s);
    await s.session.handle({ type: "accuse", suspectId: "cook", evidence: [] });
    await s.session.idle();
    expect(s.out.ofType("verdict")).toMatchObject([{ outcome: "wrong", stars: 0, solution: { culprit: "butler" } }]);
    expect(s.tts.spoken).toEqual([{ voice: "anna", text: "Wrong person booked." }]);
    expect(s.out.ofType("line").at(-1)).toMatchObject({ speaker: "hale" });
  });

  it("has the narrator speak a hint after fruitless questions", async () => {
    const s = setup({ replies: [["No."], ["No."], ["No."], ["No."]] });
    await onCallWith(s);
    for (let i = 0; i < 4; i++) {
      await s.session.handle({ type: "ask", text: `q${i}` });
      await s.session.idle();
    }
    expect(s.out.ofType("hint")).toEqual([{ type: "hint", text: "Try the cook." }]);
    expect(s.tts.spoken.at(-1)).toEqual({ voice: "anna", text: "Try the cook." });
  });

  it("ends the call when the suspect hangs up, and refuses questions on a dead line", async () => {
    const s = setup({ replies: [["Get off my line!\n###META\n", '{"hang_up":true}']] });
    await onCallWith(s, "butler");
    await s.session.handle({ type: "ask", text: "You did it." });
    await s.session.idle();
    expect(s.out.ofType("call").at(-1)).toEqual({ type: "call", suspectId: "butler", status: "ended", reason: "suspect" });
    expect(s.stt.closed()).toBe(1);
    await s.session.handle({ type: "ask", text: "Hello?" });
    expect(s.out.ofType("error").at(-1)?.code).toBe("no_call");
  });

  it("covers an LLM failure with a scripted line and doesn't charge the question", async () => {
    const s = setup();
    s.llm.port.stream = async function* () {
      throw new Error("gateway 500");
    };
    await onCallWith(s);
    await s.session.handle({ type: "ask", text: "Anything?" });
    await s.session.idle();
    expect(s.tts.spoken.map((x) => x.text)).toEqual(["Sorry, detective, this line's terrible. Say again?"]);
    expect(s.out.ofType("state").at(-1)?.questionsLeft).toBe(6);
  });

  it("falls back to browser speech when TTS fails, and the game carries on", async () => {
    const s = setup({ replies: [["Crumbs. ", "Everywhere.\n###META\n", '{"reveal":["crumbs"]}']], tts: { fail: true } });
    await onCallWith(s);
    await s.session.handle({ type: "ask", text: "Anything?" });
    await s.session.idle();
    expect(s.out.ofType("fallback_speech")).toMatchObject([{ speaker: "cook", text: "Crumbs. Everywhere." }]);
    expect(s.out.ofType("clues")).toHaveLength(1);
    expect(s.out.ofType("line_end")).toHaveLength(1);
  });

  it("starts a case and sends the public briefing without the solution", async () => {
    const { session, out } = setup();
    await session.handle({ type: "start", caseId: "fixture" });
    const [c] = out.ofType("case");
    expect(c?.publicState.title).toBe("The Fixture Case");
    expect(JSON.stringify(out.messages)).not.toContain("ate the cake");
  });

  it("answers a typed question in the suspect's voice and files the clue", async () => {
    const { session, out, tts } = setup({
      replies: [["Crumbs everywhere. ", "Odd.\n###META\n", '{"reveal":["crumbs"]}']],
    });
    await session.handle({ type: "start", caseId: "fixture" });
    await session.handle({ type: "dial", suspectId: "cook" });
    await session.handle({ type: "ask", text: "Seen anything odd?" });
    await session.idle();

    expect(out.ofType("heard")).toEqual([{ type: "heard", text: "Seen anything odd?" }]);
    expect(tts.spoken).toEqual([
      { voice: "mary", text: "Crumbs everywhere." },
      { voice: "mary", text: "Odd." },
    ]);
    const ids = new Set(out.frames.map((f) => f.utteranceId));
    expect(ids.size).toBe(1);
    expect(out.ofType("line").at(-1)).toMatchObject({ speaker: "cook", text: "Crumbs everywhere. Odd." });
    expect(out.ofType("clues").flatMap((m) => m.clues.map((c) => c.id))).toEqual(["crumbs"]);
    expect(out.ofType("state").at(-1)?.questionsLeft).toBe(5);
  });

  it("answers a spoken question: mic audio reaches STT only while talk is held", async () => {
    const { session, out, stt, tts } = setup({ replies: [["Busy cooking."]] });
    await session.handle({ type: "start", caseId: "fixture" });
    await session.handle({ type: "dial", suspectId: "cook" });
    session.audio(new Uint8Array([9])); // not holding talk: dropped
    await session.handle({ type: "ptt_start" });
    session.audio(new Uint8Array([1, 2]));
    stt.partial("where were");
    stt.willHear("Where were you?");
    await session.handle({ type: "ptt_end" });
    await session.idle();

    expect(stt.audio).toEqual([new Uint8Array([1, 2])]);
    expect(out.ofType("partial")).toEqual([{ type: "partial", text: "where were" }]);
    expect(out.ofType("heard")).toEqual([{ type: "heard", text: "Where were you?" }]);
    expect(tts.spoken.map((s) => s.text)).toEqual(["Busy cooking."]);
  });

  it("lets the player talk over a suspect: audio stops and history keeps only what was heard", async () => {
    const { session, out, tts, llm } = setup({
      replies: [["First I baked. ", "Then I saw the butler. ", "Then I left."], ["Fine."]],
      tts: { msPerSentence: 30 },
    });
    await session.handle({ type: "start", caseId: "fixture" });
    await session.handle({ type: "dial", suspectId: "cook" });
    await session.handle({ type: "ask", text: "Go on." });
    await new Promise((r) => setTimeout(r, 40)); // first sentence is out, second is speaking
    const utteranceId = out.ofType("line")[0]!.utteranceId;
    await session.handle({ type: "ptt_start", interrupted: { utteranceId, playedMs: 500 } });
    const framesAtStop = out.frames.length;
    await session.idle();

    expect(out.ofType("stop_audio")).toEqual([{ type: "stop_audio", utteranceId }]);
    expect(out.ofType("line_end")).toEqual([{ type: "line_end", utteranceId, interrupted: true }]);
    expect(tts.aborts()).toBe(1);
    expect(out.frames.length).toBe(framesAtStop);

    await session.handle({ type: "ask", text: "Sorry, go on." });
    await session.idle();
    const lastAssistant = llm.requests[1]!.messages.filter((m) => m.role === "assistant").at(-1);
    expect(lastAssistant?.content.endsWith("—")).toBe(true);
    expect(lastAssistant?.content).not.toContain("Then I left");
  });
});
