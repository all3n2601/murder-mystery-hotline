// Keyboard controls as a pure mapping, so the "Space types in the text box" rule is testable.

export type KeyInput = { code: string; phase: "down" | "up"; repeat: boolean; mod: boolean };

export type KeyAction =
  | { type: "talk_start" }
  | { type: "talk_end" }
  | { type: "dial"; index: number }
  | { type: "hangup" }
  | { type: "leave_input" }
  | { type: "notebook" }
  | { type: "accuse" }
  | { type: "focus_type" }
  | { type: "help" }
  | { type: "next_tab" };

const DIALS = ["Digit1", "Digit2", "Digit3", "Digit4"];

/**
 * `notebook` is true only when the player opened the notebook with N; Tab keeps its normal
 * focus order otherwise, so keyboard users can still reach every control.
 */
export function keyAction(k: KeyInput, { typing, notebook = false }: { typing: boolean; notebook?: boolean }): KeyAction | null {
  if (k.mod || k.repeat) return null;
  if (k.code === "Escape") return k.phase === "down" ? (typing ? { type: "leave_input" } : { type: "hangup" }) : null;
  if (typing) return null;
  if (k.code === "Space") return { type: k.phase === "down" ? "talk_start" : "talk_end" };
  if (k.phase === "up") return null;
  const dial = DIALS.indexOf(k.code);
  if (dial >= 0) return { type: "dial", index: dial };
  if (k.code === "KeyN") return { type: "notebook" };
  if (k.code === "KeyA") return { type: "accuse" };
  if (k.code === "KeyT") return { type: "focus_type" };
  if (k.code === "Slash") return { type: "help" };
  if (k.code === "Tab" && notebook) return { type: "next_tab" };
  return null;
}
