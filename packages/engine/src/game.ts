import { STARTING_EVIDENCE, type ChatMessage, type Clue, type PublicCaseState, type VerdictOutcome } from "@mmh/protocol";
import { z } from "zod";
import type { CaseCharacter, CaseClueDef, CasePack } from "./case.js";
import { applyPressure, NERVES } from "./nerves.js";
import { buildSystemPrompt } from "./prompt.js";

// One player's game: what they know, how rattled each suspect is, and the rules that decide
// what a suspect may reveal. Pure state, no I/O; the server feeds it turns.

const HINT_AFTER_FRUITLESS = 4;
const REDIAL_GREETING = "You again?";
/** Keeps prompts short and cheap on long interrogations. */
const MAX_HISTORY_MESSAGES = 40;

export type { ChatMessage };

export function createGame(pack: CasePack) {
  const nerves = new Map(pack.characters.map((c) => [c.id, c.startNerves]));
  const found = new Set(pack.startingEvidence.map((e) => e.id));
  // Everything the player has found, in the order they found it.
  const notebook: Clue[] = pack.startingEvidence.map((e) => ({ ...e, source: STARTING_EVIDENCE }));
  const history = new Map<string, ChatMessage[]>(pack.characters.map((c) => [c.id, []]));
  let active: CaseCharacter | null = null;
  let pendingQuestion: string | null = null;
  let questionsAsked = 0;
  const hungUpOn = new Set<string>();
  const hintsGiven = new Set<string>();
  let fruitless = 0; // questions in a row with no new clue

  const findCharacter = (id: string) => pack.characters.find((c) => c.id === id);
  const isEligible = (clue: CaseClueDef, currentNerves: number) =>
    clue.minNerves <= currentNerves && clue.requires.every((r) => found.has(r));

  /** Rattled enough and faced with enough key evidence that a push brings the confession. */
  const isCornered = (suspect: CaseCharacter, currentNerves: number) =>
    !!suspect.confession &&
    currentNerves >= suspect.confession.minNerves &&
    pack.solution.keyClues.filter((id) => found.has(id)).length >= suspect.confession.minKeyClues;

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
        startingEvidence: notebook.filter((c) => c.source === STARTING_EVIDENCE),
      };
    },

    dial(suspectId: string) {
      const suspect = findCharacter(suspectId);
      if (!suspect) return { ok: false as const, reason: "unknown_suspect" };
      active = suspect;
      let greeting: string | null = null;
      if (hungUpOn.delete(suspect.id)) {
        nerves.set(suspect.id, NERVES.REDIAL);
        greeting = REDIAL_GREETING;
        history.get(suspect.id)!.push({ role: "assistant", content: greeting });
      }
      return { ok: true as const, voice: suspect.voice, greeting };
    },

    /** Builds the LLM request for the active suspect answering this question. */
    prepareTurn(question: string) {
      const suspect = requireActive();
      const current = nerves.get(suspect.id)!;
      const unrevealed = suspect.clues.filter((clue) => !found.has(clue.id));
      const system = buildSystemPrompt({
        pack,
        character: suspect,
        nerves: current,
        eligible: unrevealed.filter((clue) => isEligible(clue, current)),
        locked: unrevealed.filter((clue) => !isEligible(clue, current)),
        confessionAvailable: isCornered(suspect, current),
      });
      const messages: ChatMessage[] = [...history.get(suspect.id)!, { role: "user" as const, content: question }].slice(
        -MAX_HISTORY_MESSAGES,
      );
      pendingQuestion = question;
      return { system, messages };
    },

    /** Applies the suspect's finished reply: new clues, nerves, hang-up. */
    recordReply(reply: { spoken: string; meta: string | null }) {
      const suspect = requireActive();
      const before = nerves.get(suspect.id)!;
      const meta = parseMeta(reply.meta);

      const newClues: Clue[] = [];
      const rejectedReveals: string[] = [];
      // Models often say a clue without tagging it; the case's fallback phrases catch that.
      const spoken = reply.spoken.toLowerCase();
      const untagged = suspect.clues
        .filter((clue) => !meta.reveal.includes(clue.id) && isEligible(clue, before))
        .filter((clue) => clue.fallbackPhrases.some((p) => spoken.includes(p.toLowerCase())))
        .map((clue) => clue.id);
      for (const id of [...meta.reveal, ...untagged]) {
        const clue = suspect.clues.find((k) => k.id === id);
        if (!clue || found.has(id)) continue;
        if (!isEligible(clue, before)) {
          rejectedReveals.push(id);
          continue;
        }
        found.add(id);
        newClues.push({ id: clue.id, title: clue.title, text: clue.text, source: suspect.id });
        notebook.push(newClues.at(-1)!);
      }

      history.get(suspect.id)!.push({ role: "user", content: pendingQuestion ?? "" }, { role: "assistant", content: reply.spoken });
      pendingQuestion = null;
      questionsAsked++;

      let after = applyPressure(before, meta.pressure_change);
      // A cornered culprit stays on the line: the next push brings the confession, not a click.
      if (isCornered(suspect, Math.max(before, after))) after = Math.min(after, NERVES.HIGHEST_GATE);
      nerves.set(suspect.id, after);
      const hungUp = after >= NERVES.HANG_UP;
      if (hungUp) {
        hungUpOn.add(suspect.id);
        active = null;
      }
      fruitless = newClues.length ? 0 : fruitless + 1;
      let hint: string | null = null;
      if (fruitless >= HINT_AFTER_FRUITLESS) {
        const ready = pack.hints.find((h) => !hintsGiven.has(h.id) && h.afterClues.every((id) => found.has(id)));
        if (ready) {
          hintsGiven.add(ready.id);
          hint = ready.text;
          fruitless = 0;
        }
      }
      // The budget is soft: questions keep working, but the narrator nudges once at zero.
      const budgetSpent = questionsAsked === pack.questionBudget;
      const exitLine = hungUp ? suspect.hangUpLine : null;
      return { newClues, rejectedReveals, nerves: after, hungUp, exitLine, hint, budgetSpent };
    },

    hangup() {
      active = null;
    },

    notebook(): Clue[] {
      return [...notebook];
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
      const keyCited = new Set(evidence.filter((id) => found.has(id) && solution.keyClues.includes(id)));
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
});

/** A missing or malformed META block means "nothing happened", never an error. */
function parseMeta(raw: string | null): z.infer<typeof Meta> {
  const nothing = { reveal: [], pressure_change: 0 };
  if (!raw) return nothing;
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const parsed = Meta.safeParse(json);
    return parsed.success ? parsed.data : nothing;
  } catch {
    return nothing;
  }
}

export type Game = ReturnType<typeof createGame>;
