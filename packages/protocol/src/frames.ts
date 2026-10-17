// Server -> client audio frame: [u32 little-endian utteranceId][PCM16 mono bytes].
// The id lets the browser drop audio from a reply the player has interrupted.

export const AUDIO_HEADER_BYTES = 4;
export const TTS_SAMPLE_RATE = 24_000;
export const MIC_SAMPLE_RATE = 16_000;

export function encodeAudioFrame(utteranceId: number, pcm: Uint8Array): Uint8Array {
  const frame = new Uint8Array(AUDIO_HEADER_BYTES + pcm.length);
  new DataView(frame.buffer).setUint32(0, utteranceId, true);
  frame.set(pcm, AUDIO_HEADER_BYTES);
  return frame;
}

export function decodeAudioFrame(frame: Uint8Array): { utteranceId: number; pcm: Uint8Array } | null {
  if (frame.length < AUDIO_HEADER_BYTES) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  return { utteranceId: view.getUint32(0, true), pcm: frame.subarray(AUDIO_HEADER_BYTES) };
}
