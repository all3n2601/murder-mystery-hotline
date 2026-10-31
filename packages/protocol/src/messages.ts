import { z } from "zod";

// Game-socket messages between browser and server. JSON text frames carry these; binary
// frames carry audio (mic PCM16 16 kHz up, TTS PCM16 24 kHz down; see frames.ts).

export const MAX_TEXT = 500;
export const MAX_RAW_BYTES = 16_384;
export const MAX_EVIDENCE = 20;

// Ids are interpolated into prompts and file paths, so keep them boring. Shared with the engine.
export const Id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i);
const Text = z.string().trim().min(1).max(MAX_TEXT);
const UtteranceId = z.number().int().nonnegative().max(0xffff_ffff);

// ---- client -> server ------------------------------------------------------

export const ClientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), sessionId: Id.optional() }),
  z.object({ type: z.literal("start"), caseId: Id }),
  z.object({ type: z.literal("dial"), suspectId: Id }),
  z.object({ type: z.literal("hangup") }),
  z.object({
    type: z.literal("ptt_start"),
    // Set when the player talks over a suspect, so history keeps only what was heard.
    interrupted: z.object({ utteranceId: UtteranceId, playedMs: z.number().nonnegative() }).optional(),
  }),
  z.object({ type: z.literal("ptt_end") }),
  z.object({ type: z.literal("ask"), text: Text }),
  z.object({ type: z.literal("accuse"), suspectId: Id, evidence: z.array(Id).max(MAX_EVIDENCE) }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---- server -> client ------------------------------------------------------

export const PublicSuspect = z.object({
  id: Id,
  name: z.string(),
  role: z.string(),
  line: z.string(), // switchboard jack label
  hook: z.string().optional(), // one public, non-spoiling line introducing them
});
export type PublicSuspect = z.infer<typeof PublicSuspect>;

export const Clue = z.object({
  id: Id,
  title: z.string(),
  text: z.string(),
  source: Id, // character id, or STARTING_EVIDENCE for clues the player begins with
});

export const STARTING_EVIDENCE = "start";
export type Clue = z.infer<typeof Clue>;

/** Where an intro act's camera is. The client maps each to a backdrop and a move. */
export const IntroShot = z.enum(["exterior", "victim", "interior", "suspects", "log", "board"]);
export type IntroShot = z.infer<typeof IntroShot>;

/** The narrated opening, act by act. `pause` is seconds of silence after a line. */
export const Intro = z.object({
  acts: z.array(
    z.object({
      id: Id,
      shot: IntroShot,
      lines: z.array(z.object({ text: z.string().min(1), suspect: Id.optional(), pause: z.number().min(0).max(5).optional() })).min(1),
    }),
  ),
});
export type Intro = z.infer<typeof Intro>;

/** A starting lead pinned in the notebook: points at a person without giving the answer. */
export const Lead = z.object({ suspect: Id, text: z.string().min(1) });
export type Lead = z.infer<typeof Lead>;

export const PublicCaseState = z.object({
  caseId: Id,
  title: z.string(),
  era: z.string(),
  briefing: z.string(),
  questionBudget: z.number().int().nonnegative(),
  suspects: z.array(PublicSuspect),
  startingEvidence: z.array(Clue),
  intro: z.lazy(() => Intro).optional(),
  leads: z.array(z.lazy(() => Lead)).default([]),
});
export type PublicCaseState = z.infer<typeof PublicCaseState>;

export const VerdictOutcome = z.enum(["solved", "rightButWeak", "wrong"]);
export type VerdictOutcome = z.infer<typeof VerdictOutcome>;

export const CallStatus = z.enum(["connected", "ended"]);
export const CallEndReason = z.enum(["player", "suspect", "timeout"]);

/** One spoken word and its timing in ms, from TTS word boundaries. */
export const Word = z.object({ word: z.string(), start: z.number(), end: z.number() });
export type Word = z.infer<typeof Word>;

/** One turn of a suspect's conversation history, as sent to the LLM. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Nerves run from calm (0) to hanging up (NERVES_MAX). */
export const NERVES_MAX = 10;

export const ServerMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("welcome"), sessionId: Id, resumed: z.boolean() }),
  z.object({ type: z.literal("case"), publicState: PublicCaseState }),
  z.object({ type: z.literal("call"), suspectId: Id, status: CallStatus, reason: CallEndReason.optional() }),
  z.object({ type: z.literal("partial"), text: z.string() }),
  z.object({ type: z.literal("heard"), text: z.string() }),
  z.object({ type: z.literal("line"), utteranceId: UtteranceId, speaker: Id, text: z.string() }),
  z.object({ type: z.literal("line_end"), utteranceId: UtteranceId, interrupted: z.boolean() }),
  z.object({ type: z.literal("words"), utteranceId: UtteranceId, words: z.array(Word) }),
  z.object({ type: z.literal("stop_audio"), utteranceId: UtteranceId }),
  // Every TTS line is in use; this utterance is queued. The client plays the busy crackle.
  z.object({ type: z.literal("busy"), utteranceId: UtteranceId }),
  z.object({ type: z.literal("fallback_speech"), utteranceId: UtteranceId, speaker: Id, text: z.string() }),
  z.object({
    type: z.literal("state"),
    questionsLeft: z.number().int().nonnegative(),
    nerves: z.record(z.number().int().min(0).max(NERVES_MAX)),
    activeCall: Id.nullable(),
  }),
  z.object({ type: z.literal("clues"), clues: z.array(Clue) }),
  z.object({ type: z.literal("hint"), text: z.string() }),
  z.object({
    type: z.literal("verdict"),
    outcome: VerdictOutcome,
    stars: z.number().int().min(0).max(3),
    text: z.string(),
    solution: z.object({ culprit: Id, explanation: z.string() }),
  }),
  z.object({ type: z.literal("error"), code: z.string(), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

// ---- parsing ---------------------------------------------------------------

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: string };

function parseWith<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: string): ParseResult<T> {
  if (raw.length > MAX_RAW_BYTES) return { ok: false, error: "too_large" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid_json" };
  }
  const result = schema.safeParse(data);
  if (!result.success) return { ok: false, error: result.error.issues[0]?.message ?? "invalid_message" };
  return { ok: true, message: result.data };
}

export const parseClientMessage = (raw: string) => parseWith(ClientMessage, raw);
export const parseServerMessage = (raw: string) => parseWith(ServerMessage, raw);
