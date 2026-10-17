import { describe, expect, it } from "vitest";
import { decodeAudioFrame, encodeAudioFrame } from "./frames.js";

describe("server audio frames", () => {
  it("round-trips the utterance id and PCM bytes", () => {
    const pcm = new Uint8Array([1, 2, 3, 4, 250, 251]);
    const frame = encodeAudioFrame(4_000_000_001, pcm);
    const decoded = decodeAudioFrame(frame);
    expect(decoded?.utteranceId).toBe(4_000_000_001);
    expect([...decoded!.pcm]).toEqual([1, 2, 3, 4, 250, 251]);
  });

  it("rejects a frame too short to carry a header", () => {
    expect(decodeAudioFrame(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
