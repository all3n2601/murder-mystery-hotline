import type { ChatMessage, Word } from "@mmh/protocol";

// The three external services a call session talks to. Real adapters wrap AssemblyAI;
// tests pass fakes. Keep these narrow: each method is one thing the session needs.

export type { Word };

export interface SttPort {
  /** Opens a streaming transcription session for one phone call. */
  open(handlers: { onPartial(text: string): void; onFinal(text: string): void; onError(err: Error): void }): SttSession;
}

export interface SttSession {
  sendAudio(pcm16k: Uint8Array): void;
  /** The player released push-to-talk: finalize the current turn now. */
  endTurn(): void;
  close(): void;
}

/** One open voice: speaks utterance after utterance over a single TTS session. */
export interface TtsLine {
  /**
   * Speaks sentences as they arrive. Resolves when all audio has been delivered, rejects on
   * failure. Aborting the signal stops speech immediately; the line stays usable.
   */
  speak(opts: {
    sentences: AsyncIterable<string>;
    signal: AbortSignal;
    onAudio(pcm24k: Uint8Array): void;
    onWords?(words: Word[]): void;
    /** Called if every TTS line is busy and this utterance has to wait. */
    onQueued?(): void;
  }): Promise<void>;
  /** Ends the session so it stops counting against the account. */
  close(): void;
}

export interface TtsPort {
  /** Opens a reusable line for one voice, e.g. for the length of a phone call. */
  openLine(voice: string): TtsLine;
  /** Speaks once on a short-lived line. */
  speak(opts: Parameters<TtsLine["speak"]>[0] & { voice: string }): Promise<void>;
}

export interface LlmPort {
  /** Streams a reply's text chunks. */
  stream(opts: { system: string; messages: ChatMessage[]; signal: AbortSignal }): AsyncIterable<string>;
}
