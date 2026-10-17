// Bracket tags the streaming TTS performs instead of reading aloud. Verified 2026-10-17 by ear
// and by zero-length WordBoundaries (docs/reference/assemblyai/tts-protocol.md). Add a tag here
// only after verifying it; anything else in brackets is dropped before speech.
export const ACTED_TAGS = ["sighs", "laughs", "chuckles", "gasps", "clears throat", "coughs", "scoffs"] as const;
export type ActedTag = (typeof ACTED_TAGS)[number];

const ACTED: ReadonlySet<string> = new Set(ACTED_TAGS);

export function isActedTag(tag: string): tag is ActedTag {
  return ACTED.has(tag);
}
