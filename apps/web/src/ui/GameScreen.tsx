import { useEffect, useRef, useState } from "react";
import { NERVES_MAX } from "@mmh/protocol";
import { wordsSaid } from "../audio/words.js";
import { actions } from "../controller.js";
import { keyAction } from "../input/keys.js";
import { receiverState, type ReceiverState } from "../input/receiver.js";
import type { Layout } from "../layout.js";
import { YOU, type Caption } from "../state/reduce.js";
import { nameOf, NO_SUSPECTS, useStore, type NotebookTab } from "../state/store.js";
import { AccuseFile } from "./AccuseFile.js";
import { box, useLayout, usePortraitUrl } from "./hooks.js";
import { Notebook } from "./Notebook.js";
import { Slips } from "./Slips.js";
import { Verdict } from "./Verdict.js";

const TABS: NotebookTab[] = ["clues", "people", "transcript"];
const firstName = (name: string) => name.replace(/^(Officer|Mrs?\.|Miss)\s+/, "").split(" ")[0]!;

export function GameScreen() {
  const layout = useLayout();
  const accuseOpen = useStore((s) => s.accuseOpen);
  const helpOpen = useStore((s) => s.helpOpen);
  const verdict = useStore((s) => s.verdict);
  const verdictDismissed = useStore((s) => s.verdictDismissed);
  useKeyboard();

  return (
    <>
      <TopBar layout={layout} />
      <CallCard layout={layout} />
      <Subtitles layout={layout} />
      <SuspectStrip layout={layout} />
      <ReceiverBar layout={layout} />
      <Notebook layout={layout} />
      <Slips layout={layout} />
      <CoachMarks layout={layout} />
      {helpOpen && <HelpOverlay />}
      {accuseOpen && !verdict && <AccuseFile />}
      {verdict && !verdictDismissed && <Verdict />}
    </>
  );
}

