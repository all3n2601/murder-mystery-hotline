// A minimal synthesised underscore for the intro: a low minor pad that can swell, and a soft
// double-bass pulse for act cuts. Kept far under the voice; no melody to sound fake.

export type Underscore = ReturnType<typeof createUnderscore>;

export function createUnderscore(ctx: AudioContext, out: AudioNode) {
  const pad = new GainNode(ctx, { gain: 0 });
  const tone = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 520, Q: 0.6 });
  tone.connect(pad).connect(out);
  // D minor, low and wide: D2, A2, F3, with slow detune for movement.
  const voices = [73.42, 110, 174.61].flatMap((f) =>
    [-6, 6].map((cents) => {
      const o = new OscillatorNode(ctx, { type: "sawtooth", frequency: f, detune: cents });
      o.connect(tone);
      o.start();
      return o;
    }),
  );
  const lfo = new OscillatorNode(ctx, { frequency: 0.07 });
  const lfoDepth = new GainNode(ctx, { gain: 140 });
  lfo.connect(lfoDepth).connect(tone.frequency);
  lfo.start();

  const level = (to: number, seconds: number) => {
    pad.gain.cancelScheduledValues(ctx.currentTime);
    pad.gain.setValueAtTime(pad.gain.value, ctx.currentTime);
    pad.gain.linearRampToValueAtTime(to, ctx.currentTime + seconds);
  };
  level(0.018, 3);

  return {
    /** Swell up (suspect line-up) or settle back. */
    swell(up: boolean) {
      level(up ? 0.032 : 0.018, up ? 2.5 : 3);
    },
    /** A soft double-bass note on an act cut. */
    pulse() {
      const t = ctx.currentTime;
      const o = new OscillatorNode(ctx, { type: "sine", frequency: 58 });
      const g = new GainNode(ctx, { gain: 0 });
      o.frequency.setValueAtTime(62, t);
      o.frequency.exponentialRampToValueAtTime(49, t + 0.5);
      g.gain.linearRampToValueAtTime(0.22, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.2);
    },
    /** Drop out (for the last line) or stop for good. */
    stop(seconds = 2) {
      level(0, seconds);
      const end = ctx.currentTime + seconds + 0.1;
      for (const v of voices) v.stop(end);
      lfo.stop(end);
    },
  };
}
