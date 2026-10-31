import { useState } from "react";
import { actions, introSeen } from "../controller.js";
import { useStore } from "../state/store.js";

/** A candlestick telephone, drawn in SVG so it stays crisp. */
export function Phone({ ringing }: { ringing: boolean }) {
  return (
    <svg className={`phone${ringing ? " ringing" : ""}`} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="brass" x1="0" x2="1">
          <stop offset="0" stopColor="#5e4515" />
          <stop offset="0.4" stopColor="#f0d58c" />
          <stop offset="1" stopColor="#5e4515" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="30" ry="7" fill="#05070b" />
      <path d="M38 106 Q60 96 82 106 L78 100 Q60 92 42 100 Z" fill="url(#brass)" />
      <rect x="55" y="40" width="10" height="60" rx="3" fill="url(#brass)" />
      <path d="M44 28 Q60 18 76 28 L72 40 Q60 34 48 40 Z" fill="url(#brass)" />
      <circle cx="60" cy="27" r="9" fill="#0a0e16" stroke="#c9a24a" strokeWidth="2" />
      <path d="M88 44 q14 -6 14 10 v20 q0 10 -10 8" fill="none" stroke="#0b0806" strokeWidth="4" />
      <rect x="84" y="30" width="10" height="34" rx="4" fill="#0b0806" stroke="#c9a24a" strokeWidth="1.5" />
      <ellipse cx="89" cy="30" rx="9" ry="5" fill="url(#brass)" />
    </svg>
  );
}

export function TitleScreen() {
  const resumed = useStore((s) => s.resumed && !!s.case);
  const link = useStore((s) => s.link);
  const [busy, setBusy] = useState(false);
  const seen = introSeen();

  const go = async (skipIntro: boolean) => {
    setBusy(true);
    try {
      await actions.pickUp({ skipIntro });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="title">
      <div className="title-inner">
        <Phone ringing={!busy} />
        <div className="title-kicker">MAdison Exchange · 2:10 a.m. · 1947</div>
        <h1>
          Murder Mystery
          <span>HOTLINE</span>
        </h1>
        <p className="title-case">Case No. 1: The Night Operator</p>
        <div className="title-actions">
          <button className="btn-brass" onClick={() => go(false)} disabled={busy || link === "offline"} autoFocus>
            {resumed ? "Pick the line back up" : "Pick up the receiver"}
          </button>
          {seen && !resumed && (
            <button className="btn-ghost" onClick={() => go(true)} disabled={busy || link === "offline"}>
              Straight to the switchboard
            </button>
          )}
        </div>
        <p className="title-hint">
          Headphones recommended. Hold <kbd>Space</kbd> to talk, or type your questions.
        </p>
        {link === "offline" && (
          <p className="slip" role="alert">
            The exchange isn't answering. <button onClick={actions.retryLine}>Ring again</button>
          </p>
        )}
      </div>
    </main>
  );
}
