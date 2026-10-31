import { createGame, createReplySplitter, type CasePack, type Game } from "@mmh/engine";
import { encodeAudioFrame, type ClientMessage, type ServerMessage } from "@mmh/protocol";
import { createChannel } from "./channel.js";
import type { LlmPort, SttPort, SttSession, TtsLine, TtsPort } from "./ports.js";

/** How long to wait, after talk is released, for STT's last transcript before asking anyway. */
const ENDPOINT_WAIT_MS = 1500;

// One player's connection: turns client messages into game moves, and game moves into
// speech. Owns the per-call STT session and the utterance currently being spoken.

export type SessionDeps = {
  cases: ReadonlyMap<string, CasePack>;
  llm: LlmPort;
  tts: TtsPort;
  stt: SttPort;
  send(message: ServerMessage): void;
  sendAudio(frame: Uint8Array): void;
  /** Failures the player only hears as "bad line"; the operator needs the real reason. */
  onError?(where: "llm" | "tts" | "stt", err: unknown): void;
  /** Game events worth an operator's attention, e.g. the model trying to leak a locked clue. */
  onEvent?(event: "rejected_reveal", data: { suspectId: string; clueIds: string[] }): void;
  limits?: Partial<SessionLimits>;
  now?: () => number;
};

/** Cost and abuse caps for one player. Every open call holds an STT session that bills by time. */
export type SessionLimits = {
  maxCalls: number;
  minDialGapMs: number;
  maxCallMs: number;
  /** Mic bytes in one push-to-talk press (16 kHz PCM16 = 32,000 bytes a second). */
  maxTalkBytes: number;
};

export const DEFAULT_LIMITS: SessionLimits = {
  maxCalls: 40,
  minDialGapMs: 3_000,
  maxCallMs: 5 * 60_000,
  maxTalkBytes: 60 * 32_000,
};

/** Where an utterance's sentences go: a call's open line, or a one-off session. */
type SpeakFn = TtsLine["speak"];

/** Something being spoken that a barge-in can cut off. */
type Speaking = { utteranceId: number; done: Promise<void>; interrupt(playedMs?: number): void };

// TTS voices speak roughly 15 characters a second; good enough to guess where the player cut in.
const CHARS_PER_SECOND = 15;
const BAD_LINE = "Sorry, detective, this line's terrible. Say again?";
const DIDNT_CATCH = "Didn't catch that, detective.";
const BUDGET_SPENT = "That's the last of your questions, detective. Time to name your killer.";
const MIN_QUESTION_CHARS = 2;

function heardPortion(text: string, playedMs: number | undefined): string {
  if (playedMs === undefined) return text;
  const cut = Math.round((playedMs / 1000) * CHARS_PER_SECOND);
  if (cut >= text.length) return text;
  const lastSpace = text.lastIndexOf(" ", cut);
  return text.slice(0, lastSpace > 0 ? lastSpace : cut);
}

async function* just(text: string) {
  yield text;
}

