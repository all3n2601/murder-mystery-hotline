import { createGame, createReplySplitter, type CasePack, type Game } from "@mmh/engine";
import { encodeAudioFrame, type ClientMessage, type ServerMessage } from "@mmh/protocol";
import { createChannel } from "./channel.js";
import type { LlmPort, SttPort, SttSession, TtsPort } from "./ports.js";

// One player's connection: turns client messages into game moves, and game moves into
// speech. Owns the per-call STT session and the reply currently being spoken.

export type SessionDeps = {
  cases: ReadonlyMap<string, CasePack>;
  llm: LlmPort;
  tts: TtsPort;
  stt: SttPort;
  send(message: ServerMessage): void;
  sendAudio(frame: Uint8Array): void;
  /** Failures the player only hears as "bad line"; the operator needs the real reason. */
  onError?(where: "llm" | "tts" | "stt", err: unknown): void;
};

type Reply = { utteranceId: number; done: Promise<void>; interrupt(playedMs?: number): void };

// TTS voices speak roughly 15 characters a second; good enough to guess where the player cut in.
const CHARS_PER_SECOND = 15;
const BAD_LINE = "Sorry, detective, this line's terrible. Say again?";

function heardPortion(text: string, playedMs: number | undefined): string {
  if (playedMs === undefined) return text;
  const cut = Math.round((playedMs / 1000) * CHARS_PER_SECOND);
  if (cut >= text.length) return text;
  const lastSpace = text.lastIndexOf(" ", cut);
  return text.slice(0, lastSpace > 0 ? lastSpace : cut);
}

