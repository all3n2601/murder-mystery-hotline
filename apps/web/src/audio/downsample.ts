// Mic audio arrives at the device rate (44.1 or 48 kHz on Safari and Firefox); STT wants
// 16 kHz PCM16. Each output sample averages its window of input samples, which doubles as
// a cheap anti-alias filter. Window edges use integer maths so the rate never drifts.

export const OUT_RATE = 16_000;

export function createDownsampler(fromRate: number) {
  let seen = 0; // input samples consumed so far
  let made = 0; // output samples produced so far
  let sum = 0;
  let count = 0;
  const windowEnd = (k: number) => Math.floor(((k + 1) * fromRate) / OUT_RATE);

  return {
    push(input: Float32Array): Int16Array {
      const out: number[] = [];
      for (let i = 0; i < input.length; i++) {
        sum += input[i]!;
        count++;
        seen++;
        if (seen >= windowEnd(made)) {
          const v = Math.max(-1, Math.min(1, sum / count));
          out.push(v * 0x7fff);
          made++;
          sum = 0;
          count = 0;
        }
      }
      return Int16Array.from(out);
    },
  };
}
