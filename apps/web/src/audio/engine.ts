// The Web Audio graph: suspect playback through a phone line, the mic worklet, SFX, and
// narration. Created on the "Pick up the receiver" click, never before (autoplay rules).

import { decodeAudioFrame, TTS_SAMPLE_RATE } from "@mmh/protocol";
import micWorkletUrl from "./mic-worklet.ts?worker&url";
import { createSfx, type Sfx } from "./sfx.js";
import { createUnderscore } from "./underscore.js";
import { createUtteranceTracker, type Interruption } from "./utterances.js";

export type AudioEngine = Awaited<ReturnType<typeof createAudioEngine>>;

export async function createAudioEngine(opts: { onMic: (pcm: Int16Array) => void; onMicState: (ok: boolean) => void }) {
  const ctx = new AudioContext();
  await ctx.resume();

  const master = new GainNode(ctx, { gain: 1 });
  master.connect(ctx.destination);

  // A softened phone line: band-limited, a touch of mid presence, gentle saturation.
  const lineIn = new BiquadFilterNode(ctx, { type: "highpass", frequency: 260, Q: 0.7 });
  const lineLp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 3800, Q: 0.7 });
  const presence = new BiquadFilterNode(ctx, { type: "peaking", frequency: 1800, Q: 1, gain: 3 });
  const drive = new WaveShaperNode(ctx, { curve: softClip(1.6), oversample: "2x" });
  lineIn.connect(lineLp).connect(presence).connect(drive).connect(master);

  const sfxBus = new GainNode(ctx, { gain: 0.8 });
  sfxBus.connect(master);
  // Rain and room tone: their own bus, so they can duck under Mrs. Hale.
  const ambience = new GainNode(ctx, { gain: 1 });
  ambience.connect(master);
  const sfx: Sfx = createSfx(ctx, sfxBus, ambience);
  const underscoreBus = new GainNode(ctx, { gain: 1 });
  underscoreBus.connect(master);

  // Narration: warm and close, in a small room. Not through the phone line.
  const narrationIn = new BiquadFilterNode(ctx, { type: "highpass", frequency: 100 });
  const warmth = new BiquadFilterNode(ctx, { type: "lowshelf", frequency: 220, gain: 2.5 });
  const air = new BiquadFilterNode(ctx, { type: "peaking", frequency: 3200, Q: 0.8, gain: 2 });
  const room = new ConvolverNode(ctx, { buffer: roomImpulse(ctx, 0.7) });
  const roomLevel = new GainNode(ctx, { gain: 0.16 });
  narrationIn.connect(warmth).connect(air);
  air.connect(master);
  air.connect(room).connect(roomLevel).connect(master);

  function duckAmbience(down: boolean) {
    ambience.gain.cancelScheduledValues(ctx.currentTime);
    ambience.gain.setValueAtTime(ambience.gain.value, ctx.currentTime);
    ambience.gain.linearRampToValueAtTime(down ? 0.4 : 1, ctx.currentTime + (down ? 0.6 : 1.5));
  }

  // ---- playback ---------------------------------------------------------------
  const tracker = createUtteranceTracker({ leadIn: 0.06 });
  const sources = new Map<number, AudioBufferSourceNode[]>();

  function playFrame(frame: Uint8Array) {
    const decoded = decodeAudioFrame(frame);
    if (!decoded) return;
    const { utteranceId, pcm } = decoded;
    const samples = pcm.length >> 1;
    if (samples === 0) return;
    const at = tracker.frame(utteranceId, samples / TTS_SAMPLE_RATE, ctx.currentTime);
    if (at === null) return;
    const buffer = ctx.createBuffer(1, samples, TTS_SAMPLE_RATE);
    const ch = buffer.getChannelData(0);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let i = 0; i < samples; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
    const src = new AudioBufferSourceNode(ctx, { buffer });
    src.connect(lineIn);
    src.start(at);
    const list = sources.get(utteranceId) ?? [];
    list.push(src);
    sources.set(utteranceId, list);
    src.onended = () => {
      const l = sources.get(utteranceId);
      if (!l) return;
      l.splice(l.indexOf(src), 1);
      if (!l.length) sources.delete(utteranceId);
    };
  }

  function silence(id: number) {
    for (const s of sources.get(id) ?? []) {
      try {
        s.stop();
      } catch {}
    }
    sources.delete(id);
  }

  // ---- mic ----------------------------------------------------------------------
  const micMeter = new AnalyserNode(ctx, { fftSize: 512 });
  const meterData = new Float32Array(micMeter.fftSize);
  // Never block the game on the permission prompt: typing works while it's pending or refused.
  void (async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      await ctx.audioWorklet.addModule(micWorkletUrl);
      const node = new AudioWorkletNode(ctx, "mic");
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => opts.onMic(new Int16Array(e.data));
      const source = ctx.createMediaStreamSource(stream);
      source.connect(node);
      source.connect(micMeter);
      opts.onMicState(true);
    } catch (err) {
      console.warn("Mic unavailable:", err);
      opts.onMicState(false);
    }
  })();

  // ---- narration (pre-rendered, not through the phone line) -----------------------
  async function loadNarration(url: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  /** Plays narration from `offset` seconds; ambience ducks until it's stopped. */
  function playNarration(buffer: AudioBuffer, offset = 0) {
    const src = new AudioBufferSourceNode(ctx, { buffer });
    src.connect(narrationIn);
    const startedAt = ctx.currentTime - offset;
    src.start(0, Math.min(offset, buffer.duration));
    duckAmbience(true);
    let stopped = false;
    return {
      time: () => ctx.currentTime - startedAt,
      stop: () => {
        if (stopped) return;
        stopped = true;
        duckAmbience(false);
        try {
          src.stop();
        } catch {}
      },
    };
  }

  return {
    ctx,
    sfx,
    playFrame,
    /** The server cut a reply off. */
    stop(utteranceId: number) {
      tracker.stop(utteranceId);
      silence(utteranceId);
    },
    /** The player started talking over whoever is audible. */
    interrupt(): Interruption | null {
      const cut = tracker.interrupt(ctx.currentTime);
      if (cut) silence(cut.utteranceId);
      return cut;
    },
    audible: () => tracker.audible(ctx.currentTime),
    /** How far into a reply playback is, in ms (for word-synced subtitles). */
    playedMs: (utteranceId: number) => tracker.elapsedMs(utteranceId, ctx.currentTime),
    /** Mic input level, 0..1, for the talk button's ring. */
    micLevel(): number {
      micMeter.getFloatTimeDomainData(meterData);
      let sum = 0;
      for (const v of meterData) sum += v * v;
      return Math.min(1, Math.sqrt(sum / meterData.length) * 6);
    },
    underscore: () => createUnderscore(ctx, underscoreBus),
    loadNarration,
    playNarration,
    now: () => ctx.currentTime,
  };
}

/** A small, soft room: decaying noise, a little darker as it fades. */
function roomImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.round(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      lp += (Math.random() * 2 - 1 - lp) * (0.6 - t * 0.45);
      d[i] = lp * Math.pow(1 - t, 3.2);
    }
  }
  return ir;
}

function softClip(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  return curve;
}
