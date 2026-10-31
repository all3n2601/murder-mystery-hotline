import { describe, expect, it } from "vitest";
import { createDownsampler } from "./downsample.js";

describe("createDownsampler", () => {
  it("turns one second of 48 kHz audio into one second of 16 kHz PCM16", () => {
    const ds = createDownsampler(48_000);
    const out = ds.push(new Float32Array(48_000).fill(0.5));
    expect(out.length).toBe(16_000);
    expect(out[0]).toBe(16_383); // 0.5 * 0x7fff, truncated
  });

  it("keeps the rate exact across odd-sized chunks from a 44.1 kHz device", () => {
    const ds = createDownsampler(44_100);
    let total = 0;
    for (let i = 0; i < 441; i++) total += ds.push(new Float32Array(100)).length; // 1 s in 128-ish blocks
    expect(total).toBe(16_000);
  });

  it("clips samples outside -1..1 instead of wrapping", () => {
    const ds = createDownsampler(16_000);
    expect([...ds.push(Float32Array.of(2, -2))]).toEqual([32_767, -32_767]);
  });
});