export function createSession(deps: SessionDeps) {
  let game: Game | null = null;
  let pack: CasePack | null = null;
  // A call keeps one TTS line open for the suspect's voice: the account allows few new sessions.
  let call: { suspectId: string; voice: string; line: TtsLine } | null = null;
  let speaking: Speaking | null = null;
  let nextUtterance = 1;
  let stt: SttSession | null = null;
  let talking = false;
  let talkBytes = 0;
  // One hold of the talk button is one question. STT ends a turn on any short pause, so its
  // finished transcripts are collected here and asked as one when talk is released.
  let heardParts: string[] = [];
  let awaitingEndpoint = false;
  let endpointTimer: NodeJS.Timeout | null = null;
  let callsMade = 0;
  let lastDialAt = -Infinity;
  let callTimer: NodeJS.Timeout | null = null;
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const now = deps.now ?? Date.now;

  const error = (code: string, message: string) => deps.send({ type: "error", code, message });

  function sendState() {
    if (game) deps.send({ type: "state", ...game.state() });
  }

  /** Makes this what a barge-in would cut, until it finishes on its own. */
  function track(s: Speaking) {
    speaking = s;
    void s.done.finally(() => {
      if (speaking === s) speaking = null;
    });
  }

  /**
   * Speaks sentences in one voice as a single utterance: tags its audio, stops cleanly on
   * barge-in, and reports whether TTS delivered. Every spoken line goes through here.
   */
  /** One-off speech in a voice with no open line (the narrator). */
  const oneOff =
    (voice: string): SpeakFn =>
    (args) =>
      deps.tts.speak({ ...args, voice });

  function startUtterance(speaker: string, speak: SpeakFn, sentences: AsyncIterable<string>) {
    const utteranceId = nextUtterance++;
    const abort = new AbortController();
    const speech = speak({
        sentences,
        signal: abort.signal,
        onAudio: (pcm) => {
          if (!abort.signal.aborted) deps.sendAudio(encodeAudioFrame(utteranceId, pcm));
        },
        onWords: (words) => {
          if (!abort.signal.aborted) deps.send({ type: "words", utteranceId, words });
        },
        onQueued: () => deps.send({ type: "busy", utteranceId }),
      })
      .then(
        () => true,
        (err) => {
          if (abort.signal.aborted) return true;
          deps.onError?.("tts", err);
          return false;
        },
      );

    return {
      utteranceId,
      signal: abort.signal,
      /** Resolves once audio is delivered; reads `text` aloud in the browser if TTS failed. */
      async finish(text: () => string) {
        const delivered = await speech;
        if (abort.signal.aborted) return;
        if (!delivered) deps.send({ type: "fallback_speech", utteranceId, speaker, text: text() });
        deps.send({ type: "line_end", utteranceId, interrupted: false });
      },
      /** Barge-in: silence it now. Returns false if it was already stopped. */
      stop(): boolean {
        if (abort.signal.aborted) return false;
        abort.abort();
        deps.send({ type: "stop_audio", utteranceId });
        deps.send({ type: "line_end", utteranceId, interrupted: true });
        return true;
      },
    };
  }

  /** Speaks a fixed line (narration, hints, endings, greetings). */
  function speakLine(speaker: string, speak: SpeakFn, text: string): Promise<void> {
    const utterance = startUtterance(speaker, speak, just(text));
    deps.send({ type: "line", utteranceId: utterance.utteranceId, speaker, text });
    const done = utterance.finish(() => text);
    track({ utteranceId: utterance.utteranceId, done, interrupt: () => void utterance.stop() });
    return done;
  }

  function narrate(text: string): Promise<void> {
    const { narrator } = pack!;
    return speakLine(narrator.id, oneOff(narrator.voice), text);
  }

  /** Asks the active suspect one question and speaks the answer as it streams in. */
  function runTurn(question: string) {
    if (!game || !call) return error("no_call", "Plug into a line before asking questions.");
    const currentGame = game;
    const { suspectId, line } = call;
    const sentences = createChannel<string>();
    const utterance = startUtterance(suspectId, line.speak, sentences.iterable);
    const spoken: string[] = [];
    const spokenText = () => spoken.join(" ");

    const say = (parts: string[]) => {
      for (const sentence of parts) {
        sentences.push(sentence);
        spoken.push(sentence);
        deps.send({ type: "line", utteranceId: utterance.utteranceId, speaker: suspectId, text: spokenText() });
      }
    };

    /** Streams the LLM reply into speech. Null means the turn didn't happen (LLM failed). */
    async function generateReply(): Promise<{ meta: string | null } | null> {
      const { system, messages } = currentGame.prepareTurn(question);
      const splitter = createReplySplitter();
      try {
        for await (const chunk of deps.llm.stream({ system, messages, signal: utterance.signal })) say(splitter.push(chunk));
        const end = splitter.end();
        say(end.sentences);
        return { meta: end.meta };
      } catch (err) {
        if (!utterance.signal.aborted) {
          deps.onError?.("llm", err);
          say([BAD_LINE]);
        }
        return null; // no clues, no nerves, no question charged
      } finally {
        sentences.close();
      }
    }

    // The player can cut in before or after the LLM finishes; trim history whichever comes second.
    let heard: string | null = null;
    let recorded = false;

    /** Applies the reply to the game and tells the player what changed. */
    function applyOutcome(meta: string | null) {
      const outcome = currentGame.recordReply({ spoken: spokenText(), meta });
      recorded = true;
      if (outcome.rejectedReveals.length) deps.onEvent?.("rejected_reveal", { suspectId, clueIds: outcome.rejectedReveals });
      if (heard !== null) currentGame.interrupted(heard);
      if (outcome.newClues.length) deps.send({ type: "clues", clues: outcome.newClues });
      // The engine already dropped the call: stop listening now, but keep the line for the exit line.
      if (outcome.hungUp) endCall({ keepLine: true });
      sendState();
      return outcome;
    }

    /** What happens once the suspect has finished speaking. */
    async function afterSpeech(outcome: ReturnType<typeof applyOutcome> | null) {
      if (outcome?.hungUp) {
        if (outcome.exitLine && !utterance.signal.aborted) await speakLine(suspectId, line.speak, outcome.exitLine);
        line.close();
        // The click of the receiver comes after their last word, not before.
        deps.send({ type: "call", suspectId, status: "ended", reason: "suspect" });
      }
      if (utterance.signal.aborted || !outcome) return;
      if (outcome.hint) {
        deps.send({ type: "hint", text: outcome.hint });
        await narrate(outcome.hint);
      }
      if (outcome.budgetSpent) await narrate(BUDGET_SPENT);
    }

    const done = (async () => {
      const generated = await generateReply();
      const outcome = generated ? applyOutcome(generated.meta) : null;
      await utterance.finish(spokenText);
      await afterSpeech(outcome);
    })();

    track({
      utteranceId: utterance.utteranceId,
      done,
      interrupt(playedMs) {
        if (utterance.signal.aborted) return;
        heard = heardPortion(spokenText(), playedMs);
        if (recorded) currentGame.interrupted(heard);
        utterance.stop();
      },
    });
  }

  /** A typed or spoken question. Too short to mean anything gets a scripted "say again". */
  function ask(text: string) {
    if (!call) return error("no_call", "Plug into a line before asking questions.");
    if (text.trim().length < MIN_QUESTION_CHARS) return void speakLine(call.suspectId, call.line.speak, DIDNT_CATCH);
    deps.send({ type: "heard", text });
    runTurn(text);
  }

  async function handle(msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case "start": {
        const chosen = deps.cases.get(msg.caseId);
        if (!chosen) return error("unknown_case", "That case file doesn't exist.");
        speaking?.interrupt();
        endCall();
        pack = chosen;
        game = createGame(chosen);
        deps.send({ type: "case", publicState: game.publicState() });
        sendState();
        return;
      }
      case "dial": {
        if (!game) return error("no_case", "Open a case file first.");
        if (callsMade >= limits.maxCalls) return error("call_limit", "The exchange has cut you off for tonight, detective.");
        if (now() - lastDialAt < limits.minDialGapMs) return error("dial_too_fast", "Easy on the switchboard. Give it a moment.");
        const dialed = game.dial(msg.suspectId);
        if (!dialed.ok) return error("unknown_suspect", "Nobody answers on that line.");
        speaking?.interrupt();
        endCall();
        callsMade++;
        lastDialAt = now();
        call = { suspectId: msg.suspectId, voice: dialed.voice, line: deps.tts.openLine(dialed.voice) };
        const timedOutCall = call;
        callTimer = setTimeout(() => {
          if (call !== timedOutCall) return;
          speaking?.interrupt();
          deps.send({ type: "call", suspectId: timedOutCall.suspectId, status: "ended", reason: "timeout" });
          endCall();
          game?.hangup();
          sendState();
        }, limits.maxCallMs);
        callTimer.unref?.();
        stt = deps.stt.open({
          onPartial: (text) => deps.send({ type: "partial", text: [...heardParts, text].join(" ") }),
          onFinal: (text) => {
            if (!talking && !awaitingEndpoint) return; // a straggler after the question was asked
            if (text.trim()) heardParts.push(text.trim());
            if (!talking) askHeard(); // the transcript the forced endpoint flushed out
          },
          onError: (err) => {
            deps.onError?.("stt", err);
            error("stt_failed", "The line's crackling. Type your question instead.");
          },
        });
        deps.send({ type: "call", suspectId: msg.suspectId, status: "connected" });
        sendState();
        if (dialed.greeting) void speakLine(msg.suspectId, call.line.speak, dialed.greeting);
        return;
      }
      case "ptt_start":
        if (awaitingEndpoint) askHeard(); // pressed again before the last question was finished
        speaking?.interrupt(msg.interrupted?.playedMs);
        talking = true;
        talkBytes = 0;
        return;
      case "ptt_end":
        if (!talking) return;
        releaseTalk();
        return;
      case "ask":
        speaking?.interrupt();
        ask(msg.text);
        return;
      case "hangup":
        speaking?.interrupt();
        if (call) deps.send({ type: "call", suspectId: call.suspectId, status: "ended", reason: "player" });
        endCall();
        game?.hangup();
        sendState();
        return;
      case "accuse": {
        if (!game) return error("no_case", "Open a case file first.");
        speaking?.interrupt();
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

  /** Talk released: flush STT, and ask whatever this hold collected as one question. */
  function releaseTalk() {
    talking = false;
    awaitingEndpoint = true;
    stt?.endTurn();
    // If everything was already transcribed, STT may have nothing more to send.
    if (endpointTimer) clearTimeout(endpointTimer);
    endpointTimer = setTimeout(() => awaitingEndpoint && askHeard(), ENDPOINT_WAIT_MS);
    endpointTimer.unref?.();
  }

  function askHeard() {
    if (endpointTimer) clearTimeout(endpointTimer);
    endpointTimer = null;
    awaitingEndpoint = false;
    const question = heardParts.join(" ");
    heardParts = [];
    ask(question);
  }

  /** Hangs up: stops listening and, unless the suspect has a last word to say, closes their line. */
  function endCall(opts: { keepLine?: boolean } = {}) {
    if (callTimer) clearTimeout(callTimer);
    callTimer = null;
    if (endpointTimer) clearTimeout(endpointTimer);
    endpointTimer = null;
    awaitingEndpoint = false;
    heardParts = [];
    stt?.close();
    stt = null;
    talking = false;
    if (!opts.keepLine) call?.line.close();
    call = null;
  }

  return {
    handle,
    /** Mic audio from the browser (PCM16, 16 kHz). Only forwarded while talk is held. */
    audio(pcm: Uint8Array) {
      if (!talking || !stt) return;
      stt.sendAudio(pcm);
      talkBytes += pcm.length;
      if (talkBytes > limits.maxTalkBytes) {
        // Someone holding the button forever: answer what they've said so far.
        releaseTalk();
      }
    },
    /** A reconnecting player gets their case, notebook and state back. */
    resync() {
      if (!game) return;
      deps.send({ type: "case", publicState: game.publicState() });
      deps.send({ type: "clues", clues: game.notebook() });
      sendState();
    },
    /** The player is gone for good: stop speaking and close the line so nothing keeps billing. */
    dispose() {
      speaking?.interrupt();
      endCall();
      game?.hangup();
    },
    /** Resolves once whatever is being spoken has finished. For tests and shutdown. */
    async idle() {
      await speaking?.done;
    },
  };
}
