import { decodeAudioFrame, type ServerMessage } from "@mmh/protocol";
import type { LlmPort, SttPort, TtsPort } from "./ports.js";

// Fakes for the three external services, plus a recorder for what the session sends.

export function fakeLlm(replies: string[][]) {
  const requests: { system: string; messages: { role: string; content: string }[] }[] = [];
  const port: LlmPort = {
    async *stream({ system, messages, signal }) {
      requests.push({ system, messages });
      const chunks = replies.shift() ?? ["..."];
      for (const c of chunks) {
        if (signal.aborted) return;
        await new Promise((r) => setTimeout(r, 1));
        yield c;
      }
    },
  };
  return { port, requests };
}

export function fakeTts(opts: { fail?: boolean; msPerSentence?: number } = {}) {
  const spoken: { voice: string; text: string }[] = [];
  let aborts = 0;
  const port: TtsPort = {
    async speak({ voice, sentences, signal, onAudio }) {
      if (opts.fail) throw new Error("tts down");
      for await (const text of sentences) {
        if (signal.aborted) break;
        spoken.push({ voice, text });
        await new Promise((r) => setTimeout(r, opts.msPerSentence ?? 1));
        if (signal.aborted) break;
        onAudio(new TextEncoder().encode(text)); // "audio" is the sentence bytes, so tests can read it
      }
      if (signal.aborted) aborts++;
    },
  };
  return { port, spoken, aborts: () => aborts };
}

export function fakeStt() {
  let handlers: Parameters<SttPort["open"]>[0] | null = null;
  const audio: Uint8Array[] = [];
  let nextFinal = "";
  let closed = 0;
  const port: SttPort = {
    open(h) {
      handlers = h;
      return {
        sendAudio: (pcm) => audio.push(pcm),
        endTurn: () => handlers?.onFinal(nextFinal),
        close: () => closed++,
      };
    },
  };
  return {
    port,
    audio,
    willHear: (text: string) => (nextFinal = text),
    partial: (text: string) => handlers?.onPartial(text),
    closed: () => closed,
  };
}

export function recorder() {
  const messages: ServerMessage[] = [];
  const frames: { utteranceId: number; text: string }[] = [];
  return {
    messages,
    frames,
    send: (m: ServerMessage) => messages.push(m),
    sendAudio: (frame: Uint8Array) => {
      const f = decodeAudioFrame(frame)!;
      frames.push({ utteranceId: f.utteranceId, text: new TextDecoder().decode(f.pcm) });
    },
    ofType: <T extends ServerMessage["type"]>(type: T) =>
      messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type),
  };
}
