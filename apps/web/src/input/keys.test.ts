import { describe, expect, it } from "vitest";
import { keyAction, type KeyInput } from "./keys.js";

const key = (code: string, over: Partial<KeyInput> = {}): KeyInput => ({ code, phase: "down", repeat: false, mod: false, ...over });

describe("keyAction", () => {
  it("holding Space talks and releasing it stops", () => {
    expect(keyAction(key("Space"), { typing: false })).toEqual({ type: "talk_start" });
    expect(keyAction(key("Space", { phase: "up" }), { typing: false })).toEqual({ type: "talk_end" });
  });

  it("auto-repeat while Space is held does nothing", () => {
    expect(keyAction(key("Space", { repeat: true }), { typing: false })).toBeNull();
  });

  it("while typing, Space, digits and letters belong to the text box", () => {
    for (const code of ["Space", "Digit1", "KeyN", "KeyA"]) expect(keyAction(key(code), { typing: true })).toBeNull();
  });

  it("1 to 4 dial the suspects in switchboard order", () => {
    expect(keyAction(key("Digit1"), { typing: false })).toEqual({ type: "dial", index: 0 });
    expect(keyAction(key("Digit4"), { typing: false })).toEqual({ type: "dial", index: 3 });
    expect(keyAction(key("Digit5"), { typing: false })).toBeNull();
  });

  it("Esc hangs up, or leaves the text box when typing", () => {
    expect(keyAction(key("Escape"), { typing: false })).toEqual({ type: "hangup" });
    expect(keyAction(key("Escape"), { typing: true })).toEqual({ type: "leave_input" });
  });

  it("N opens the notebook and A opens the accusation", () => {
    expect(keyAction(key("KeyN"), { typing: false })).toEqual({ type: "notebook" });
    expect(keyAction(key("KeyA"), { typing: false })).toEqual({ type: "accuse" });
  });

  it("leaves browser shortcuts like Cmd+N alone", () => {
    expect(keyAction(key("KeyN", { mod: true }), { typing: false })).toBeNull();
  });

  it("T jumps to the text box and ? shows the controls", () => {
    expect(keyAction(key("KeyT"), { typing: false })).toEqual({ type: "focus_type" });
    expect(keyAction(key("Slash"), { typing: false })).toEqual({ type: "help" });
    expect(keyAction(key("KeyT"), { typing: true })).toBeNull();
  });

  it("Tab switches notebook tabs only while the notebook is in view", () => {
    expect(keyAction(key("Tab"), { typing: false, notebook: true })).toEqual({ type: "next_tab" });
    expect(keyAction(key("Tab"), { typing: false, notebook: false })).toBeNull(); // normal focus order
  });
});
