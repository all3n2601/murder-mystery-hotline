// Voices the streaming TTS endpoint accepted on 2026-10-17; TTS-1 takes each as voice_id=aai-<name>
// (docs/reference/assemblyai/tts-protocol.md).
export const TTS_VOICES = [
  "alba", "anna", "charles", "eve", "george", "iris", "jane",
  "jean", "mary", "michael", "paul", "reid", "vera",
] as const;

const KNOWN: ReadonlySet<string> = new Set(TTS_VOICES);

export function isKnownVoice(voice: string): boolean {
  return KNOWN.has(voice);
}