export function createSession(deps: SessionDeps) {
  let game: Game | null = null;
  let pack: CasePack | null = null;
  let call: { suspectId: string; voice: string } | null = null;
  let reply: Reply | null = null;
  let nextUtterance = 1;
  let stt: SttSession | null = null;
  let talking = false;

  const error = (code: string, message: string) => deps.send({ type: "error", code, message });

  /** Makes this the reply a barge-in would cut, until it finishes on its own. */
  function track(r: Reply) {
    reply = r;
    void r.done.finally(() => {
      if (reply === r) reply = null;
    });
  }

  function sendState() {
    if (!game) return;
    deps.send({ type: "state", ...game.state() });
  }

  /** Speaks a fixed line (narration, hints, endings). Interruptible like any reply. */
  function speakLine(speaker: string, voice: string, text: string): Promise<void> {
    const utteranceId = nextUtterance++;
    const abort = new AbortController();
    deps.send({ type: "line", utteranceId, speaker, text });
    const done = (async () => {
      async function* one() {
        yield text;
      }
      try {
        await deps.tts.speak({
          voice,
          sentences: one(),
          signal: abort.signal,
          onAudio: (pcm) => {
            if (!abort.signal.aborted) deps.sendAudio(encodeAudioFrame(utteranceId, pcm));
          },
        });
      } catch {
        if (!abort.signal.aborted) deps.send({ type: "fallback_speech", utteranceId, speaker, text });
      }
      if (!abort.signal.aborted) deps.send({ type: "line_end", utteranceId, interrupted: false });
    })();
    track({
      utteranceId,
      done,
      interrupt() {
        if (abort.signal.aborted) return;
        abort.abort();
        deps.send({ type: "stop_audio", utteranceId });
        deps.send({ type: "line_end", utteranceId, interrupted: true });
      },
    });
    return done;
  }

  function narrate(text: string): Promise<void> {
    const { narrator } = pack!;
    return speakLine(narrator.id, narrator.voice, text);
  }

  /** Asks the active suspect one question and speaks the answer. */
  function runTurn(question: string) {
    if (!game || !call) return error("no_call", "Plug into a line before asking questions.");
    const g = game;
    const { suspectId, voice } = call;
    const utteranceId = nextUtterance++;
    const abort = new AbortController();
    const sentences = createChannel<string>();
    const splitter = createReplySplitter();
    let spokenSoFar: string[] = [];

    const say = (parts: string[]) => {
      for (const s of parts) {
        sentences.push(s);
        spokenSoFar = [...spokenSoFar, s];
        deps.send({ type: "line", utteranceId, speaker: suspectId, text: spokenSoFar.join(" ") });
      }
    };

    const { system, messages } = g.prepareTurn(question);

    const generate = (async (): Promise<{ meta: string | null } | null> => {
      try {
        for await (const chunk of deps.llm.stream({ system, messages, signal: abort.signal })) say(splitter.push(chunk));
        const end = splitter.end();
        say(end.sentences);
        return { meta: end.meta };
      } catch (err) {
        if (!abort.signal.aborted) {
          deps.onError?.("llm", err);
          say([BAD_LINE]);
        }
        return null; // the turn didn't happen: no clues, no nerves, no question charged
      } finally {
        sentences.close();
      }
    })();

    const speech = deps.tts.speak({
      voice,
      sentences: sentences.iterable,
      signal: abort.signal,
      onAudio: (pcm) => {
        if (!abort.signal.aborted) deps.sendAudio(encodeAudioFrame(utteranceId, pcm));
      },
      onQueued: () => deps.send({ type: "call", suspectId, status: "busy" }),
    });

    // The player can cut in before or after the LLM finishes; trim history whichever comes second.
    let heard: string | null = null;
    let recorded = false;

    const done = (async () => {
      const generated = await generate;
      let hungUp = false;
      let hint: string | null = null;
      if (generated) {
        const outcome = g.recordReply({ spoken: spokenSoFar.join(" "), meta: generated.meta });
        recorded = true;
        hungUp = outcome.hungUp;
        hint = outcome.hint;
        if (heard !== null) g.interrupted(heard);
        if (outcome.newClues.length) deps.send({ type: "clues", clues: outcome.newClues });
        if (hungUp) endCall(); // the engine already dropped the call; stop listening now
        sendState();
      }
      const ttsFailed = await speech.then(
        () => false,
        () => !abort.signal.aborted,
      );
      if (ttsFailed) {
        // The browser's own speech synthesis reads it instead, so the call never goes silent.
        deps.send({ type: "fallback_speech", utteranceId, speaker: suspectId, text: spokenSoFar.join(" ") });
      }
      if (!abort.signal.aborted) deps.send({ type: "line_end", utteranceId, interrupted: false });
      // The click of the receiver comes after their last word, not before.
      if (hungUp) deps.send({ type: "call", suspectId, status: "ended", reason: "suspect" });
      if (hint && !abort.signal.aborted) {
        deps.send({ type: "hint", text: hint });
        await narrate(hint);
      }
    })();

    track({
      utteranceId,
      done,
      interrupt(playedMs) {
        if (abort.signal.aborted) return;
        heard = heardPortion(spokenSoFar.join(" "), playedMs);
        if (recorded) g.interrupted(heard);
        abort.abort();
        deps.send({ type: "stop_audio", utteranceId });
        deps.send({ type: "line_end", utteranceId, interrupted: true });
      },
    });
  }

  async function handle(msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case "start": {
        const found = deps.cases.get(msg.caseId);
        if (!found) return error("unknown_case", "That case file doesn't exist.");
        reply?.interrupt();
        endCall();
        pack = found;
        game = createGame(found);
        deps.send({ type: "case", publicState: game.publicState() });
        sendState();
        return;
      }
      case "dial": {
        if (!game) return error("no_case", "Open a case file first.");
        const r = game.dial(msg.suspectId);
        if (!r.ok) return error("unknown_suspect", "Nobody answers on that line.");
        endCall();
        call = { suspectId: msg.suspectId, voice: r.voice };
        stt = deps.stt.open({
          onPartial: (text) => deps.send({ type: "partial", text }),
          onFinal: (text) => {
            if (!text.trim()) return; // a tap with no words: nothing to answer
            deps.send({ type: "heard", text });
            runTurn(text);
          },
          onError: () => error("stt_failed", "The line's crackling. Type your question instead."),
        });
        deps.send({ type: "call", suspectId: msg.suspectId, status: "connected" });
        sendState();
        if (r.greeting) void speakLine(msg.suspectId, r.voice, r.greeting);
        return;
      }
      case "ptt_start":
        reply?.interrupt(msg.interrupted?.playedMs);
        talking = true;
        return;
      case "ptt_end":
        if (!talking) return;
        talking = false;
        stt?.endTurn();
        return;
      case "ask":
        reply?.interrupt();
        deps.send({ type: "heard", text: msg.text });
        runTurn(msg.text);
        return;
      case "hangup":
        reply?.interrupt();
        if (call) deps.send({ type: "call", suspectId: call.suspectId, status: "ended", reason: "player" });
        endCall();
        game?.hangup();
        sendState();
        return;
      case "accuse": {
        if (!game) return error("no_case", "Open a case file first.");
        reply?.interrupt();
        endCall();
        const verdict = game.accuse(msg.suspectId, msg.evidence);
        deps.send({ type: "verdict", ...verdict });
        void narrate(verdict.text);
        return;
      }
      default:
        return;
    }
  }

  function endCall() {
    stt?.close();
    stt = null;
    talking = false;
    call = null;
  }

  return {
    handle,
    /** Mic audio from the browser (PCM16, 16 kHz). Only forwarded while talk is held. */
    audio(pcm: Uint8Array) {
      if (talking) stt?.sendAudio(pcm);
    },
    /** Resolves once the reply in flight, if any, has finished. For tests and shutdown. */
    async idle() {
      await reply?.done;
    },
  };
}
