// What the big receiver control shows, derived from game state. One place decides, so the
// button, its label and the thinking effects can never disagree.

import type { Call } from "../state/reduce.js";
import type { MicState } from "../state/store.js";

export type ReceiverInput = {
  call: Call | null;
  dialing: string | null;
  talking: boolean;
  awaitingReply: boolean;
  /** Whoever is audible right now (a suspect or the narrator). */
  speaking: string | null;
  mic: MicState;
  questionsLeft: number;
};

export type ReceiverState =
  | { kind: "idle" }
  | { kind: "ringing"; who: string }
  | { kind: "ready" | "listening" | "thinking" | "speaking" | "type-only" | "out"; who: string };

export function receiverState(s: ReceiverInput): ReceiverState {
  const who = s.call?.status === "connected" ? s.call.suspectId : null;
  if (!who) return s.dialing ? { kind: "ringing", who: s.dialing } : { kind: "idle" };
  if (s.talking) return { kind: "listening", who };
  if (s.speaking === who) return { kind: "speaking", who };
  if (s.awaitingReply) return { kind: "thinking", who };
  if (s.mic !== "ok") return { kind: "type-only", who };
  if (s.questionsLeft === 0) return { kind: "out", who };
  return { kind: "ready", who };
}