function useKeyboard() {
  useEffect(() => {
    const typingNow = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };
    const handle = (e: KeyboardEvent, phase: "down" | "up") => {
      const s = useStore.getState();
      if (s.accuseOpen || (s.verdict && !s.verdictDismissed) || s.helpOpen) {
        if (phase === "down" && e.code === "Escape") {
          if (s.verdict && !s.verdictDismissed) s.set({ verdictDismissed: true });
          else s.set({ accuseOpen: false, helpOpen: false });
        }
        return;
      }
      const action = keyAction({ code: e.code, phase, repeat: e.repeat, mod: e.metaKey || e.ctrlKey || e.altKey }, { typing: typingNow(), notebook: s.notebookOpen });
      if (!action) return;
      e.preventDefault();
      switch (action.type) {
        case "talk_start":
          return actions.talkStart();
        case "talk_end":
          return actions.talkEnd();
        case "dial":
          return actions.dialIndex(action.index);
        case "hangup":
          return actions.hangup();
        case "leave_input":
          return (document.activeElement as HTMLElement | null)?.blur();
        case "notebook":
          return s.set({ notebookOpen: !s.notebookOpen });
        case "accuse":
          return s.set({ accuseOpen: true });
        case "focus_type":
          return document.getElementById("ask")?.focus();
        case "help":
          return s.set({ helpOpen: true });
        case "next_tab":
          return s.set({ notebookTab: TABS[(TABS.indexOf(s.notebookTab) + 1) % TABS.length]! });
      }
    };
    const down = (e: KeyboardEvent) => handle(e, "down");
    const up = (e: KeyboardEvent) => handle(e, "up");
    // Losing focus mid-talk (alt-tab) must not leave the mic open.
    const blur = () => actions.talkEnd();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}

/** Re-renders every frame while `on`, for clocks that live outside React (audio, mic). */
function useFrame(on: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}

function useReceiver(): ReceiverState {
  return receiverState({
    call: useStore((s) => s.call),
    dialing: useStore((s) => s.dialing),
    talking: useStore((s) => s.talking),
    awaitingReply: useStore((s) => s.awaitingReply),
    speaking: useStore((s) => s.speaking),
    mic: useStore((s) => s.mic),
    questionsLeft: useStore((s) => (s.case ? s.questionsLeft : 1)),
  });
}

// ---- top bar -------------------------------------------------------------------------

function TopBar({ layout }: { layout: Layout }) {
  const title = useStore((s) => s.case?.title ?? "");
  const era = useStore((s) => s.case?.era ?? "");
  const left = useStore((s) => s.questionsLeft);
  const fresh = useStore((s) => s.freshClues);
  const verdict = useStore((s) => s.verdict);
  const verdictDismissed = useStore((s) => s.verdictDismissed);
  const set = useStore((s) => s.set);
  const [menu, setMenu] = useState(false);
  const level = left <= 3 ? " red" : left <= 8 ? " amber" : "";

  return (
    <header className="topbar" style={box(layout.topBar)}>
      <div className="topbar-title">
        {title}
        <small>{era}</small>
      </div>
      <div className="topbar-spacer" />
      <div className={`ticket${level}`} key={left} title={left === 0 ? "Over budget! Extra questions cost 1 star." : "Questions left before soft cutoff"}>
        <b>{left}</b> question{left === 1 ? "" : "s"} left{left === 0 && <span className="ticket-over"> (-1★)</span>}
      </div>
      {verdict && verdictDismissed ? (
        <button className="btn-brass" onClick={() => set({ verdictDismissed: false })}>
          Verdict Paper ★
        </button>
      ) : (
        <button className="btn-brass danger" onClick={() => set({ accuseOpen: true })}>
          Accuse <kbd>A</kbd>
        </button>
      )}
      {!layout.wide && (
        <button className="btn-ghost topbar-notebook-btn" onClick={() => set({ notebookOpen: !useStore.getState().notebookOpen })}>
          Notebook <kbd>N</kbd>
          {fresh.length > 0 && <span className="badge">{fresh.length}</span>}
        </button>
      )}
      <button className="btn-ghost icon" onClick={() => set({ helpOpen: true })} aria-label="Controls">
        ?
      </button>
      <div className="menu">
        <button className="btn-ghost icon" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu(!menu)}>
          ☰<span className="sr-only">Menu</span>
        </button>
        {menu && (
          <div className="menu-pop" role="menu" onMouseLeave={() => setMenu(false)}>
            <button className="btn-ghost" role="menuitem" onClick={() => (setMenu(false), actions.replayIntro())}>
              Replay intro
            </button>
            <button className="btn-ghost" role="menuitem" onClick={actions.playAgain}>
              Start the case over
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ---- the call --------------------------------------------------------------------------

/** What a nerves level means for the player (thresholds match packages/engine/src/nerves.ts). */
function nervesMeaning(n: number): { zone: string; tip: string } {
  if (n >= NERVES_MAX) return { zone: "Hung up", tip: "They slammed the phone down. Ring back and they'll be shaken, but talking." };
  if (n >= 7) return { zone: "Rattled", tip: "Close to cracking. One more push could break them, or make them hang up." };
  if (n >= 5) return { zone: "Shaken", tip: "Their story's slipping. Secrets can come out now: keep the pressure on." };
  return { zone: "Calm", tip: "Guarded, sticking to their story. Press them with what you know." };
}

/** The VU-style nerves needle, with its zones labelled and what the reading means. */
function NervesGauge({ value }: { value: number }) {
  const angle = -80 + (Math.min(NERVES_MAX, value) / NERVES_MAX) * 160;
  const pt = (v: number, r: number) => {
    const a = ((-80 + (v / NERVES_MAX) * 160 - 90) * Math.PI) / 180;
    return [100 + Math.cos(a) * r, 92 + Math.sin(a) * r] as const;
  };
  const arc = (from: number, to: number) => `M ${pt(from, 70).join(" ")} A 70 70 0 0 1 ${pt(to, 70).join(" ")}`;
  const label = (v: number, text: string) => {
    const [x, y] = pt(v, 44);
    return (
      <text x={x} y={y} textAnchor="middle" className="gauge-zone">
        {text}
      </text>
    );
  };
  // A "+2" pops up beside the gauge when a question rattles them.
  const prev = useRef(value);
  const [delta, setDelta] = useState<{ n: number; key: number } | null>(null);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (d !== 0) setDelta({ n: d, key: Date.now() });
  }, [value]);
  const { zone, tip } = nervesMeaning(value);

  return (
    <div className="nerves">
      <svg className="gauge" viewBox="0 0 200 112" role="meter" aria-valuemin={0} aria-valuemax={NERVES_MAX} aria-valuenow={value} aria-valuetext={`${zone}, nerves ${value} of ${NERVES_MAX}`} aria-label="Nerves">
        <rect x="2" y="2" width="196" height="108" rx="8" fill="#e8dcc0" stroke="#c9a24a" strokeWidth="3" />
        <path d={arc(0, 4.95)} stroke="#2a2116" strokeWidth="4" fill="none" />
        <path d={arc(5, 6.95)} stroke="#d08a1e" strokeWidth="7" fill="none" />
        <path d={arc(7, 9.95)} stroke="#c0392b" strokeWidth="9" fill="none" />
        {Array.from({ length: 11 }, (_, i) => {
          const [x1, y1] = pt(i, 62);
          const [x2, y2] = pt(i, 74);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a2116" strokeWidth={i % 5 ? 1.5 : 3} />;
        })}
        {label(2, "CALM")}
        {label(6, "SHAKEN")}
        {label(8.4, "RATTLED")}
        <text x="12" y="104" className="gauge-label">NERVES</text>
        <text x="188" y="104" textAnchor="end" className="gauge-label">
          {value}/{NERVES_MAX}
        </text>
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 92px", transition: "transform 0.8s cubic-bezier(.3,1.6,.5,1)" }}>
          <line x1="100" y1="92" x2="100" y2="26" stroke="#1b160e" strokeWidth="2.5" />
        </g>
        <circle cx="100" cy="92" r="6" fill="#c9a24a" />
      </svg>
      {delta && (
        <span key={delta.key} className={`nerves-delta${delta.n > 0 ? " up" : " down"}`} aria-hidden="true">
          {delta.n > 0 ? `+${delta.n}` : delta.n}
        </span>
      )}
      <p className={`nerves-tip zone-${zone.toLowerCase().replace(" ", "-")}`}>
        <b>{zone}.</b> {tip}
      </p>
    </div>
  );
}

function CallCard({ layout }: { layout: Layout }) {
  const suspects = useStore((s) => s.case?.suspects) ?? NO_SUSPECTS;
  const call = useStore((s) => (s.call?.status === "connected" ? s.call.suspectId : null));
  const dialing = useStore((s) => s.dialing);
  const nerves = useStore((s) => (call ? (s.nerves[call] ?? 0) : 0));
  const who = suspects.find((x) => x.id === (call ?? dialing));
  const { stage } = layout;

  if (!who) {
    return (
      <div className="empty-line" style={{ ...box(stage), height: stage.h - layout.subtitles.h * 0.6 }}>
        <div>
          <strong>Plug into a line</strong>
          Pick a suspect below, or press <kbd>1</kbd>–<kbd>{suspects.length || 4}</kbd>.
        </div>
      </div>
    );
  }
  return (
    <section className="call-card" style={{ left: stage.x + 16, top: stage.y + 16 }} aria-label="Current call">
      <span className={`call-status${call ? "" : " idle"}`}>{call ? `ON THE LINE · ${who.line}` : `RINGING ${who.line}…`}</span>
      <h2>{who.name}</h2>
      <p>{who.role}</p>
      {call && <NervesGauge key={call} value={nerves} />}
    </section>
  );
}

/** Acted cues are performed, not shown: strip anything still in brackets. */
const shown = (text: string) => text.replace(/\[[^\]]*\]\s*/g, "");

function Subtitles({ layout }: { layout: Layout }) {
  const transcript = useStore((s) => s.transcript);
  const partial = useStore((s) => s.partial);
  const words = useStore((s) => s.words);
  const speakingUtterance = useStore((s) => s.speakingUtterance);
  const call = useStore((s) => (s.call?.status === "connected" ? s.call.suspectId : null));
  const receiver = useReceiver();
  const state = useStore.getState();
  useFrame(speakingUtterance !== null);

  if (!call) return null;
  const said: Caption | undefined = [...transcript].reverse().find((c) => c.speaker !== YOU && c.call === call);
  const asked: Caption | undefined = [...transcript].reverse().find((c) => c.speaker === YOU && c.call === call);
  const replyId = said ? Number(said.key.slice(1)) : NaN;
  const timed = said && speakingUtterance === replyId ? words[replyId] : undefined;
  const ms = timed ? actions.playedMs(replyId) : null;
  const count = timed && ms !== null ? wordsSaid(timed, ms) : null;
  const askedAfter = asked && said ? transcript.indexOf(asked) > transcript.indexOf(said) : !!asked;

  return (
    <div className="subtitles" style={box(layout.subtitles)} aria-live="polite">
      {(partial || askedAfter) && (
        <p className="sub-you">
          <b>You</b>
          {partial ? `${partial}…` : asked!.text}
        </p>
      )}
      {receiver.kind === "thinking" ? (
        <p className="sub-line thinking">
          <b>{nameOf(state, receiver.who)}</b>
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
        </p>
      ) : (
        said &&
        !askedAfter && (
          <p className="sub-line">
            <b>{nameOf(state, said.speaker)}</b>
            {timed && count !== null
              ? timed.map((w, i) => (
                  <span key={i} className={i < count ? "w said" : "w"}>
                    {shown(w.word)}{" "}
                  </span>
                ))
              : shown(said.text)}
            {said.interrupted && <span className="cut">— cut off</span>}
          </p>
        )
      )}
    </div>
  );
}

// ---- the switchboard -----------------------------------------------------------------

function SuspectCard({ index, layout }: { index: number; layout: Layout }) {
  const s = useStore((st) => st.case?.suspects[index]);
  const live = useStore((st) => st.call?.status === "connected" && st.call.suspectId === s?.id);
  const ringing = useStore((st) => st.dialing === s?.id);
  const thinking = useStore((st) => live && st.awaitingReply);
  const nerves = useStore((st) => (s ? (st.nerves[s.id] ?? 0) : 0));
  const called = useStore((st) => !!s && st.called.includes(s.id));
  const hungUp = useStore((st) => !!s && st.hungUpOn.includes(s.id));
  const clueCount = useStore((st) => st.clues.filter((c) => c.source === s?.id).length);
  const url = usePortraitUrl(s?.id ?? "");
  const rect = layout.cards[index];
  if (!s || !rect) return null;
  const lamp = live ? (thinking ? "thinking" : "live") : ringing ? "ringing" : hungUp ? "dead" : "off";
  const tag = hungUp ? "Hung up on you" : called ? null : "Not yet called";

  return (
    <button
      className={`scard${live ? " live" : ""}`}
      style={box(rect)}
      onClick={() => (live ? actions.hangup() : actions.dial(s.id))}
      aria-pressed={live}
      aria-label={`${live ? "Hang up on" : "Ring"} ${s.name}, ${s.role}, line ${s.line}. Nerves ${nerves} of ${NERVES_MAX}. ${clueCount} clues.${tag ? ` ${tag}.` : ""} Key ${index + 1}.`}
    >
      <span className={`lamp ${lamp}`} aria-hidden="true" />
      <kbd className="scard-key" aria-hidden="true">
        {index + 1}
      </kbd>
      <span className="scard-face" aria-hidden="true">
        {url && <img src={url} alt="" />}
      </span>
      <span className="scard-text" aria-hidden="true">
        <span className="scard-line">{s.line}</span>
        <span className="scard-name">{s.name}</span>
        <span className="scard-role">{s.role}</span>
        <span className="scard-meta">
          <span className="nerve-bar" style={{ ["--n" as string]: nerves / NERVES_MAX }}>
            <i />
          </span>
          {clueCount > 0 && (
            <span className="scard-clues">
              {clueCount} clue{clueCount === 1 ? "" : "s"}
            </span>
          )}
          {tag && <span className={`scard-tag${hungUp ? " red" : ""}`}>{tag}</span>}
        </span>
      </span>
    </button>
  );
}

function SuspectStrip({ layout }: { layout: Layout }) {
  const count = useStore((s) => s.case?.suspects.length ?? 0);
  return (
    <nav aria-label="Switchboard" className="strip">
      {Array.from({ length: count }, (_, i) => (
        <SuspectCard key={i} index={i} layout={layout} />
      ))}
    </nav>
  );
}

// ---- the receiver ----------------------------------------------------------------------

function receiverLabel(r: ReceiverState, name: (id: string) => string): { label: string; hint?: string } {
  switch (r.kind) {
    case "idle":
      return { label: "Ring a suspect", hint: "1–4" };
    case "ringing":
      return { label: `Ringing ${firstName(name(r.who))}…` };
    case "ready":
      return { label: "Hold to talk", hint: "Space" };
    case "listening":
      return { label: "Listening… let go to send" };
    case "thinking":
      return { label: `${firstName(name(r.who))} is thinking…` };
    case "speaking":
      return { label: "Hold to interrupt", hint: "Space" };
    case "type-only":
      return { label: "No microphone: type below", hint: "T" };
    case "out":
      return { label: "Over budget: hold to talk (-1★)", hint: "Space" };
  }
}

function ReceiverBar({ layout }: { layout: Layout }) {
  const r = useReceiver();
  const connected = useStore((s) => s.call?.status === "connected");
  const outOfQuestions = useStore((s) => !!s.case && s.questionsLeft === 0);
  const draftQuestion = useStore((s) => s.draftQuestion);
  const state = useStore.getState();
  const [text, setText] = useState("");
  const ring = useRef<HTMLSpanElement>(null);
  const canTalk = r.kind === "ready" || r.kind === "speaking" || r.kind === "listening" || r.kind === "out";
  const { label, hint } = receiverLabel(r, (id) => nameOf(state, id));

  useEffect(() => {
    if (draftQuestion) {
      setText(draftQuestion);
      useStore.getState().set({ draftQuestion: "" });
    }
  }, [draftQuestion]);

  // The ring around the button follows the real mic level while you talk.
  useEffect(() => {
    if (r.kind !== "listening") return;
    let raf = 0;
    const loop = () => {
      ring.current?.style.setProperty("--level", String(actions.micLevel()));
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      ring.current?.style.setProperty("--level", "0");
    };
  }, [r.kind]);

  return (
    <div className="receiver" style={box(layout.receiver)}>
      <div className="receiver-side">
        {connected && (
          <button className="btn-hangup" onClick={actions.hangup}>
            Hang up <kbd>Esc</kbd>
          </button>
        )}
      </div>
      <button
        className={`talk ${r.kind}`}
        disabled={!canTalk}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          actions.talkStart();
        }}
        onPointerUp={actions.talkEnd}
        onPointerCancel={actions.talkEnd}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
            e.preventDefault();
            e.stopPropagation();
            actions.talkStart();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            actions.talkEnd();
          }
        }}
        aria-label={label}
      >
        <span className="talk-ring" ref={ring} aria-hidden="true" />
        <span className="talk-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M7 3c1 0 2 2.5 2.5 4 .3 1-.7 1.6-1.4 2.2.9 2 2.6 3.8 4.7 4.7.6-.7 1.2-1.7 2.2-1.4 1.5.5 4 1.5 4 2.5 0 2-2 4-4 4C9 19 5 15 5 9c0-2 1-6 2-6z" />
          </svg>
        </span>
        <span className="talk-label">
          {label}
          {hint && <kbd>{hint}</kbd>}
        </span>
      </button>
      <form
        className="receiver-side ask"
        onSubmit={(e) => {
          e.preventDefault();
          if (actions.ask(text)) {
            setText("");
            // Hand Space back to talking; T jumps back into the box.
            (document.activeElement as HTMLElement | null)?.blur();
          }
        }}
      >
        <label className="sr-only" htmlFor="ask">
          Type a question
        </label>
        <input
          id="ask"
          value={text}
          maxLength={500}
          autoComplete="off"
          disabled={!connected}
          placeholder={connected ? (outOfQuestions ? "over budget (-1★): type question…" : "or type a question…") : "ring a suspect first"}
          onChange={(e) => {
            setText(e.target.value);
            actions.typeKey();
          }}
        />
        <kbd className="ask-key" aria-hidden="true">
          T
        </kbd>
      </form>
    </div>
  );
}

