// Every sound effect is synthesised: no files, no licences. Each returns a stop function
// when it loops.

export type Sfx = ReturnType<typeof createSfx>;

export function createSfx(ctx: AudioContext, out: AudioNode, ambience: AudioNode = out) {
  const noiseBuffer = (() => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();

  function noise(loop = false) {
    const src = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer, loop });
    return src;
  }

  function env(gain: GainNode, at: number, attack: number, hold: number, release: number, peak: number) {
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, at + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
  }

  /** A short filtered noise burst: clicks, thunks, stamps. */
  type Burst = { freq: number; q?: number; peak?: number; release?: number; type?: BiquadFilterType };
  function burst(at: number, { freq, q = 1, peak = 0.5, release = 0.08, type = "bandpass" }: Burst) {
    const src = noise();
    const f = new BiquadFilterNode(ctx, { type, frequency: freq, Q: q });
    const g = new GainNode(ctx, { gain: 0 });
    src.connect(f).connect(g).connect(out);
    env(g, at, 0.002, 0.005, release, peak);
    src.start(at);
    src.stop(at + release + 0.05);
  }

  function tone(freqs: number[], at: number, dur: number, peak: number) {
    const g = new GainNode(ctx, { gain: 0 });
    g.connect(out);
    env(g, at, 0.02, dur, 0.05, peak);
    for (const frequency of freqs) {
      const o = new OscillatorNode(ctx, { frequency });
      o.connect(g);
      o.start(at);
      o.stop(at + dur + 0.1);
    }
  }

  function loopUntilStopped(start: (at: number) => number): () => void {
    let stopped = false;
    let next = ctx.currentTime + 0.05;
    const tick = () => {
      if (stopped) return;
      while (next < ctx.currentTime + 0.5) next += start(next);
      timer = setTimeout(tick, 200);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }

  return {
    /** Rotary pulses for one digit (1 = one click ... 0 = ten). */
    dial(digit: number) {
      const n = digit === 0 ? 10 : digit;
      const t = ctx.currentTime + 0.05;
      for (let i = 0; i < n; i++) burst(t + i * 0.1, { freq: 1800, q: 3, peak: 0.35, release: 0.03 });
      return n * 0.1 + 0.1;
    },
    receiverUp() {
      const t = ctx.currentTime;
      burst(t, { freq: 180, type: "lowpass", peak: 0.9, release: 0.12 });
      burst(t + 0.03, { freq: 2400, q: 4, peak: 0.25, release: 0.04 });
    },
    receiverDown() {
      const t = ctx.currentTime;
      burst(t, { freq: 140, type: "lowpass", peak: 1, release: 0.18 });
      burst(t + 0.01, { freq: 3200, q: 6, peak: 0.3, release: 0.05 });
    },
    /** Cord yanked out of the jack: a scrape and a pop. */
    yank() {
      const t = ctx.currentTime;
      burst(t, { freq: 900, q: 0.7, peak: 0.4, release: 0.2 });
      burst(t + 0.18, { freq: 250, type: "lowpass", peak: 0.8, release: 0.1 });
    },
    dialTone(seconds = 1.5) {
      tone([350, 440], ctx.currentTime + 0.25, seconds, 0.07);
    },
    stamp() {
      burst(ctx.currentTime, { freq: 120, type: "lowpass", peak: 0.9, release: 0.15 });
    },
    typeKey() {
      burst(ctx.currentTime, { freq: 2600 + Math.random() * 800, q: 5, peak: 0.25, release: 0.025 });
    },
    /** A soft line crackle while a suspect is thinking. */
    thinking(): () => void {
      return loopUntilStopped((at) => {
        for (let i = 0; i < 3; i++) if (Math.random() < 0.5) burst(at + Math.random() * 0.3, { freq: 2200 + Math.random() * 2000, q: 6, peak: 0.05, release: 0.02 });
        return 0.3;
      });
    },
    /** Crackle while every line is busy. */
    busy(): () => void {
      return loopUntilStopped((at) => {
        for (let i = 0; i < 6; i++) if (Math.random() < 0.6) burst(at + Math.random() * 0.25, { freq: 3000 + Math.random() * 3000, q: 8, peak: 0.12, release: 0.015 });
        return 0.25;
      });
    },
    /** Rain on glass: filtered noise with slow swells. */
    rain(level = 0.06): () => void {
      const src = noise(true);
      const f = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 1400, Q: 0.4 });
      const g = new GainNode(ctx, { gain: 0 });
      const lfo = new OscillatorNode(ctx, { frequency: 0.13 });
      const lfoGain = new GainNode(ctx, { gain: level * 0.3 });
      lfo.connect(lfoGain).connect(g.gain);
      src.connect(f).connect(g).connect(ambience);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(level, ctx.currentTime + 1.5);
      src.start();
      lfo.start();
      return () => {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
        src.stop(ctx.currentTime + 0.9);
        lfo.stop(ctx.currentTime + 0.9);
      };
    },
    /** Quiet exchange-room tone: mains hum and a little hiss. */
    roomTone(): () => void {
      const hum = new OscillatorNode(ctx, { frequency: 60, type: "sine" });
      const hum2 = new OscillatorNode(ctx, { frequency: 120, type: "sine" });
      const hiss = noise(true);
      const hf = new BiquadFilterNode(ctx, { type: "highpass", frequency: 5000 });
      const g = new GainNode(ctx, { gain: 0 });
      const hissG = new GainNode(ctx, { gain: 0.15 });
      hum.connect(g);
      hum2.connect(g);
      hiss.connect(hf).connect(hissG).connect(g);
      g.connect(ambience);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 2);
      hum.start();
      hum2.start();
      hiss.start();
      return () => {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        for (const n of [hum, hum2, hiss]) n.stop(ctx.currentTime + 0.6);
      };
    },
  };
}
