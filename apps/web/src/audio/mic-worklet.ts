// AudioWorklet: mic audio at the device rate -> 16 kHz PCM16, posted in ~100 ms chunks.
// Bundled by Vite (`?worker&url`) so it can share the tested downsampler.

import { createDownsampler, OUT_RATE } from "./downsample.js";

declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, ctor: unknown): void;

const CHUNK = OUT_RATE / 10;

class MicProcessor extends AudioWorkletProcessor {
  private ds = createDownsampler(sampleRate);
  private pending: Int16Array[] = [];
  private size = 0;

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    const out = this.ds.push(ch);
    this.pending.push(out);
    this.size += out.length;
    if (this.size >= CHUNK) {
      const chunk = new Int16Array(this.size);
      let at = 0;
      for (const p of this.pending) chunk.set(p, (at += p.length) - p.length);
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
      this.pending = [];
      this.size = 0;
    }
    return true;
  }
}

registerProcessor("mic", MicProcessor);
