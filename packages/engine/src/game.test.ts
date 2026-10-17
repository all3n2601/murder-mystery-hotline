import { describe, expect, it } from "vitest";
import { loadCase } from "./case.js";
import { createGame } from "./game.js";
import { fixtureCase } from "./test-fixture.js";

function newGame(mutate?: (c: ReturnType<typeof fixtureCase>) => void) {
  const raw = fixtureCase();
  mutate?.(raw);
  const loaded = loadCase(raw);
  if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
  return createGame(loaded.pack);
}

const meta = (m: object) => JSON.stringify(m);

describe("game", () => {
  it("shows suspects and starting evidence but never the solution", () => {
    const state = newGame().publicState();
    expect(state.suspects.map((s) => s.id)).toEqual(["cook", "butler"]);
    expect(state.startingEvidence.map((e) => e.id)).toEqual(["log"]);
    expect(JSON.stringify(state)).not.toMatch(/ate the cake|culprit|polished silver/i);
  });

  it("gives a suspect only the clues they may reveal right now", () => {
    const game = newGame();
    game.dial("butler");
    const { system } = game.prepareTurn("Where were you at one?");
    expect(system).toContain("Says he polished silver"); // eligible: no requirements
    expect(system).not.toContain("chocolate"); // locked: needs crumbs and nerves 6
    expect(system).not.toContain("I ate it"); // confession not earned
  });

  it("only tells a suspect their shaken truth once their nerves reach 5", () => {
    const game = newGame();
    game.dial("butler"); // nerves 2
    expect(game.prepareTurn("q1").system).not.toContain("stepped into the pantry");
    game.recordReply({ spoken: "No.", meta: meta({ pressure_change: 3 }) }); // nerves 5
    expect(game.prepareTurn("q2").system).toContain("stepped into the pantry");
  });

  it("lets the culprit confess only when rattled and cornered by enough key clues", () => {
    // Fixture needs nerves >= 9 and 2 key clues. Start the butler rattled to keep the test short.
    const game = newGame((c) => {
      c.characters[1]!.startNerves = 9;
    });
    game.dial("butler");
    game.prepareTurn("Where were you?");
    game.recordReply({ spoken: "Polishing silver.", meta: meta({ reveal: ["alibi"], pressure_change: 0 }) }); // 1 key clue
    expect(game.prepareTurn("Really?").system).not.toContain("I ate it");
    game.recordReply({ spoken: "Yes.", meta: meta({ pressure_change: 0 }) });

    game.dial("cook");
    game.prepareTurn("Anything odd?");
    game.recordReply({ spoken: "Crumbs.", meta: meta({ reveal: ["crumbs"] }) }); // 2 key clues

    game.dial("butler");
    expect(game.prepareTurn("The crumbs led to you.").system).toContain("I ate it");
  });

  it("has the narrator offer a hint after four fruitless questions in a row", () => {
    const game = newGame();
    game.dial("cook");
    const hints: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      game.prepareTurn(`q${i}`);
      hints.push(game.recordReply({ spoken: "Busy.", meta: meta({}) }).hint);
    }
    expect(hints).toEqual([null, null, null, "Try the cook."]);
  });

  it("solves with three stars: right culprit, within budget, every key clue cited", () => {
    const game = newGame();
    game.dial("cook");
    game.prepareTurn("q");
    game.recordReply({ spoken: "Crumbs.", meta: meta({ reveal: ["crumbs"] }) });
    game.dial("butler");
    game.prepareTurn("q");
    game.recordReply({ spoken: "Silver.", meta: meta({ reveal: ["alibi"], pressure_change: 3 }) }); // nerves 5
    game.prepareTurn("q");
    game.recordReply({ spoken: "Stop it.", meta: meta({ pressure_change: 1 }) }); // nerves 6: slip unlocks
    game.prepareTurn("q");
    game.recordReply({ spoken: "Chocolate.", meta: meta({ reveal: ["slip"] }) });
    const v = game.accuse("butler", ["crumbs", "alibi", "slip"]);
    expect(v).toMatchObject({ outcome: "solved", stars: 3, text: "Butler arrested." });
    expect(v.solution.culprit).toBe("butler");
  });

  it("lets the culprit walk on weak evidence, and ignores evidence the player never found", () => {
    const game = newGame();
    const v = game.accuse("butler", ["crumbs", "alibi", "slip"]); // none actually found
    expect(v).toMatchObject({ outcome: "rightButWeak", stars: 2, text: "Butler walks." });
  });

  it("books the wrong person with no stars", () => {
    expect(newGame().accuse("cook", [])).toMatchObject({ outcome: "wrong", stars: 0, text: "Wrong person booked." });
  });

  it("remembers only what the player heard when they cut the suspect off", () => {
    const game = newGame();
    game.dial("cook");
    game.prepareTurn("What happened?");
    game.recordReply({ spoken: "I baked the cake and then I saw the butler.", meta: null });
    game.interrupted("I baked the cake and");
    const { messages } = game.prepareTurn("Sorry, go on.");
    expect(messages.at(-2)).toEqual({ role: "assistant", content: "I baked the cake and—" });
  });

  it("tells a suspect how they talk, including only their own acted tags", () => {
    const game = newGame((c) => {
      c.characters[1]!.speech = { tone: "smooth, condescending", habits: ["calls everyone 'old sport'"], fillers: ["well"], phrases: ["Quite."], tags: ["chuckles"] };
    });
    game.dial("butler");
    const { system } = game.prepareTurn("Hello?");
    expect(system).toContain("smooth, condescending");
    expect(system).toContain("calls everyone 'old sport'");
    expect(system).toContain("[chuckles]");
    expect(system).not.toContain("[gasps]"); // tags this character doesn't use aren't offered
    expect(system).not.toMatch(/no stage directions/i); // acted tags are allowed now
  });

  it("stops offering a signature phrase once the suspect has said it", () => {
    const game = newGame((c) => {
      c.characters[1]!.speech = { tone: "smooth", phrases: ["Quite.", "I polish, therefore I am."] };
    });
    game.dial("butler");
    game.prepareTurn("q");
    game.recordReply({ spoken: "Quite. I was in the pantry.", meta: meta({}) });
    const { system } = game.prepareTurn("q2");
    expect(system).not.toContain('"Quite."');
    expect(system).toContain('"I polish, therefore I am."');
  });

  it("changes a suspect's delivery as their nerves rise", () => {
    const game = newGame((c) => {
      c.characters[1]!.speech = { tone: "smooth" };
      c.questionBudget = 20;
    });
    game.dial("butler"); // nerves 2
    const calm = game.prepareTurn("q").system;
    game.recordReply({ spoken: "No.", meta: meta({ pressure_change: 3 }) });
    game.prepareTurn("q");
    game.recordReply({ spoken: "No.", meta: meta({ pressure_change: 3 }) }); // nerves 8
    const rattled = game.prepareTurn("q").system;
    expect(calm).toMatch(/in control/i);
    expect(rattled).toMatch(/false starts/i);
    expect(calm).not.toMatch(/false starts/i);
  });

  it("adds an eligible revealed clue to the notebook and rejects a locked one", () => {
    const game = newGame();
    game.dial("butler");
    game.prepareTurn("Where were you?");
    const outcome = game.recordReply({ spoken: "Polishing silver.", meta: meta({ reveal: ["alibi", "slip"] }) });
    expect(outcome.newClues.map((c) => c.id)).toEqual(["alibi"]);
    expect(outcome.rejectedReveals).toEqual(["slip"]);
  });

  it("catches an untagged clue from its fallback phrases, but only if it is eligible", () => {
    const game = newGame();
    game.dial("cook");
    game.prepareTurn("Seen anything odd?");
    const outcome = game.recordReply({ spoken: "There were Crumbs everywhere, all the way to the pantry.", meta: null });
    expect(outcome.newClues.map((c) => c.id)).toEqual(["crumbs"]);
  });

  it("treats a malformed META block as nothing happening", () => {
    const game = newGame();
    game.dial("butler");
    game.prepareTurn("Where were you?");
    const outcome = game.recordReply({ spoken: "Out.", meta: "{reveal: alibi, oops" });
    expect(outcome).toMatchObject({ newClues: [], nerves: 2, hungUp: false });
  });

  it("clamps the pressure change and hangs up when nerves reach 10", () => {
    const game = newGame();
    game.dial("butler"); // starts at nerves 2
    game.prepareTurn("q1");
    expect(game.recordReply({ spoken: "Hm.", meta: meta({ pressure_change: 50 }) }).nerves).toBe(5); // +3 max
    game.prepareTurn("q2");
    game.recordReply({ spoken: "Hm.", meta: meta({ pressure_change: 3 }) }); // 8
    game.prepareTurn("q3");
    const last = game.recordReply({ spoken: "That's it!", meta: meta({ pressure_change: 3 }) });
    expect(last.nerves).toBe(10);
    expect(last.hungUp).toBe(true);
    expect(game.state().activeCall).toBeNull();
  });

  it("keeps a cornered culprit on the line so pressure brings a confession, not a hang-up", () => {
    const game = newGame((c) => {
      c.characters[1]!.startNerves = 9;
    });
    game.dial("cook");
    game.prepareTurn("q");
    game.recordReply({ spoken: "Crumbs.", meta: meta({ reveal: ["crumbs"] }) });
    game.dial("butler");
    game.prepareTurn("q");
    game.recordReply({ spoken: "Silver.", meta: meta({ reveal: ["alibi"] }) }); // 2 key clues: cornered
    game.prepareTurn("Confess!");
    expect(game.recordReply({ spoken: "Never!", meta: meta({ pressure_change: 3 }) })).toMatchObject({ hungUp: false, nerves: 9 });
  });

  it("sends the LLM at most the last 40 messages of a suspect's history", () => {
    const game = newGame((c) => {
      c.questionBudget = 100;
    });
    game.dial("cook");
    for (let i = 0; i < 30; i++) {
      game.prepareTurn(`q${i}`);
      game.recordReply({ spoken: `a${i}`, meta: meta({}) });
    }
    const { messages } = game.prepareTurn("latest");
    expect(messages).toHaveLength(40);
    expect(messages.at(-1)).toEqual({ role: "user", content: "latest" });
    expect(messages[0]).toEqual({ role: "assistant", content: "a10" }); // oldest turns dropped
  });

  it("flags the moment the question budget runs out, once", () => {
    const game = newGame(); // budget 6
    game.dial("cook");
    const spent: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      game.prepareTurn(`q${i}`);
      spent.push(game.recordReply({ spoken: "Busy.", meta: meta({}) }).budgetSpent);
    }
    expect(spent).toEqual([false, false, false, false, false, true, false]);
  });

  it("gives a hang-up a scripted exit line: the character's own, or a default", () => {
    const hangUp = (mutate?: (c: ReturnType<typeof fixtureCase>) => void) => {
      const game = newGame((c) => {
        c.characters[1]!.startNerves = 9;
        mutate?.(c);
      });
      game.dial("butler");
      game.prepareTurn("q");
      return game.recordReply({ spoken: "Enough!", meta: meta({ pressure_change: 3 }) }).exitLine;
    };
    expect(hangUp()).toBe("I've said all I'm going to say. Goodnight.");
    expect(
      hangUp((c) => {
        c.characters[1]!.hangUpLine = "Good evening, sir.";
      }),
    ).toBe("Good evening, sir.");
  });

  it("lists the whole notebook, starting evidence first, so a reconnecting player gets it back", () => {
    const game = newGame();
    game.dial("cook");
    game.prepareTurn("q");
    game.recordReply({ spoken: "Crumbs.", meta: meta({ reveal: ["crumbs"] }) });
    expect(game.notebook().map((c) => [c.id, c.source])).toEqual([
      ["log", "start"],
      ["crumbs", "cook"],
    ]);
  });

  it("only hangs up at nerves 10, whatever the model asks for", () => {
    const game = newGame();
    game.dial("butler"); // nerves 2
    game.prepareTurn("q");
    const outcome = game.recordReply({ spoken: "Goodbye!", meta: meta({ hang_up: true, pressure_change: 1 }) });
    expect(outcome).toMatchObject({ hungUp: false, nerves: 3 });
    expect(game.state().activeCall).toBe("butler");
  });

  it("greets a redial after a hang-up with a scripted line and nerves reset to 5", () => {
    const game = newGame();
    expect(game.dial("butler")).toMatchObject({ ok: true, greeting: null });
    for (let i = 0; i < 3; i++) {
      game.prepareTurn("q");
      game.recordReply({ spoken: "Stop it!", meta: meta({ pressure_change: 3 }) }); // 2 -> 5 -> 8 -> 10
    }
    const redial = game.dial("butler");
    expect(redial).toMatchObject({ ok: true, greeting: "You again?" });
    expect(game.state().nerves.butler).toBe(5);
  });
});
