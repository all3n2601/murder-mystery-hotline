// The one store: server-driven game state (see reduce.ts) plus local UI state.

import { create } from "zustand";
import type { PublicCaseState, ServerMessage } from "@mmh/protocol";
import type { LinkStatus } from "../net/socket.js";
import { initialState, reduce, type GameState } from "./reduce.js";

export type Screen = "title" | "intro" | "game";
export type MicState = "unknown" | "ok" | "denied";
export type NotebookTab = "clues" | "people" | "transcript";

export type UiState = {
  screen: Screen;
  link: LinkStatus;
  mic: MicState;
  talking: boolean;
  /** A suspect whose line is ringing (dialled, not yet connected). */
  dialing: string | null;
  /** Who is audible right now (suspect id or narrator id), from the playback clock. */
  speaking: string | null;
  /** The reply being heard right now, for word-synced subtitles. */
  speakingUtterance: number | null;
  notebookOpen: boolean;
  notebookTab: NotebookTab;
  accuseOpen: boolean;
  helpOpen: boolean;
  /** First-game coaching: which hint is showing (0..2), or null once done or dismissed. */
  coach: number | null;
  reducedMotion: boolean;
  draftQuestion: string;
  verdictDismissed: boolean;
};

export type Store = GameState &
  UiState & {
    receive: (m: ServerMessage) => void;
    set: (patch: Partial<UiState & Pick<GameState, "freshClues" | "error" | "awaitingReply">>) => void;
    resetGame: () => void;
  };

const prefersReducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const useStore = create<Store>()((set) => ({
  ...initialState,
  screen: "title",
  link: "connecting",
  mic: "unknown",
  talking: false,
  dialing: null,
  speaking: null,
  speakingUtterance: null,
  notebookOpen: false,
  notebookTab: "clues",
  accuseOpen: false,
  helpOpen: false,
  coach: null,
  reducedMotion: prefersReducedMotion(),
  draftQuestion: "",
  verdictDismissed: false,
  receive: (m) => set((s) => reduce(s, m)),
  set: (patch) => set(patch),
  resetGame: () => set({ ...initialState, notebookOpen: false, accuseOpen: false, draftQuestion: "", verdictDismissed: false }),
}));

/** A stable empty list: selectors must not return a fresh array, or React re-renders forever. */
export const NO_SUSPECTS: PublicCaseState["suspects"] = [];

export const nameOf = (s: Pick<GameState, "case">, id: string): string =>
  s.case?.suspects.find((x) => x.id === id)?.name ?? (id === "you" ? "You" : id === "hale" ? "Mrs. Hale" : id);
