import { NERVES_MAX } from "@mmh/protocol";

// The nerves scale in one place: tune the game's difficulty here.

export const NERVES = {
  MIN: 0,
  /** Reaching this, the suspect hangs up. */
  HANG_UP: NERVES_MAX,
  /** From here the suspect knows their shaken truth, and their answers get sloppy. */
  SHAKEN: 5,
  /** From here they come apart audibly: false starts, repeated words, trailing off. */
  RATTLED: 7,
  /** A redial after a hang-up starts them here: still rattled, not yet at breaking point. */
  REDIAL: 5,
  /** The highest a clue or confession can demand; anything above is a hang-up. */
  HIGHEST_GATE: NERVES_MAX - 1,
  /** How far one question can move nerves, as proposed by the model. */
  STEP_DOWN: -2,
  STEP_UP: 3,
} as const;

/** Applies the model's proposed change, limited to one question's worth, within the scale. */
export function applyPressure(current: number, proposed: number): number {
  const step = Math.max(NERVES.STEP_DOWN, Math.min(NERVES.STEP_UP, Math.round(proposed)));
  return Math.max(NERVES.MIN, Math.min(NERVES.HANG_UP, current + step));
}

export function mood(nerves: number): string {
  if (nerves <= 2) return "calm and guarded";
  if (nerves <= 4) return "wary and a little short-tempered";
  if (nerves < NERVES.RATTLED) return "nervous; your answers are getting sloppy";
  if (nerves < NERVES.HIGHEST_GATE) return "badly rattled; you are close to slipping up";
  return "at breaking point";
}

/** How a nervous person sounds at this level, so the voice carries the pressure, not just the words. */
export function delivery(nerves: number): string {
  if (nerves < NERVES.SHAKEN) return "You are in control: unhurried, every sentence finished, the odd filler word at most.";
  if (nerves < NERVES.RATTLED)
    return "Your composure is slipping: more filler words, a sentence that stops and starts over, a defensive edge.";
  return 'You are rattled: false starts ("I— I was"), repeated words, trailing off with "...", snapping one moment and pleading the next.';
}
