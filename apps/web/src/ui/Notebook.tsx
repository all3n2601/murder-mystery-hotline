import { useEffect } from "react";
import { NERVES_MAX, STARTING_EVIDENCE, type PublicSuspect } from "@mmh/protocol";
import { actions } from "../controller.js";
import type { Layout } from "../layout.js";
import { YOU, type Caption } from "../state/reduce.js";
import { nameOf, NO_SUSPECTS, useStore, type NotebookTab } from "../state/store.js";
import { EvidenceText } from "./EvidenceText.js";
import { box, usePortraitUrl } from "./hooks.js";

const tilt = (id: string) => `${(((id.length * 37) % 7) - 3) * 0.4}deg`;
const firstName = (name: string) => name.replace(/^(Officer|Mrs?\.|Miss)\s+/, "").split(" ")[0]!;
const TAB_LABELS: Record<NotebookTab, string> = { clues: "Clues", people: "People", transcript: "Transcript" };

function Chip({ id }: { id: string }) {
  const url = usePortraitUrl(id);
  return url ? <img className="chip" src={url} alt="" /> : null;
}

export function Notebook({ layout }: { layout: Layout }) {
  const open = useStore((s) => s.notebookOpen);
  const tab = useStore((s) => s.notebookTab);
  const fresh = useStore((s) => s.freshClues);
  const set = useStore((s) => s.set);
  const visible = layout.wide || open;

  // Fresh stamps fade to ordinary cards once the player has had a chance to see them.
  useEffect(() => {
    if (!fresh.length || !visible || tab !== "clues") return;
    const t = setTimeout(() => set({ freshClues: [] }), 6000);
    return () => clearTimeout(t);
  }, [fresh, visible, tab, set]);

  return (
    <aside className={`notebook${layout.wide ? "" : " drawer"}${visible ? "" : " closed"}`} style={box(layout.notebook)} aria-label="Notebook" aria-hidden={!visible}>
      <header>
        <h2>Notebook</h2>
        {!layout.wide && (
          <button className="btn-ghost" onClick={() => set({ notebookOpen: false })}>
            Close <kbd>N</kbd>
          </button>
        )}
      </header>
      <div className="tabs" role="tablist">
        {(Object.keys(TAB_LABELS) as NotebookTab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => set({ notebookTab: t })}>
            {TAB_LABELS[t]}
            {t === "clues" && fresh.length > 0 && <span className="badge">{fresh.length}</span>}
          </button>
        ))}
      </div>
      <div className="notebook-body" role="tabpanel">
        {tab === "clues" && <CluesTab />}
        {tab === "people" && <PeopleTab />}
        {tab === "transcript" && <TranscriptTab />}
      </div>
    </aside>
  );
}

