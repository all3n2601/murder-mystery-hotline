// The three external services a call session talks to. Real adapters wrap AssemblyAI;
// tests pass fakes. Keep these narrow: each method is one thing the session needs.

export type Word = { word: string; start: number; end: number };

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

export interface TtsPort {
  /**
   * Speaks sentences as they arrive, in one voice. Resolves when all audio has been delivered,
   * rejects on failure. Aborting the signal stops speech immediately.
   */
  speak(opts: {
    voice: string;
    sentences: AsyncIterable<string>;
    signal: AbortSignal;
    onAudio(pcm24k: Uint8Array): void;
    onWords?(words: Word[]): void;
    /** Called if every TTS line is busy and this reply has to wait. */
    onQueued?(): void;
  }): Promise<void>;
}

export interface LlmPort {
  /** Streams a reply's text chunks. */
  stream(opts: { system: string; messages: { role: "user" | "assistant"; content: string }[]; signal: AbortSignal }): AsyncIterable<string>;
}
