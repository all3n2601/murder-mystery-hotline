// Wires the game socket, the audio engine and the store, and holds every player action.
// Screens call these actions; nothing else talks to the socket or the audio graph.

import type { ServerMessage } from "@mmh/protocol";
import { createAudioEngine, type AudioEngine } from "./audio/engine.js";
import { createGameSocket } from "./net/socket.js";
import { useStore } from "./state/store.js";

export const CASE_ID = "night-operator";
const INTRO_SEEN = "hotline-intro-seen";

const store = useStore;
const set = store.getState().set;

function safeStorage(kind: "sessionStorage" | "localStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

let audio: AudioEngine | null = null;
const speakerOf = new Map<number, string>();
let stopBusy: (() => void) | null = null;
let stopThinking: (() => void) | null = null;
const COACHED = "hotline-coached";
let stopAmbience: (() => void) | null = null;

const socket = createGameSocket({
  url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/game`,
  storage: safeStorage("sessionStorage"),
  WebSocket,
  onMessage: handle,
  onAudio: (frame) => audio?.playFrame(frame),
  onStatus: (link) => set({ link }),
});

function handle(m: ServerMessage) {
  const before = store.getState();
  store.getState().receive(m);
  const sfx = audio?.sfx;
  switch (m.type) {
    case "line":
    case "fallback_speech":
      speakerOf.set(m.utteranceId, m.speaker);
      if (m.type === "fallback_speech" && "speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(m.text));
      break;
    case "error":
      set({ dialing: null });
      break;
    case "stop_audio":
      audio?.stop(m.utteranceId);
      break;
    case "clues":
      if (store.getState().freshClues.length > before.freshClues.length) {
        sfx?.stamp();
        actions.coachDone(2);
      }
      break;
    case "call":
      set({ dialing: null });
      if (m.status === "connected") sfx?.receiverUp();
      else if (m.reason === "suspect") {
        sfx?.yank();
        sfx?.dialTone();
      } else {
        sfx?.receiverDown();
        if (m.reason === "timeout") sfx?.dialTone();
      }
      break;
  }
  syncLoops();
}

/** Busy crackle and thinking crackle follow the state, whatever changed it. */
function syncLoops() {
  const sfx = audio?.sfx;
  const { awaitingReply } = store.getState();
  if (awaitingReply && !stopThinking && sfx) stopThinking = sfx.thinking();
  if (!awaitingReply && stopThinking) {
    stopThinking();
    stopThinking = null;
  }
  const busy = store.getState().busy;
  if (busy && !stopBusy && sfx) stopBusy = sfx.busy();
  if (!busy && stopBusy) {
    stopBusy();
    stopBusy = null;
  }
}

// Who is audible, for the portrait's speaking motion. Polled from the playback clock.
function watchSpeaker() {
  const id = audio?.audible() ?? null;
  const speaking = id === null ? null : (speakerOf.get(id) ?? null);
  if (store.getState().speaking !== speaking || store.getState().speakingUtterance !== id) set({ speaking, speakingUtterance: id });
  requestAnimationFrame(watchSpeaker);
}

export function introSeen(): boolean {
  try {
    return safeStorage("localStorage")?.getItem(INTRO_SEEN) === "1";
  } catch {
    return false;
  }
}

export const actions = {
  /** The title-screen click: unlocks audio, asks for the mic, opens the case. */
  async pickUp({ skipIntro = false } = {}) {
    if (!audio) {
      audio = await createAudioEngine({
        onMic: (pcm) => store.getState().talking && socket.sendAudio(pcm),
        onMicState: (ok) => set({ mic: ok ? "ok" : "denied" }),
      });
      requestAnimationFrame(watchSpeaker);
    }
    audio.sfx.receiverUp();
    const s = store.getState();
    if (s.resumed && s.case) return actions.enterGame();
    socket.send({ type: "start", caseId: CASE_ID });
    if (skipIntro) return actions.enterGame();
    set({ screen: "intro" });
    stopAmbience = audio.sfx.rain(0.05);
  },

  enterGame() {
    try {
      safeStorage("localStorage")?.setItem(INTRO_SEEN, "1");
    } catch {}
    stopAmbience?.();
    stopAmbience = audio?.sfx.roomTone() ?? null;
    let coached = false;
    try {
      coached = safeStorage("localStorage")?.getItem(COACHED) === "1";
    } catch {}
    set({ screen: "game", coach: coached || store.getState().called.length ? null : 0 });
  },

  replayIntro() {
    stopAmbience?.();
    stopAmbience = audio?.sfx.rain(0.05) ?? null;
    set({ screen: "intro", notebookOpen: false, accuseOpen: false });
  },

  dial(suspectId: string) {
    const s = store.getState();
    if (s.call?.status === "connected" && s.call.suspectId === suspectId) return;
    const line = s.case?.suspects.find((x) => x.id === suspectId)?.line ?? "0";
    audio?.sfx.dial(Number(line.at(-1)) || 0);
    if (socket.send({ type: "dial", suspectId })) {
      set({ dialing: suspectId });
      actions.coachDone(0);
    }
  },

  dialIndex(index: number) {
    const id = store.getState().case?.suspects[index]?.id;
    if (id) actions.dial(id);
  },

  hangup() {
    if (store.getState().call?.status === "connected") socket.send({ type: "hangup" });
  },

  talkStart() {
    const s = store.getState();
    if (s.talking || s.mic !== "ok" || s.call?.status !== "connected") return;
    const interrupted = audio?.interrupt() ?? null;
    socket.send(interrupted ? { type: "ptt_start", interrupted } : { type: "ptt_start" });
    set({ talking: true });
    actions.coachDone(1);
  },

  talkEnd() {
    if (!store.getState().talking) return;
    set({ talking: false });
    socket.send({ type: "ptt_end" });
  },

  ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    audio?.interrupt();
    const sent = socket.send({ type: "ask", text: trimmed.slice(0, 500) });
    if (sent) {
      set({ awaitingReply: true });
      actions.coachDone(1);
      syncLoops();
    }
    return sent;
  },

  confront(topicOrTitle: string) {
    const question = `What can you tell me about: ${topicOrTitle}?`;
    set({ draftQuestion: question });
    audio?.sfx.typeKey();
    const el = document.getElementById("ask");
    if (el) el.focus();
  },

  accuse(suspectId: string, evidence: string[]) {
    audio?.sfx.stamp();
    socket.send({ type: "accuse", suspectId, evidence });
    set({ accuseOpen: false });
  },

  playAgain() {
    socket.forgetSession();
    location.reload();
  },

  /** Move the first-game coaching on (or end it). */
  coachDone(step: number) {
    const coach = store.getState().coach;
    if (coach === null || coach !== step) return;
    const next = step + 1 < 3 ? step + 1 : null;
    set({ coach: next });
    if (next === null) {
      try {
        safeStorage("localStorage")?.setItem(COACHED, "1");
      } catch {}
    }
  },
  skipCoach() {
    set({ coach: null });
    try {
      safeStorage("localStorage")?.setItem(COACHED, "1");
    } catch {}
  },

  retryLine: () => socket.retry(),
  typeKey: () => audio?.sfx.typeKey(),
  audio: () => audio,
  /** How far into a reply playback is, in ms. */
  playedMs: (utteranceId: number) => audio?.playedMs(utteranceId) ?? null,
  micLevel: () => audio?.micLevel() ?? 0,
};
