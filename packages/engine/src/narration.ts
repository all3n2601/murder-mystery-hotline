import type { Word } from "@mmh/protocol";

// Lays out a narration rendered one line at a time. The TTS gives every line its own padding
// and the same flat pacing, so each clip is trimmed to just around its words and placed after
// the previous line plus a directed pause. Dramatic timing comes from these pauses: ellipses
// make no audible difference (verified 2026-10-18).

export type RenderedLine = { durationMs: number; words: Word[]; pause?: number };
export type RenderedAct = { id: string; lines: RenderedLine[] };

export type NarrationLayout = {
  /** Which slice of which line's audio goes where in the final track. */
  clips: { act: number; line: number; fromMs: number; toMs: number; atMs: number }[];
  /** Every word, timed against the final track. */
  words: Word[];
  acts: { id: string; startMs: number }[];
  durationMs: number;
};

export function layoutNarration(
  acts: RenderedAct[],
  { leadInMs = 600, trimLeadMs = 80, trimTailMs = 150, defaultPauseMs = 400 } = {},
): NarrationLayout {
  const layout: NarrationLayout = { clips: [], words: [], acts: [], durationMs: 0 };
  let cursor = leadInMs;
  acts.forEach((act, a) => {
    layout.acts.push({ id: act.id, startMs: cursor });
    act.lines.forEach((line, l) => {
      const first = line.words[0];
      const last = line.words.at(-1);
      const fromMs = first ? Math.max(0, first.start - trimLeadMs) : 0;
      const toMs = last ? Math.min(line.durationMs, last.end + trimTailMs) : line.durationMs;
      layout.clips.push({ act: a, line: l, fromMs, toMs, atMs: cursor });
      for (const w of line.words) layout.words.push({ ...w, start: cursor + w.start - fromMs, end: cursor + w.end - fromMs });
      cursor += toMs - fromMs + (line.pause === undefined ? defaultPauseMs : line.pause * 1000);
    });
  });
  layout.durationMs = cursor;
  return layout;
}