function CluesTab() {
  const clues = useStore((s) => s.clues);
  const hints = useStore((s) => s.hints);
  const fresh = useStore((s) => s.freshClues);
  const leads = useStore((s) => s.case?.leads);
  const call = useStore((s) => s.call);
  const connected = call?.status === "connected";
  const state = useStore.getState();
  const hale = usePortraitUrl("hale");
  const dot = usePortraitUrl("dot");
  const starting = clues.filter((c) => c.source === STARTING_EVIDENCE);
  const found = clues.filter((c) => c.source !== STARTING_EVIDENCE);

  return (
    <>
      <article className="card victim" style={{ ["--tilt" as string]: "-1.2deg" }}>
        {dot ? <img src={dot} alt="Photograph of Dot Kowalski" /> : <span />}
        <div>
          <h4>The victim</h4>
          <p>Dorothy "Dot" Kowalski, night operator, position 3. Found at her board at 2:10 a.m.</p>
        </div>
      </article>
      {leads && leads.length > 0 && (
        <>
          <h3>Leads</h3>
          {leads.map((l, i) => (
            <article key={i} className="card lead">
              <Chip id={l.suspect} />
              <div className="card-content">
                <p>
                  <b>{nameOf(state, l.suspect)}.</b> {l.text}
                </p>
                <div className="card-actions">
                  {connected ? (
                    <button className="card-ask-btn" onClick={() => actions.confront(l.text.slice(0, 45))}>
                      Ask on line ▸
                    </button>
                  ) : (
                    <button className="card-ask-btn" onClick={() => actions.dial(l.suspect)}>
                      Ring line ▸
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </>
      )}
      <h3>Clues ({found.length})</h3>
      {found.length === 0 && <p className="nb-empty">Nothing yet. Somebody always says more than they mean to.</p>}
      {found.map((c) => (
        <article key={c.id} className={`card clue${fresh.includes(c.id) ? " fresh" : ""}`} style={{ ["--tilt" as string]: tilt(c.id) }}>
          {fresh.includes(c.id) && <span className="stamp">NEW</span>}
          <Chip id={c.source} />
          <div className="card-content">
            <h4>{c.title}</h4>
            <p>{c.text}</p>
            <div className="card-footer">
              <span className="src">from {nameOf(state, c.source)}</span>
              {connected ? (
                <button className="card-ask-btn" onClick={() => actions.confront(c.title)}>
                  Ask on line ▸
                </button>
              ) : (
                <button className="card-ask-btn" onClick={() => actions.dial(c.source)}>
                  Ring {firstName(nameOf(state, c.source))} ▸
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
      <h3>Evidence</h3>
      {starting.map((c) => (
        <article key={c.id} className="card" style={{ ["--tilt" as string]: tilt(c.id) }}>
          <div className="card-content">
            <h4>{c.title}</h4>
            <EvidenceText text={c.text} />
            {connected && (
              <div className="card-actions">
                <button className="card-ask-btn" onClick={() => actions.confront(c.title)}>
                  Ask on line ▸
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
      {hints.length > 0 && <h3>From Mrs. Hale</h3>}
      {hints.map((h, i) => (
        <article key={i} className="card hint">
          {hale ? <img src={hale} alt="" /> : <span />}
          <p>{h}</p>
        </article>
      ))}
    </>
  );
}

function Person({ s }: { s: PublicSuspect }) {
  const url = usePortraitUrl(s.id);
  const nerves = useStore((st) => st.nerves[s.id] ?? 0);
  const clues = useStore((st) => st.clues).filter((c) => c.source === s.id);
  const last = useStore((st) => st.transcript).findLast((c) => c.speaker === s.id);
  const hungUp = useStore((st) => st.hungUpOn.includes(s.id));
  return (
    <article className="person">
      {url && <img src={url} alt="" />}
      <div>
        <span className="person-line">{s.line}</span>
        <h4>{s.name}</h4>
        <p className="person-role">{s.role}</p>
        {s.hook && <p className="person-hook">{s.hook}</p>}
        <div className="person-meta">
          <span className="nerve-bar wide" style={{ ["--n" as string]: nerves / NERVES_MAX }}>
            <i />
          </span>
          <span>
            Nerves {nerves}/{NERVES_MAX}
          </span>
          {hungUp && <span className="scard-tag red">Hung up on you</span>}
        </div>
        {clues.length > 0 && (
          <ul className="person-clues">
            {clues.map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ul>
        )}
        {last && <p className="person-last">“{last.text.replace(/\[[^\]]*\]\s*/g, "")}”</p>}
      </div>
    </article>
  );
}

function PeopleTab() {
  const suspects = useStore((s) => s.case?.suspects) ?? NO_SUSPECTS;
  return (
    <>
      {suspects.map((s) => (
        <Person key={s.id} s={s} />
      ))}
    </>
  );
}

function TranscriptTab() {
  const transcript = useStore((s) => s.transcript);
  const state = useStore.getState();
  if (!transcript.length) return <p className="nb-empty">Every call you make is written down here.</p>;
  // Group consecutive captions by call.
  const groups: { call: string | undefined; lines: Caption[] }[] = [];
  for (const c of transcript) {
    const g = groups.at(-1);
    if (g && g.call === c.call) g.lines.push(c);
    else groups.push({ call: c.call, lines: [c] });
  }
  return (
    <>
      {groups.map((g, i) => (
        <section key={i} className="tx-call">
          <h3>{g.call ? `Call: ${nameOf(state, g.call)}` : "Exchange"}</h3>
          {g.lines.map((c) => (
            <p key={c.key} className={`tx-line${c.speaker === YOU ? " you" : ""}`}>
              <b>{nameOf(state, c.speaker)}</b> {c.text.replace(/\[[^\]]*\]\s*/g, "")}
              {c.interrupted && <span className="cut"> — cut off</span>}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}
