// Owns the Pixi application. Follows the store's screen, cross-fades between scenes, and
// runs the film-grain pass over everything.

// The server's CSP forbids eval; this swaps Pixi's generated shader code for eval-free versions.
import "pixi.js/unsafe-eval";
import { Application, Graphics } from "pixi.js";
import { OldFilmFilter } from "pixi-filters";
import { loadManifest } from "../art/assets.js";
import { C, hex } from "../art/palette.js";
import { computeLayout } from "../layout.js";
import { useStore, type Screen } from "../state/store.js";
import { BoardScene } from "./board.js";
import type { Scene } from "./common.js";
import { IntroScene } from "./intro.js";
import { TitleScene } from "./title.js";

export async function createDirector(host: HTMLElement, caseId: string) {
  await loadManifest(caseId);
  await document.fonts?.load("40px Limelight").catch(() => {});
  await document.fonts?.load('30px "Special Elite"').catch(() => {});

  const app = new Application();
  await app.init({
    resizeTo: window,
    background: hex(C.ink),
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  app.canvas.setAttribute("aria-hidden", "true");
  host.appendChild(app.canvas);

  const film = new OldFilmFilter({ sepia: 0, noise: 0.07, noiseSize: 1, scratch: 0, scratchDensity: 0, vignetting: 0.3, vignettingAlpha: 0.7, vignettingBlur: 0.35 });
  app.stage.filters = [film];

  const scenes: Record<Screen, Scene> = {
    title: new TitleScene(caseId),
    intro: new IntroScene(caseId),
    game: new BoardScene(caseId),
  };
  const fader = new Graphics();
  let current: Scene | null = null;
  let fade = 0; // 1 = fully black

  const layout = () => computeLayout(window.innerWidth, window.innerHeight, useStore.getState().case?.suspects.length ?? 4);

  async function show(screen: Screen) {
    const next = scenes[screen];
    if (next === current) return;
    fade = 1;
    current?.exit();
    if (current) app.stage.removeChild(current.root);
    current = next;
    app.stage.addChildAt(next.root, 0);
    await next.enter();
    next.resize(layout());
  }

  function resize() {
    const l = layout();
    current?.resize(l);
    fader.clear().rect(0, 0, l.width, l.height).fill(0x000000);
  }

  app.stage.addChild(fader);
  window.addEventListener("resize", resize);
  // Suspect count can change the jack row once the case arrives.
  const unsubscribe = useStore.subscribe((s, prev) => {
    if (s.screen !== prev.screen) void show(s.screen);
    if (s.case !== prev.case) resize();
  });
  await show(useStore.getState().screen);
  resize();

  let time = 0;
  app.ticker.add((ticker) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    time += dt;
    film.seed = Math.random();
    current?.update(dt, time);
    fade = Math.max(0, fade - dt * 1.6);
    fader.alpha = fade;
  });

  return () => {
    unsubscribe();
    current?.exit();
    window.removeEventListener("resize", resize);
    app.destroy(true, { children: true });
  };
}
