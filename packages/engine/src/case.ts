import { Id, Intro, Lead } from "@mmh/protocol";
import { z } from "zod";
import { NERVES } from "./nerves.js";
import { isActedTag } from "./tags.js";
import { isKnownVoice } from "./voices.js";

// Case pack schema and loader. A pack that fails here never reaches a player.

const CaseClue = z.object({
  id: Id,
  title: z.string().min(1),
  text: z.string().min(1),
  topics: z.array(z.string().min(1)).min(1),
  // Nerves needed before the suspect will give this up.
  minNerves: z.number().int().min(NERVES.MIN).max(NERVES.HIGHEST_GATE).default(0),
  requires: z.array(Id).default([]),
  // Phrases that count as revealing the clue if the model forgets to tag it in META.
  fallbackPhrases: z.array(z.string().min(1)).default([]),
});

/** How a character talks: what makes them sound like a person instead of a narrator. */
const Speech = z.object({
  tone: z.string().min(1), // e.g. "affectionate, teasing, a little tipsy"
  habits: z.array(z.string()).default([]), // e.g. "calls the detective 'darling'"
  fillers: z.array(z.string()).default([]), // e.g. "well", "uh", "mm"
  phrases: z.array(z.string()).default([]), // signature lines they reach for
  tags: z.array(z.string()).default([]), // acted TTS tags that suit them, e.g. "sighs"
});

const Character = z.object({
  id: Id,
  name: z.string().min(1),
  role: z.string().min(1),
  line: z.string().min(1),
  /** Public, non-spoiling introduction shown in the intro and the notebook. */
  hook: z.string().min(1).optional(),
  voice: z.string().min(1),
  persona: z.string().min(1),
  motive: z.string().nullable(),
  startNerves: z.number().int().min(NERVES.MIN).max(NERVES.HIGHEST_GATE).default(2),
  truth: z.object({ guarded: z.string().min(1), shaken: z.string().min(1) }),
  lies: z.array(z.string()).default([]),
  /** Evidence that genuinely rattles them: a question mentioning any of these raises nerves. */
  pressurePoints: z.array(z.string().min(1)).default([]),
  speech: Speech.optional(),
  /** Said just before they slam the phone down. */
  hangUpLine: z.string().min(1).default("I've said all I'm going to say. Goodnight."),
  clues: z.array(CaseClue).default([]),
  confession: z
    .object({ minNerves: z.number().int().min(NERVES.MIN).max(NERVES.HIGHEST_GATE), minKeyClues: z.number().int().min(0), text: z.string().min(1) })
    .optional(),
});

export const CasePackSchema = z.object({
  id: Id,
  title: z.string().min(1),
  era: z.string().min(1),
  difficulty: z.string(),
  questionBudget: z.number().int().positive(),
  briefing: z.string().min(1),
  narrator: z.object({ id: Id, name: z.string().min(1), voice: z.string().min(1) }),
  startingEvidence: z.array(z.object({ id: Id, title: z.string().min(1), text: z.string().min(1) })),
  hints: z.array(z.object({ id: Id, afterClues: z.array(Id).default([]), text: z.string().min(1) })).default([]),
  characters: z.array(Character).min(2),
  intro: Intro.extend({ leads: z.array(Lead).default([]) }).optional(),
  solution: z.object({
    culprit: Id,
    keyClues: z.array(Id).min(1),
    minKeyClues: z.number().int().positive(),
    explanation: z.string().min(1),
    endings: z.object({ solved: z.string(), rightButWeak: z.string(), wrong: z.string() }),
  }),
});

export type CasePack = z.infer<typeof CasePackSchema>;
export type CaseCharacter = CasePack["characters"][number];
export type CaseClueDef = CaseCharacter["clues"][number];

export type LoadResult = { ok: true; pack: CasePack } | { ok: false; errors: string[] };

export function loadCase(json: unknown): LoadResult {
  const parsed = CasePackSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const errors = validateCase(parsed.data);
  return errors.length ? { ok: false, errors } : { ok: true, pack: parsed.data };
}

/** Rules a schema can't express: cross-references, solvability, casting. */
function validateCase(pack: CasePack): string[] {
  const errors: string[] = [];
  const characterIds = new Set(pack.characters.map((c) => c.id));
  const clueIds = new Set([
    ...pack.startingEvidence.map((e) => e.id),
    ...pack.characters.flatMap((c) => c.clues.map((k) => k.id)),
  ]);

  for (const c of pack.characters) {
    for (const clue of c.clues) {
      for (const r of clue.requires) {
        if (!clueIds.has(r)) errors.push(`clue ${clue.id} requires unknown clue ${r}`);
      }
    }
  }
  for (const h of pack.hints) {
    for (const r of h.afterClues) if (!clueIds.has(r)) errors.push(`hint ${h.id} waits on unknown clue ${r}`);
  }
  for (const act of pack.intro?.acts ?? []) {
    for (const l of act.lines) if (l.suspect && !characterIds.has(l.suspect)) errors.push(`intro act ${act.id} introduces unknown suspect ${l.suspect}`);
  }
  for (const lead of pack.intro?.leads ?? []) {
    if (!characterIds.has(lead.suspect)) errors.push(`lead "${lead.text}" points at unknown suspect ${lead.suspect}`);
  }
  if (!characterIds.has(pack.solution.culprit)) errors.push(`culprit ${pack.solution.culprit} is not a character`);
  for (const k of pack.solution.keyClues) if (!clueIds.has(k)) errors.push(`key clue ${k} does not exist`);

  // Reachability: starting evidence is known; a clue unlocks once all its requires are known.
  // Nerves can always be raised to the highest gate, so only requires chains make a clue unreachable.
  const reachable = new Set(pack.startingEvidence.map((e) => e.id));
  const allClues = pack.characters.flatMap((c) => c.clues);
  for (let grew = true; grew; ) {
    grew = false;
    for (const clue of allClues) {
      if (!reachable.has(clue.id) && clue.requires.every((r) => reachable.has(r))) {
        reachable.add(clue.id);
        grew = true;
      }
    }
  }
  for (const clue of allClues) if (!reachable.has(clue.id)) errors.push(`clue ${clue.id} is unreachable (requires cycle)`);

  const cast = [pack.narrator, ...pack.characters];
  const voiceOwners = new Map<string, string>();
  for (const person of cast) {
    if (!isKnownVoice(person.voice)) errors.push(`${person.id} uses unknown TTS voice ${person.voice}`);
    const owner = voiceOwners.get(person.voice);
    if (owner) errors.push(`${person.id} and ${owner} share voice ${person.voice}`);
    voiceOwners.set(person.voice, person.id);
  }

  for (const c of pack.characters) {
    for (const tag of c.speech?.tags ?? []) {
      if (!isActedTag(tag)) errors.push(`${c.id} uses tag [${tag}], which the TTS isn't known to act out`);
    }
  }

  const motives = pack.characters.filter((c) => c.motive !== null).length;
  if (motives < 2) errors.push(`only ${motives} character has a motive; a fair mystery needs at least 2`);

  const reachableKeys = pack.solution.keyClues.filter((k) => reachable.has(k)).length;
  if (reachableKeys < pack.solution.minKeyClues) {
    errors.push(`only ${reachableKeys} key clues are reachable, but minKeyClues is ${pack.solution.minKeyClues}`);
  }

  return errors;
}
