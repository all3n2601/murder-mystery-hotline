import { actions } from "../controller.js";
import { nameOf, useStore } from "../state/store.js";

const HEADLINES = {
  solved: (who: string) => `${who} Held in Operator's Murder`,
  rightButWeak: (who: string) => `${who} Charged, but D.A. Calls Case "Thin"`,
  wrong: () => "Wrong Party on the Line: Operator's Killer Still at Large",
} as const;

export function Verdict() {
  const verdict = useStore((s) => s.verdict)!;
  const set = useStore((s) => s.set);
  const state = useStore.getState();
  const culprit = nameOf(state, verdict.solution.culprit);
  const headline = HEADLINES[verdict.outcome](culprit);
  const isRight = verdict.outcome !== "wrong";

  return (
    <div className="modal-back">
      <article className="herald" role="dialog" aria-modal="true" aria-labelledby="herald-headline">
        <header className="herald-mast">
          <h2>The Herald</h2>
        </header>
        <div className="herald-meta">
          <span>MORNING EDITION</span>
          <span>{state.case?.era ?? "1947"}</span>
          <span>FIVE CENTS</span>
        </div>
        <h3 id="herald-headline">{headline}</h3>
        <div className="herald-stars" aria-label={`${verdict.stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < verdict.stars ? "" : "off"}>
              ★
            </span>
          ))}
        </div>
        <div className="herald-scorecard">
          <div className={`score-item${isRight ? " earned" : " missed"}`}>
            <span>{isRight ? "✔" : "✗"}</span> Named Dot Kowalski's Killer (+1★)
          </div>
          <div className={`score-item${verdict.stars >= 2 ? " earned" : " missed"}`}>
            <span>{verdict.stars >= 2 ? "✔" : "—"}</span> Solved Within Question Budget (+1★)
          </div>
          <div className={`score-item${verdict.stars === 3 ? " earned" : " missed"}`}>
            <span>{verdict.stars === 3 ? "✔" : "—"}</span> Cited All Key Contradictions (+1★)
          </div>
        </div>
        <div className="herald-cols">
          <p>{verdict.text}</p>
          <p>
            <b>How it happened.</b> {verdict.solution.explanation}
          </p>
        </div>
        <div className="herald-actions">
          <button className="btn-ghost" onClick={() => set({ verdictDismissed: true })}>
            Review Case File <kbd>Esc</kbd>
          </button>
          <button className="btn-brass" onClick={actions.playAgain} autoFocus>
            Take another call
          </button>
        </div>
      </article>
    </div>
  );
}
