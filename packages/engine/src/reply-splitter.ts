// Splits a streamed suspect reply into speech for TTS and the trailing ###META block for the engine.

export type ReplySplitter = {
  /** Feed the next LLM chunk; returns sentences that are ready to speak. */
  push(chunk: string): string[];
  /** Call when the stream ends; returns the remaining speech and the raw META text, if any. */
  end(): { sentences: string[]; meta: string | null };
};

export const META_MARKER = "###META";

// A sentence ends at . ! ? or … (optionally followed by a closing quote or bracket),
// once whitespace and the start of the next sentence have arrived.
const SENTENCE_END = /[.!?…]["'”’)\]]?\s+(?=\S)/g;

/** Removes stage directions ((sighs), [pause], *nervously*) and markdown emphasis so TTS reads only dialogue. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold** -> words kept
    .replace(/\*[^*]*\*/g, "") // *action* -> dropped
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "") // (sighs), [pause] -> dropped
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function createReplySplitter(): ReplySplitter {
  let speech = ""; // speech not yet released
  let meta: string | null = null;

  function takeSentences(): string[] {
    const out: string[] = [];
    let start = 0;
    for (const m of speech.matchAll(SENTENCE_END)) {
      const end = m.index + m[0].length;
      const sentence = cleanForSpeech(speech.slice(start, end));
      if (sentence) out.push(sentence);
      start = end;
    }
    speech = speech.slice(start);
    return out;
  }

  return {
    push(chunk) {
      if (meta !== null) {
        meta += chunk;
        return [];
      }
      speech += chunk;
      const at = speech.indexOf(META_MARKER);
      if (at !== -1) {
        meta = speech.slice(at + META_MARKER.length);
        speech = speech.slice(0, at);
      }
      return takeSentences();
    },
    end() {
      const rest = cleanForSpeech(speech);
      return { sentences: rest ? [rest] : [], meta: meta === null ? null : meta.trim() };
    },
  };
}
