// A tiny, deliberately boring case used by engine tests. Real cases live in /cases.

import type { z } from "zod";
import type { CasePackSchema } from "./case.js";

export function fixtureCase(): z.input<typeof CasePackSchema> {
  return {
    id: "fixture",
    title: "The Fixture Case",
    era: "1947",
    difficulty: "easy",
    questionBudget: 6,
    briefing: "Someone took the cake.",
    narrator: { id: "hale", name: "Mrs. Hale", voice: "anna" },
    startingEvidence: [{ id: "log", title: "Call log", text: "Kitchen line silent from 1:00 to 2:00." }],
    hints: [
      { id: "h1", afterClues: [], text: "Try the cook." },
      { id: "h2", afterClues: ["crumbs"], text: "Ask the butler where he was." },
    ],
    characters: [
      {
        id: "cook",
        name: "The Cook",
        role: "cook",
        line: "KI-1",
        voice: "mary",
        persona: "Gruff and busy.",
        motive: "Wanted the cake for herself.",
        truth: { guarded: "I baked it and left at one.", shaken: "I saw the butler near the pantry." },
        lies: [],
        clues: [
          { id: "crumbs", title: "Crumbs", text: "Crumbs led to the pantry.", topics: ["cake", "pantry"], fallbackPhrases: ["crumbs"] },
        ],
      },
      {
        id: "butler",
        name: "The Butler",
        role: "butler",
        line: "BU-2",
        voice: "george",
        persona: "Smooth and evasive.",
        motive: "Owed money to the baker.",
        startNerves: 2,
        truth: { guarded: "I was polishing silver all night.", shaken: "I stepped into the pantry once." },
        lies: ["I never went near the pantry."],
        clues: [
          { id: "alibi", title: "Butler's alibi", text: "Says he polished silver from 1:00 to 2:00.", topics: ["where he was"] },
          {
            id: "slip",
            title: "The slip",
            text: "Mentions the cake was chocolate, which nobody told him.",
            topics: ["cake flavour"],
            minPressure: 6,
            requires: ["crumbs"],
          },
        ],
        confession: { minNerves: 9, minKeyClues: 2, text: "Fine. I ate it." },
      },
    ],
    solution: {
      culprit: "butler",
      keyClues: ["crumbs", "alibi", "slip"],
      minKeyClues: 2,
      explanation: "The butler ate the cake.",
      endings: { solved: "Butler arrested.", rightButWeak: "Butler walks.", wrong: "Wrong person booked." },
    },
  };
}
