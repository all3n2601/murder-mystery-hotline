// The intro's clock. Mrs. Hale's narration is rendered line by line and spliced with directed
// pauses (tools/render-narration.ts); its timings decide when each act's shot starts and which
// line is on screen. Without the rendered audio, timings are estimated from the case's own
// intro so the storyboard still plays with captions.

import { layoutNarration } from "@mmh/engine";
import type { Intro, IntroShot, Word } from "@mmh/protocol";

export type IntroLine = { act: string; text: string; suspect?: string; startMs: number; endMs: number };
export type Timeline = {
  acts: { id: string; shot: IntroShot; startMs: number }[];
  lines: IntroLine[];
  words: Word[];
  durationMs: number;
};

/** narration.json as written by tools/render-narration.ts. */
export type RenderedNarration = { durationMs: number; acts: { id: string; startMs: number }[]; lines: IntroLine[]; words: Word[] };

export function fromNarration(intro: Intro, n: RenderedNarration): Timeline {
  const shotOf = new Map(intro.acts.map((a) => [a.id, a.shot]));
  return { acts: n.acts.map((a) => ({ ...a, shot: shotOf.get(a.id) ?? "exterior" })), lines: n.lines, words: n.words, durationMs: n.durationMs + 1500 };
}

/** Steady speaking pace, for when there's no rendered narration. */
function estimateWords(text: string): { words: Word[]; durationMs: number } {
  const words: Word[] = [];
  let t = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const len = 140 + word.length * 45;
    words.push({ word, start: t, end: t + len });
    t += len + (/[.!?…]$/.test(word) ? 380 : /[,;:]$/.test(word) ? 180 : 50);
  }
  return { words, durationMs: t };
}

export function estimateTimeline(intro: Intro): Timeline {
  const rendered = intro.acts.map((a) => ({
    id: a.id,
    lines: a.lines.map((l) => ({ ...estimateWords(l.text), ...(l.pause === undefined ? {} : { pause: l.pause }) })),
  }));
  const layout = layoutNarration(rendered, { trimLeadMs: 0, trimTailMs: 0 });
  const lines = layout.clips.map((c) => {
    const def = intro.acts[c.act]!.lines[c.line]!;
    return { act: intro.acts[c.act]!.id, text: def.text, ...(def.suspect ? { suspect: def.suspect } : {}), startMs: c.atMs, endMs: c.atMs + c.toMs - c.fromMs };
  });
  return {
    acts: layout.acts.map((a, i) => ({ ...a, shot: intro.acts[i]!.shot })),
    lines,
    words: layout.words,
    durationMs: layout.durationMs + 1500,
  };
}

export function actAt(tl: Timeline, ms: number) {
  let index = 0;
  for (let i = 0; i < tl.acts.length; i++) if (tl.acts[i]!.startMs <= ms) index = i;
  const act = tl.acts[index]!;
  const end = tl.acts[index + 1]?.startMs ?? tl.durationMs;
  return { index, act, sinceMs: ms - act.startMs, lengthMs: Math.max(1, end - act.startMs) };
}

/** The line on screen: the one being spoken, or the last one spoken in this act. */
export function lineAt(tl: Timeline, ms: number): IntroLine | null {
  const act = actAt(tl, ms).act.id;
  let found: IntroLine | null = null;
  for (const l of tl.lines) if (l.act === act && l.startMs <= ms + 150) found = l;
  return found;
}

/** Splits Dot's call log into entries ("1:15 Call box 12 ..."). */
export function logEntries(text: string): string[] {
  if (text.includes("\n")) return text.split("\n").map((s) => s.trim()).filter(Boolean);
  return text
    .split(/(?<!(?:to|after) )(?=\b\d{1,2}:\d{2}\b)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Shared, mutable intro clock: the overlay advances it, the Pixi scene reads it each frame. */
export const introClock = { ms: 0, timeline: null as Timeline | null };
