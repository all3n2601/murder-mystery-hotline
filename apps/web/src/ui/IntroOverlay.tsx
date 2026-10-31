// Plays Mrs. Hale's spliced narration (or estimates its timing), advances the shared intro
// clock for the Pixi storyboard, and draws the DOM half of each act: word-synced captions, the
// suspect cards in the line-up, and the leads at the end. Next ▸ jumps an act; Skip ends it.

import { useEffect, useMemo, useRef, useState } from "react";
import { hasIntroAudio } from "../art/assets.js";
import type { Underscore } from "../audio/underscore.js";
import { wordsSaid } from "../audio/words.js";
import { actions, CASE_ID } from "../controller.js";
import { actAt, estimateTimeline, fromNarration, introClock, lineAt, type RenderedNarration, type Timeline } from "../intro/timeline.js";
import { useStore } from "../state/store.js";
import { usePortraitUrl } from "./hooks.js";

async function loadNarrationJson(): Promise<RenderedNarration | null> {
  try {
    const res = await fetch(`/cases/${CASE_ID}/intro/narration.json`);
    return res.ok ? ((await res.json()) as RenderedNarration) : null;
  } catch {
    return null;
  }
}

type Player = { ms: () => number; seek: (ms: number) => void; stop: () => void };

/** A clock that follows the narration audio, with a wall-clock fallback if the audio stalls. */
function audioPlayer(buffer: AudioBuffer, audio: NonNullable<ReturnType<typeof actions.audio>>): Player {
  let play = audio.playNarration(buffer, 0);
  let wall: { from: number; at: number } | null = null;
  let last = { ms: -1, at: performance.now() };
  return {
    ms() {
      if (wall) return wall.from + performance.now() - wall.at;
      const ms = play.time() * 1000;
      const now = performance.now();
      if (ms !== last.ms) last = { ms, at: now };
      else if (now - last.at > 1200) {
        // A wedged audio device can freeze the context's clock while it claims to run.
        play.stop();
        wall = { from: ms, at: now };
      }
      return ms;
    },
    seek(ms) {
      if (wall) return void (wall = { from: ms, at: performance.now() });
      play.stop();
      play = audio.playNarration(buffer, ms / 1000);
    },
    stop: () => play.stop(),
  };
}

function wallPlayer(): Player {
  let from = 0;
  let at = performance.now();
  return { ms: () => from + performance.now() - at, seek: (ms) => ((from = ms), (at = performance.now())), stop: () => {} };
}

function SuspectCard({ id }: { id: string }) {
  const s = useStore((st) => st.case?.suspects.find((x) => x.id === id));
  const url = usePortraitUrl(id);
  if (!s) return null;
  return (
    <aside className="lineup-card" key={id}>
      {url && <img src={url} alt="" />}
      <div>
        <span className="lineup-line">{s.line}</span>
        <h2>{s.name}</h2>
        <p className="lineup-role">{s.role}</p>
        {s.hook && <p className="lineup-hook">{s.hook}</p>}
      </div>
    </aside>
  );
}

function Leads() {
  // Fallbacks outside the selector: a fresh [] inside it would re-render forever.
  const leads = useStore((s) => s.case?.leads) ?? [];
  const suspects = useStore((s) => s.case?.suspects) ?? [];
  return (
    <section className="intro-leads" aria-label="Leads">
      <h2>Things that don't add up</h2>
      <ol>
        {leads.map((l, i) => (
          <li key={i} style={{ animationDelay: `${0.15 + i * 0.35}s` }}>
            <b>{suspects.find((s) => s.id === l.suspect)?.name}</b>
            {l.text}
          </li>
        ))}
      </ol>
      <p className="intro-leads-note">Pinned in your notebook.</p>
    </section>
  );
}

export function IntroOverlay() {
  const intro = useStore((s) => s.case?.intro);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [ms, setMs] = useState(0);
  const player = useRef<Player | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!intro) return;
    let cancelled = false;
    let raf = 0;
    let music: Underscore | null = null;
    let lastAct = -1;

    void (async () => {
      const audio = actions.audio();
      let tl: Timeline | null = null;
      let p: Player | null = null;
      // A suspended context (autoplay blocked) would freeze the clock; captions-only is better.
      if (audio && audio.ctx.state === "running" && hasIntroAudio()) {
        const loaded = Promise.all([audio.loadNarration(`/cases/${CASE_ID}/intro/narration.wav`), loadNarrationJson()]);
        const timeout = new Promise<[null, null]>((r) => setTimeout(() => r([null, null]), 4000));
        const [buffer, json] = await Promise.race([loaded, timeout]);
        if (cancelled) return;
        if (buffer && json) {
          tl = fromNarration(intro, json);
          p = audioPlayer(buffer, audio);
        }
      }
      tl ??= estimateTimeline(intro);
      p ??= wallPlayer();
      player.current = p;
      introClock.timeline = tl;
      music = audio?.underscore() ?? null;
      setTimeline(tl);
      const tick = () => {
        const now = p!.ms();
        introClock.ms = now;
        setMs(now);
        const { index, act } = actAt(tl!, now);
        if (index !== lastAct) {
          lastAct = index;
          music?.pulse();
          music?.swell(act.shot === "suspects");
          if (act.shot === "board") music?.stop(tl!.durationMs / 1000 - now / 1000);
        }
        if (now >= tl!.durationMs) return finish();
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      player.current?.stop();
      music?.stop(0.8);
      introClock.timeline = null;
      introClock.ms = 0;
    };
  }, [intro]);

  function finish() {
    if (done.current) return;
    done.current = true;
    actions.enterGame();
  }

  function next() {
    const tl = introClock.timeline;
    if (!tl || !player.current) return;
    const { index } = actAt(tl, introClock.ms);
    const nextAct = tl.acts[index + 1];
    if (nextAct) player.current.seek(nextAct.startMs);
    else finish();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") finish();
      if (e.code === "ArrowRight" || e.code === "Enter") (e.preventDefault(), next());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const view = useMemo(() => {
    if (!timeline) return null;
    const { act, index } = actAt(timeline, ms);
    const line = lineAt(timeline, ms);
    const words = line ? timeline.words.filter((w) => w.start >= line.startMs - 1 && w.end <= line.endMs + 1) : [];
    return { act, index, line, words, said: wordsSaid(words, ms) };
  }, [timeline, ms]);

  const total = timeline?.acts.length ?? 0;
  return (
    <div className="intro">
      <div className="intro-controls">
        {total > 0 && (
          <span className="intro-progress" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <i key={i} className={i <= (view?.index ?? 0) ? "on" : ""} />
            ))}
          </span>
        )}
        <button className="btn-ghost" onClick={next}>
          Next ▸ <kbd>→</kbd>
        </button>
        <button className="btn-ghost" onClick={finish}>
          Skip <kbd>Esc</kbd>
        </button>
      </div>
      {view?.act.shot === "suspects" && view.line?.suspect && <SuspectCard id={view.line.suspect} />}
      {view?.act.shot === "board" && <Leads />}
      <p className="intro-captions" aria-live="polite">
        {/* In the line-up the card already shows what she's saying, so no caption. */}
        {view?.line && view.said > 0 && !view.line.suspect && (
          <>
            <span className="intro-speaker">MRS. HALE</span>
            {view.words.map((w, i) => (
              <span key={i} className={`w${i < view.said ? " said" : ""}`}>
                {w.word}{" "}
              </span>
            ))}
          </>
        )}
      </p>
    </div>
  );
}
