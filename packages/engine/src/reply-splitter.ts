import { isActedTag, soundFor } from "./tags.js";

// Splits a streamed suspect reply into speech for TTS and the trailing ###META block for the engine.

export type ReplySplitter = {
  /** Feed the next LLM chunk; returns sentences that are ready to speak. */
  push(chunk: string): string[];
  /** Call when the stream ends; returns the remaining speech and the raw META text, if any. */
  end(): { sentences: string[]; meta: string | null };
};

export const META_MARKER = "###META";
const MAX_TAGS_PER_REPLY = 1;

// A sentence ends at . ! ? or … (optionally followed by a closing quote or bracket),
// once whitespace and the start of the next sentence have arrived.
const SENTENCE_END = /[.!?…]["'”’)\]]?\s+(?=\S)/g;

/**
 * Turns sound cues ([sighs], [laughs]...) into spellings the TTS performs, and removes every
 * other stage direction ((grins), [walks away], *nervously*) and markdown emphasis, so TTS
 * reads only dialogue.
 */
function cleanForSpeech(text: string, budget: { tags: number }): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold** -> words kept
    .replace(/\*[^*]*\*/g, "") // *action* -> dropped
    .replace(/\([^)]*\)/g, "") // (grins) -> dropped
    .replace(/\[([^\]]*)\]/g, (_, tag: string) => {
      const name = tag.trim().toLowerCase();
      if (!isActedTag(name) || budget.tags <= 0) return "";
      budget.tags--;
      return soundFor(name);
    })
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function createReplySplitter(): ReplySplitter {
  let speech = ""; // speech not yet released
  let meta: string | null = null;
  const budget = { tags: MAX_TAGS_PER_REPLY }; // one sound effect per reply lands; more piles up

  function takeSentences(): string[] {
    const out: string[] = [];
    let start = 0;
    for (const m of speech.matchAll(SENTENCE_END)) {
      const end = m.index + m[0].length;
      const sentence = cleanForSpeech(speech.slice(start, end), budget);
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
      } else {
        // Dialogue never contains braces; a bare JSON block is META the model forgot to mark.
        const brace = speech.indexOf("{");
        if (brace !== -1) {
          meta = speech.slice(brace);
          speech = speech.slice(0, brace);
        }
      }
      return takeSentences();
    },
    end() {
      const rest = cleanForSpeech(speech, budget);
      return { sentences: rest ? [rest] : [], meta: meta === null ? null : meta.trim() };
    },
  };
}
