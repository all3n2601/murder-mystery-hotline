// Game state as a pure function of the server's messages. The Zustand store wraps this;
// screens and Pixi scenes only read from it.

import type { PublicCaseState, ServerMessage, Word } from "@mmh/protocol";

type Msg<T extends ServerMessage["type"]> = Extract<ServerMessage, { type: T }>;
export type Clue = Msg<"clues">["clues"][number];
export type Verdict = Omit<Msg<"verdict">, "type">;
export type Call = Omit<Msg<"call">, "type">;

export type Caption = { key: string; speaker: string; text: string; interrupted: boolean; call?: string };

export type GameState = {
  resumed: boolean;
  /** True from a resumed welcome until the notebook has been restored. */
  restoring: boolean;
  case: PublicCaseState | null;
  call: Call | null;
  /** Suspects rung at least once, in order. */
  called: string[];
  /** Suspects who slammed the phone down and haven't been rung back since. */
  hungUpOn: string[];
  questionsLeft: number;
  nerves: Record<string, number>;
  transcript: Caption[];
  partial: string;
  heardCount: number;
  clues: Clue[];
  freshClues: string[];
  hints: string[];
  busyUtterance: number | null;
  busy: boolean;
  /** A question is in and the suspect hasn't started answering: the "thinking" beat. */
  awaitingReply: boolean;
  /** Word timings per reply (ms from the reply's first audio), for synced captions. */
  words: Record<number, Word[]>;
  verdict: Verdict | null;
  error: { code: string; message: string } | null;
};

export const MAX_TRANSCRIPT = 80;
const MAX_WORD_SETS = 30;
export const YOU = "you";

export const initialState: GameState = {
  resumed: false,
  restoring: false,
  case: null,
  call: null,
  called: [],
  hungUpOn: [],
  questionsLeft: 0,
  nerves: {},
  transcript: [],
  partial: "",
  heardCount: 0,
  clues: [],
  freshClues: [],
  hints: [],
  busyUtterance: null,
  busy: false,
  awaitingReply: false,
  words: {},
  verdict: null,
  error: null,
};

function upsertCaption(transcript: Caption[], caption: Caption): Caption[] {
  const i = transcript.findIndex((c) => c.key === caption.key);
  if (i >= 0) caption = { ...caption, call: transcript[i]!.call };
  const next = i >= 0 ? transcript.with(i, caption) : [...transcript, caption];
  return next.slice(-MAX_TRANSCRIPT);
}

const onCall = (s: GameState) => (s.call?.status === "connected" ? { call: s.call.suspectId } : {});

function notBusyFor(s: GameState, utteranceId: number): Partial<GameState> {
  return s.busyUtterance === utteranceId ? { busy: false, busyUtterance: null } : {};
}

export function reduce(s: GameState, m: ServerMessage): GameState {
  switch (m.type) {
    case "welcome":
      return { ...s, resumed: m.resumed, restoring: m.resumed };
    case "case": {
      const known = new Set(s.clues.map((c) => c.id));
      return {
        ...s,
        case: m.publicState,
        questionsLeft: s.case ? s.questionsLeft : m.publicState.questionBudget,
        clues: [...s.clues, ...m.publicState.startingEvidence.filter((c) => !known.has(c.id))],
      };
    }
    case "clues": {
      const known = new Set(s.clues.map((c) => c.id));
      const added = m.clues.filter((c) => !known.has(c.id));
      return {
        ...s,
        clues: [...s.clues, ...added],
        freshClues: s.restoring ? s.freshClues : [...s.freshClues, ...added.map((c) => c.id)],
        restoring: false,
      };
    }
    case "call": {
      const call = m.reason ? { suspectId: m.suspectId, status: m.status, reason: m.reason } : { suspectId: m.suspectId, status: m.status };
      if (m.status === "connected") {
        return {
          ...s,
          call,
          called: s.called.includes(m.suspectId) ? s.called : [...s.called, m.suspectId],
          hungUpOn: s.hungUpOn.filter((id) => id !== m.suspectId),
        };
      }
      const hungUp = m.reason === "suspect" && !s.hungUpOn.includes(m.suspectId);
      return { ...s, call, awaitingReply: false, hungUpOn: hungUp ? [...s.hungUpOn, m.suspectId] : s.hungUpOn };
    }
    case "partial":
      return { ...s, partial: m.text };
    case "heard":
      return {
        ...s,
        partial: "",
        awaitingReply: true,
        heardCount: s.heardCount + 1,
        transcript: upsertCaption(s.transcript, { key: `y${s.heardCount}`, speaker: YOU, text: m.text, interrupted: false, ...onCall(s) }),
      };
    case "line":
    case "fallback_speech":
      return {
        ...s,
        awaitingReply: s.awaitingReply && m.speaker !== s.call?.suspectId,
        transcript: upsertCaption(s.transcript, { key: `u${m.utteranceId}`, speaker: m.speaker, text: m.text, interrupted: false, ...onCall(s) }),
      };
    case "line_end": {
      const key = `u${m.utteranceId}`;
      const transcript = m.interrupted ? s.transcript.map((c) => (c.key === key ? { ...c, interrupted: true } : c)) : s.transcript;
      return { ...s, transcript, ...notBusyFor(s, m.utteranceId) };
    }
    case "words": {
      const words = { ...s.words, [m.utteranceId]: [...(s.words[m.utteranceId] ?? []), ...m.words] };
      const ids = Object.keys(words).map(Number);
      for (const id of ids.slice(0, Math.max(0, ids.length - MAX_WORD_SETS))) delete words[id];
      return { ...s, words, ...notBusyFor(s, m.utteranceId) };
    }
    case "busy":
      return { ...s, busy: true, busyUtterance: m.utteranceId };
    case "state":
      return { ...s, questionsLeft: m.questionsLeft, nerves: m.nerves };
    case "hint":
      return { ...s, hints: [...s.hints, m.text] };
    case "verdict": {
      const { type: _, ...verdict } = m;
      return { ...s, verdict };
    }
    case "error":
      return { ...s, awaitingReply: false, error: { code: m.code, message: m.message } };
    case "stop_audio":
      return s;
  }
}
