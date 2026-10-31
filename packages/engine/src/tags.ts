// Sound cues a character may write as [tag]. The streaming TTS reads bracket tags aloud as
// words (verified 2026-10-18 by transcribing its audio), so each cue is spoken as a spelling it
// performs instead. Only cues with a spelling verified that way belong here; any other bracket is
// dropped before speech. See docs/reference/assemblyai/tts-markup.md.
const SOUNDS = {
  sighs: "Haah…",
  laughs: "Ha! Ha ha.",
  chuckles: "Heh heh.",
} as const;

export type ActedTag = keyof typeof SOUNDS;
export const ACTED_TAGS = Object.keys(SOUNDS) as ActedTag[];

export function isActedTag(tag: string): tag is ActedTag {
  return Object.hasOwn(SOUNDS, tag);
}

/** What the TTS should be given to perform a cue. */
export const soundFor = (tag: ActedTag): string => SOUNDS[tag];
