import { useState } from "react";
import { STARTING_EVIDENCE, type PublicSuspect } from "@mmh/protocol";
import { actions } from "../controller.js";
import { nameOf, NO_SUSPECTS, useStore } from "../state/store.js";
import { EvidenceText } from "./EvidenceText.js";
import { usePortraitUrl } from "./hooks.js";

function SuspectCard({ s, checked, cluesCount, onPick }: { s: PublicSuspect; checked: boolean; cluesCount: number; onPick: () => void }) {
  const url = usePortraitUrl(s.id);
  return (
    <label className="suspect-card">
      <input type="radio" name="culprit" value={s.id} checked={checked} onChange={onPick} />
      {url ? <img src={url} alt="" /> : <span style={{ aspectRatio: "3/4", background: "#1c2638" }} />}
      <b>{s.name}</b>
      <small>{s.role}</small>
      <span className="suspect-card-meta">
        <span className="scard-line">{s.line}</span>
        {cluesCount > 0 && <span className="scard-clues">{cluesCount} clue{cluesCount === 1 ? "" : "s"}</span>}
      </span>
    </label>
  );
}

export function AccuseFile() {
  const suspects = useStore((s) => s.case?.suspects ?? NO_SUSPECTS);
  const clues = useStore((s) => s.clues);
  const set = useStore((s) => s.set);
  const state = useStore.getState();
  const [culprit, setCulprit] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const chosenSuspect = suspects.find((s) => s.id === culprit);
  const name = chosenSuspect?.name;

  const toggle = (id: string) => setEvidence((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && set({ accuseOpen: false })}>
      <form
        className="casefile"
        role="dialog"
        aria-modal="true"
        aria-labelledby="casefile-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (culprit) setConfirming(true);
        }}
      >
        <h2 id="casefile-title">File the charge</h2>
        <p className="lede">Name Dot's killer, and attach the evidence that proves it. Once it's filed, there's no taking it back.</p>
        <fieldset>
          <legend>The accused</legend>
          <div className="suspect-cards">
            {suspects.map((s) => (
              <SuspectCard
                key={s.id}
                s={s}
                checked={culprit === s.id}
                cluesCount={clues.filter((c) => c.source === s.id).length}
                onPick={() => (setCulprit(s.id), setConfirming(false))}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Evidence ({evidence.length} attached)</legend>
          <div className="evidence-list">
            {clues.map((c) => (
              <label key={c.id} className="evidence-item">
                <input type="checkbox" checked={evidence.includes(c.id)} onChange={() => (toggle(c.id), actions.typeKey())} />
                <span>
                  <div className="evidence-header">
                    <b>{c.title}</b>
                    <span className="evidence-source">
                      {c.source === STARTING_EVIDENCE ? "Starting Evidence" : `from ${nameOf(state, c.source)}`}
                    </span>
                  </div>
                  <EvidenceText text={c.text} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {confirming && culprit ? (
          <div className="confirm" role="alertdialog" aria-label="Confirm the charge">
            <span>
              Charge <b>{name}</b> ({chosenSuspect?.role}) with murder, on {evidence.length} piece{evidence.length === 1 ? "" : "s"} of evidence?
            </span>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              Not yet
            </button>
            <button type="button" className="btn-brass danger" autoFocus onClick={() => actions.accuse(culprit, evidence)}>
              File it
            </button>
          </div>
        ) : (
          <div className="casefile-actions">
            <button type="button" className="btn-ghost" onClick={() => set({ accuseOpen: false })}>
              Back to the board <kbd>Esc</kbd>
            </button>
            <button type="submit" className="btn-brass danger" disabled={!culprit}>
              File the charge
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
