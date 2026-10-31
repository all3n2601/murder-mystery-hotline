import { describe, expect, it } from "vitest";
import { receiverState, type ReceiverInput } from "./receiver.js";

const base: ReceiverInput = {
  call: { suspectId: "doyle", status: "connected" },
  dialing: null,
  talking: false,
  awaitingReply: false,
  speaking: null,
  mic: "ok",
  questionsLeft: 10,
};
const state = (over: Partial<ReceiverInput>) => receiverState({ ...base, ...over });

describe("receiverState", () => {
  it("asks you to ring someone when no line is open", () => {
    expect(state({ call: null })).toEqual({ kind: "idle" });
    expect(state({ call: { suspectId: "doyle", status: "ended" } })).toEqual({ kind: "idle" });
  });

  it("shows the line ringing while a dial is in progress", () => {
    expect(state({ call: null, dialing: "leo" })).toEqual({ kind: "ringing", who: "leo" });
  });

  it("is ready to talk once connected", () => {
    expect(state({})).toEqual({ kind: "ready", who: "doyle" });
  });

  it("listens while talk is held, even over a suspect who is speaking", () => {
    expect(state({ talking: true, speaking: "doyle" })).toEqual({ kind: "listening", who: "doyle" });
  });

  it("shows the suspect thinking between your question and their answer", () => {
    expect(state({ awaitingReply: true })).toEqual({ kind: "thinking", who: "doyle" });
  });

  it("shows the suspect speaking, which you can talk over", () => {
    expect(state({ speaking: "doyle" })).toEqual({ kind: "speaking", who: "doyle" });
  });

  it("doesn't treat the narrator speaking as the suspect", () => {
    expect(state({ speaking: "hale" })).toEqual({ kind: "ready", who: "doyle" });
  });

  it("falls back to typing without a microphone, and stops when questions run out", () => {
    expect(state({ mic: "denied" })).toEqual({ kind: "type-only", who: "doyle" });
    expect(state({ mic: "unknown" })).toEqual({ kind: "type-only", who: "doyle" });
    expect(state({ questionsLeft: 0 })).toEqual({ kind: "out", who: "doyle" });
  });
});