// ---- first-game coaching and help ------------------------------------------------------

function CoachMarks({ layout }: { layout: Layout }) {
  const step = useStore((s) => s.coach);
  const blocked = useStore((s) => s.accuseOpen || s.helpOpen || !!s.verdict);
  if (step === null || blocked) return null;
  const first = layout.cards[0];
  const marks = [
    { text: "Pick a suspect to ring. Click a card, or press 1–4.", at: { left: (first?.x ?? 0) + 8, top: layout.board.y - 132 }, arrow: "down" },
    { text: "Hold Space, or this button, and ask your question out loud. Let go to send.", at: { left: layout.receiver.x + layout.receiver.w / 2 - 170, top: layout.receiver.y - 150 }, arrow: "down" },
    {
      text: "Clues land in your notebook. When you know who did it, and can prove it: Accuse.",
      at: { left: Math.max(16, layout.width - 420), top: layout.topBar.h + 12 },
      arrow: "up",
    },
  ];
  const m = marks[step]!;
  return (
    <div className={`coach arrow-${m.arrow}`} style={m.at} role="status">
      <span className="coach-step">{step + 1} / 3</span>
      <p>{m.text}</p>
      <div className="coach-actions">
        {step === 2 && (
          <button className="btn-ghost" onClick={() => actions.coachDone(2)}>
            Got it
          </button>
        )}
        <button className="btn-ghost" onClick={actions.skipCoach}>
          Skip tips
        </button>
      </div>
    </div>
  );
}

function HelpOverlay() {
  const set = useStore((s) => s.set);
  const rows: [string, string][] = [
    ["Space (hold)", "Talk. Let go to send. Talking over a suspect interrupts them."],
    ["1 – 4", "Ring a suspect"],
    ["Esc", "Hang up, or leave the text box"],
    ["T", "Type a question instead"],
    ["N", "Open the notebook, then Tab to switch tabs"],
    ["A", "Accuse someone"],
    ["?", "Show these controls"],
    ["Nerves", "How rattled a suspect is. Pointed, evidence-backed questions raise it. From 5 their secrets can slip out; at 10 they hang up."],
  ];
  return (
    <div className="modal-back" onClick={(e) => e.target === e.currentTarget && set({ helpOpen: false })}>
      <section className="help" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <h2 id="help-title">Operator's card</h2>
        <dl>
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button className="btn-brass" onClick={() => set({ helpOpen: false })} autoFocus>
          Back to the board
        </button>
      </section>
    </div>
  );
}
