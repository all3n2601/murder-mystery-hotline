// Pre-renders Mrs. Hale's intro, one line at a time over a single TTS connection, then splices
// the lines with the pauses written in case.json (intro.acts[].lines[].pause). The TTS's own
// pacing is flat and ellipses add no pause, so this is where the performance's timing comes from.
// Writes cases/<id>/intro/narration.wav and narration.json (word, line and act timings).
//
//   pnpm tsx --env-file=.env tools/render-narration.ts [caseId]

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { layoutNarration, loadCase, type RenderedAct } from "../packages/engine/src/index.js";
import { createAssemblyTts } from "../apps/server/src/adapters/tts.js";
import { wav } from "./wav.js";

const RATE = 24_000;
const FADE = Math.round(RATE * 0.008); // 8 ms fades so splices never click

const caseId = process.argv[2] ?? "night-operator";
const dir = join(import.meta.dirname, "..", "cases", caseId);
const loaded = loadCase(JSON.parse(readFileSync(join(dir, "case.json"), "utf8")));
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const { intro, narrator } = loaded.pack;
if (!intro) throw new Error(`${caseId} has no intro`);
const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY is not set");

const line = createAssemblyTts({ apiKey, maxConcurrent: 1 }).openLine(narrator.voice);
const audio: Int16Array[][] = [];
const rendered: RenderedAct[] = [];
for (const act of intro.acts) {
  const pcms: Int16Array[] = [];
  const lines: RenderedAct["lines"] = [];
  for (const l of act.lines) {
    const chunks: Buffer[] = [];
    const words: { word: string; start: number; end: number }[] = [];
    async function* text() {
      yield l.text;
    }
    await line.speak({
      sentences: text(),
      signal: new AbortController().signal,
      onAudio: (pcm) => chunks.push(Buffer.from(pcm)),
      onWords: (batch) => words.push(...batch.map(({ word, start, end }) => ({ word, start, end }))),
    });
    const buf = Buffer.concat(chunks);
    const pcm = new Int16Array(buf.buffer, buf.byteOffset, buf.length >> 1);
    pcms.push(pcm);
    lines.push({ durationMs: (pcm.length / RATE) * 1000, words, ...(l.pause === undefined ? {} : { pause: l.pause }) });
    console.log(`  ${act.id}: ${l.text.slice(0, 60)}`);
  }
  audio.push(pcms);
  rendered.push({ id: act.id, lines });
}
line.close();

const layout = layoutNarration(rendered);
const out = new Int16Array(Math.ceil((layout.durationMs / 1000) * RATE));
for (const c of layout.clips) {
  const src = audio[c.act]![c.line]!;
  const from = Math.round((c.fromMs / 1000) * RATE);
  const to = Math.min(src.length, Math.round((c.toMs / 1000) * RATE));
  const at = Math.round((c.atMs / 1000) * RATE);
  for (let i = from; i < to && at + i - from < out.length; i++) {
    const k = Math.min(1, (i - from) / FADE, (to - i) / FADE);
    out[at + i - from] = Math.round(src[i]! * k);
  }
}

const lines = layout.clips.map((c) => {
  const def = intro.acts[c.act]!.lines[c.line]!;
  return { act: intro.acts[c.act]!.id, text: def.text, ...(def.suspect ? { suspect: def.suspect } : {}), startMs: c.atMs, endMs: c.atMs + (c.toMs - c.fromMs) };
});
mkdirSync(join(dir, "intro"), { recursive: true });
writeFileSync(join(dir, "intro", "narration.wav"), wav(Buffer.from(out.buffer), RATE));
writeFileSync(
  join(dir, "intro", "narration.json"),
  JSON.stringify({ voice: narrator.voice, durationMs: layout.durationMs, acts: layout.acts, lines, words: layout.words }, null, 1),
);
console.log(`Wrote ${(layout.durationMs / 1000).toFixed(1)} s, ${layout.words.length} words, ${lines.length} lines to cases/${caseId}/intro/`);
process.exit(0);
