import type { Word } from "@mmh/protocol";

/** How many of a reply's words have started sounding, `ms` into its playback. */
export function wordsSaid(words: Word[], ms: number): number {
  let n = 0;
  while (n < words.length && words[n]!.start <= ms) n++;
  return n;
}
