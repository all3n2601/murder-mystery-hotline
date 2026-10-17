import type { Clue, PublicCaseState, VerdictOutcome } from "@mmh/protocol";
import { z } from "zod";
import type { CaseCharacter, CaseClueDef, CasePack } from "./case.js";
import { buildSystemPrompt } from "./prompt.js";

// One player's game: what they know, how rattled each suspect is, and the rules that decide
// what a suspect may reveal. Pure state, no I/O; the server feeds it turns.

const REDIAL_NERVES = 5;
const HINT_AFTER_FRUITLESS = 4;

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function createGame(pack: CasePack) {
  const nerves = new Map(pack.characters.map((c) => [c.id, c.startNerves]));
  const found = new Set(pack.startingEvidence.map((e) => e.id));
  const history = new Map<string, ChatMessage[]>(pack.characters.map((c) => [c.id, []]));
  let active: CaseCharacter | null = null;
  let pendingQuestion: string | null = null;
  let questionsAsked = 0;
  const hungUpOn = new Set<string>();
  const hintsGiven = new Set<string>();
  let fruitless = 0; // questions in a row with no new clue

  const character = (id: string) => pack.characters.find((c) => c.id === id);
  const isEligible = (k: CaseClueDef, n: number) => k.minPressure <= n && k.requires.every((r) => found.has(r));

  function requireActive(): CaseCharacter {
    if (!active) throw new Error("no active call");
    return active;
  }

  return {
    publicState(): PublicCaseState {
      return {
        caseId: pack.id,
        title: pack.title,
        era: pack.era,
        briefing: pack.briefing,
        questionBudget: pack.questionBudget,
        suspects: pack.characters.map((c) => ({ id: c.id, name: c.name, role: c.role, line: c.line })),
        startingEvidence: pack.startingEvidence.map((e) => ({ ...e, source: "start" })),
      };
    },

    dial(suspectId: string) {
      const c = character(suspectId);
      if (!c) return { ok: false as const, reason: "unknown_suspect" };
      active = c;
      let greeting: string | null = null;
      if (hungUpOn.delete(c.id)) {
        nerves.set(c.id, REDIAL_NERVES);
        greeting = "You again?";
        history.get(c.id)!.push({ role: "assistant", content: greeting });
      }
      return { ok: true as const, voice: c.voice, name: c.name, greeting };
    },

    /** Builds the LLM request for the active suspect answering this question. */
    prepareTurn(question: string) {
      const c = requireActive();
      const n = nerves.get(c.id)!;
      const unrevealed = c.clues.filter((k) => !found.has(k.id));
      const system = buildSystemPrompt({
        pack,
        character: c,
        nerves: n,
        eligible: unrevealed.filter((k) => isEligible(k, n)),
        locked: unrevealed.filter((k) => !isEligible(k, n)),
        confessionAvailable:
          !!c.confession &&
          n >= c.confession.minNerves &&
          pack.solution.keyClues.filter((k) => found.has(k)).length >= c.confession.minKeyClues,
      });
      const messages: ChatMessage[] = [...history.get(c.id)!, { role: "user", content: question }];
      pendingQuestion = question;
      return { system, messages };
    },

    /** Applies the suspect's finished reply: new clues, nerves, hang-up. */
    recordReply(reply: { spoken: string; meta: string | null }) {
      const c = requireActive();
      const n = nerves.get(c.id)!;
      const m = parseMeta(reply.meta);

      const newClues: Clue[] = [];
      const rejectedReveals: string[] = [];
      // Models often say a clue without tagging it; the case's fallback phrases catch that.
      const spoken = reply.spoken.toLowerCase();
      const untagged = c.clues
        .filter((k) => !m.reveal.includes(k.id) && isEligible(k, n))
        .filter((k) => k.fallbackPhrases.some((p) => spoken.includes(p.toLowerCase())))
        .map((k) => k.id);
      for (const id of [...m.reveal, ...untagged]) {
        const clue = c.clues.find((k) => k.id === id);
        if (!clue || found.has(id)) continue;
        if (!isEligible(clue, n)) {
          rejectedReveals.push(id);
          continue;
        }
        found.add(id);
        newClues.push({ id: clue.id, title: clue.title, text: clue.text, source: c.id });
      }

      history.get(c.id)!.push({ role: "user", content: pendingQuestion ?? "" }, { role: "assistant", content: reply.spoken });
      pendingQuestion = null;
      questionsAsked++;

      const delta = Math.max(-2, Math.min(3, Math.round(m.pressure_change)));
      const next = Math.max(0, Math.min(10, n + delta));
      nerves.set(c.id, next);
      const hungUp = next >= 10 || m.hang_up;
      if (hungUp) {
        hungUpOn.add(c.id);
        active = null;
      }
      fruitless = newClues.length ? 0 : fruitless + 1;
      let hint: string | null = null;
      if (fruitless >= HINT_AFTER_FRUITLESS) {
        const ready = pack.hints.find((h) => !hintsGiven.has(h.id) && h.afterClues.every((k) => found.has(k)));
        if (ready) {
          hintsGiven.add(ready.id);
          hint = ready.text;
          fruitless = 0;
        }
      }
      return { newClues, rejectedReveals, nerves: next, hungUp, hint };
    },

    hangup() {
      active = null;
    },

    /** The player talked over the active suspect: keep only the words they heard. */
    interrupted(heard: string) {
      const turns = active && history.get(active.id);
      const last = turns?.at(-1);
      if (last?.role === "assistant") last.content = `${heard.trim()}—`;
    },

    /** Final accusation. Only evidence the player actually found counts. */
    accuse(suspectId: string, evidence: string[]) {
      const { solution } = pack;
      const keyCited = new Set(evidence.filter((e) => found.has(e) && solution.keyClues.includes(e)));
      const rightCulprit = suspectId === solution.culprit;
      const outcome: VerdictOutcome = !rightCulprit
        ? "wrong"
        : keyCited.size >= solution.minKeyClues
          ? "solved"
          : "rightButWeak";
      const stars = rightCulprit
        ? 1 + Number(questionsAsked <= pack.questionBudget) + Number(keyCited.size === solution.keyClues.length)
        : 0;
      active = null;
      return {
        outcome,
        stars,
        text: solution.endings[outcome],
        solution: { culprit: solution.culprit, explanation: solution.explanation },
      };
    },

    state() {
      return {
        questionsLeft: Math.max(0, pack.questionBudget - questionsAsked),
        nerves: Object.fromEntries(nerves),
        activeCall: active?.id ?? null,
      };
    },
  };
}

const Meta = z.object({
  reveal: z.array(z.string()).catch([]),
  pressure_change: z.number().catch(0),
  hang_up: z.boolean().catch(false),
});

/** A missing or malformed META block means "nothing happened", never an error. */
function parseMeta(raw: string | null): z.infer<typeof Meta> {
  const fallback = { reveal: [], pressure_change: 0, hang_up: false };
  if (!raw) return fallback;
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const parsed = Meta.safeParse(json);
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export type Game = ReturnType<typeof createGame>;
