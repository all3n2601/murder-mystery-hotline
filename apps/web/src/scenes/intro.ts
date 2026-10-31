// The entry storyboard: one shot per act of Mrs. Hale's narration (see intro/timeline.ts).
//   exterior: the exchange in the rain, pushing in on the lit window
//   victim:   Dot's photograph on the desk under the lamp
//   interior: her empty chair, then the patch cord when she says how Dot died
//   suspects: each suspect's portrait slides in as she names them (their card is DOM)
//   log:      the call log on the desk
//   board:    the switchboard lamps, pushing in until it goes black

import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { STARTING_EVIDENCE, type IntroShot } from "@mmh/protocol";
import { backdrop, callLog, dotPhoto, focals, isCodeDrawn, paintedLog, portrait } from "../art/assets.js";
import { INTERIOR_BOARD } from "../art/paint.js";
import { C, hex } from "../art/palette.js";
import { actAt, introClock, lineAt, logEntries } from "../intro/timeline.js";
import type { Layout } from "../layout.js";
import { useStore } from "../state/store.js";
import { artSprite, ART_H, ART_W, Camera, ease, glowTexture, lerp, Rain, type Scene } from "./common.js";

type Shot = IntroShot | "cord";
type ShotView = { camera: Camera; lamps: Sprite[] };

/** The intro starts as the case is requested; it needs the case, so wait (briefly) for it. */
async function caseLoaded() {
  for (let i = 0; i < 60 && !useStore.getState().case; i++) await new Promise((r) => setTimeout(r, 50));
}

export class IntroScene implements Scene {
  root = new Container();
  private shots = new Map<Shot, ShotView>();
  private rain = new Rain(240, 0.3);
  private black = new Graphics();
  private logHighlight = new Graphics();
  private logYs: number[] = [];
  private suspectLayer = new Container();
  private suspectSprites = new Map<string, Sprite>();
  private photo = new Sprite();
  private layout: Layout | null = null;
  private ready = false;
  private current: Shot | null = null;
  private previous: Shot | null = null;
  private cutAt = 0;

  constructor(private caseId: string) {}

  async enter() {
    if (this.ready) return;
    await caseLoaded();
    const caseState = useStore.getState().case;
    const [ext, int, cord, painted, dot] = await Promise.all([
      backdrop.exterior(this.caseId),
      backdrop.interior(this.caseId),
      backdrop.cord(this.caseId),
      paintedLog(this.caseId),
      dotPhoto(this.caseId),
    ]);
    const logText = caseState?.startingEvidence.find((c) => c.source === STARTING_EVIDENCE && /log/i.test(c.title))?.text ?? "";
    // The painted ledger looks better; the code-drawn page is kept only as a fallback (with highlights).
    const log = painted ? { texture: painted, ys: [] } : callLog(logEntries(logText));
    this.logYs = log.ys;
    const lampsOn = isCodeDrawn("bg-interior");

    const make = (shot: Shot, tex: Texture) => {
      const camera = new Camera();
      camera.board.addChild(artSprite(tex));
      camera.view.visible = false;
      this.root.addChild(camera.view);
      const view = { camera, lamps: [] as Sprite[] };
      this.shots.set(shot, view);
      return view;
    };
    make("exterior", ext);
    // Victim: the desk, darkened, with Dot's photograph propped under the lamp.
    const victim = make("victim", painted ?? int);
    victim.camera.board.addChild(new Graphics().rect(0, 0, ART_W, ART_H).fill({ color: 0x000000, alpha: 0.55 }));
    const glow = new Sprite(glowTexture());
    glow.anchor.set(0.5);
    glow.tint = hex(C.amber);
    glow.blendMode = "add";
    glow.position.set(ART_W * 0.5, ART_H * 0.42);
    glow.scale.set(9);
    glow.alpha = 0.22;
    this.photo.texture = dot;
    this.photo.anchor.set(0.5);
    this.photo.rotation = -0.06;
    this.photo.scale.set((ART_H * 0.62) / dot.height);
    this.photo.position.set(ART_W * 0.5, ART_H * 0.5);
    victim.camera.board.addChild(glow, this.photo);

    const interior = make("interior", int);
    make("cord", cord);
    const logView = make("log", log.texture);
    logView.camera.board.addChild(this.logHighlight);
    // Suspects: the room behind, dark and soft, so the portraits carry it.
    const suspects = make("suspects", int);
    suspects.camera.board.addChild(new Graphics().rect(0, 0, ART_W, ART_H).fill({ color: hex(C.ink), alpha: 0.78 }));
    suspects.camera.board.addChild(this.suspectLayer);
    for (const s of caseState?.suspects ?? []) {
      const sprite = new Sprite(await portrait(this.caseId, s.id, "calm"));
      sprite.anchor.set(0.5, 1);
      sprite.scale.set((ART_H * 0.92) / sprite.texture.height);
      sprite.alpha = 0;
      this.suspectLayer.addChild(sprite);
      this.suspectSprites.set(s.id, sprite);
    }
    const board = make("board", int);
    if (lampsOn) {
      for (const view of [interior, board]) {
        const b = INTERIOR_BOARD;
        for (let r = 0; r < b.rows; r++)
          for (let c = 0; c < b.cols; c++) {
            const s = new Sprite(glowTexture());
            s.anchor.set(0.5);
            s.tint = hex(C.amber);
            s.blendMode = "add";
            s.scale.set(0.42);
            s.position.set((b.x + ((c + 0.5) * b.w) / b.cols) * ART_W, (b.y + ((r + 0.5) * b.h) / b.rows) * ART_H - 16);
            s.alpha = 0;
            view.camera.board.addChild(s);
            view.lamps.push(s);
          }
      }
    }
    this.root.addChild(this.rain.view, this.black);
    this.ready = true;
    if (this.layout) this.resize(this.layout);
  }

  exit() {}

  resize(l: Layout) {
    this.layout = l;
    this.rain.resize(l.width, l.height);
    this.black.clear().rect(0, 0, l.width, l.height).fill(0x000000);
  }

  /** Which shot is on screen: the act's, except the scene act cuts to the cord on "Strangled". */
  private shotNow(ms: number): { shot: Shot; p: number } {
    const tl = introClock.timeline!;
    const { act, sinceMs, lengthMs } = actAt(tl, ms);
    let shot: Shot = act.shot;
    let p = sinceMs / lengthMs;
    if (act.shot === "interior") {
      const cordLine = tl.lines.find((l) => l.act === act.id && /strangled/i.test(l.text));
      if (cordLine && ms >= cordLine.startMs - 200) {
        shot = "cord";
        p = (ms - cordLine.startMs) / Math.max(1, act.startMs + lengthMs - cordLine.startMs);
      } else if (cordLine) p = sinceMs / Math.max(1, cordLine.startMs - act.startMs);
    }
    return { shot, p: Math.min(1, Math.max(0, p)) };
  }

  update(dt: number, time: number) {
    const tl = introClock.timeline;
    if (!this.ready || !this.layout || !tl) return;
    const ms = introClock.ms;
    const { shot, p } = this.shotNow(ms);
    if (shot !== this.current) {
      this.previous = this.current;
      this.current = shot;
      this.cutAt = time;
    }
    const fade = ease((time - this.cutAt) / 0.7);
    for (const [name, view] of this.shots) {
      const showing = name === shot || (name === this.previous && fade < 1);
      view.camera.view.visible = showing;
      if (!showing) continue;
      view.camera.view.alpha = name === shot ? (this.previous ? fade : 1) : 1;
      this.root.setChildIndex(view.camera.view, name === shot ? this.shots.size - 1 : this.shots.size - 2);
      this.frameShot(name, view, name === shot ? p : 1, time, ms);
    }
    this.rain.view.visible = shot === "exterior";
    this.rain.update(dt);
    // Fade up from black at the start; fade to black as the board push lands.
    const fadeIn = 1 - ease(ms / 1200);
    const fadeOut = shot === "board" ? ease((p - 0.7) / 0.3) : 0;
    this.black.alpha = Math.max(fadeIn, fadeOut);
  }

  private frameShot(shot: Shot, view: ShotView, p: number, time: number, ms: number) {
    const { width: W, height: H } = this.layout!;
    const cam = view.camera;
    const f = focals();
    switch (shot) {
      case "exterior":
        cam.frame(W, H, lerp(1.02, 1.3, ease(p)), f.litWindow.x, f.litWindow.y, ease(p));
        break;
      case "victim":
        cam.frame(W, H, lerp(1.0, 1.25, ease(p)), 0.5, 0.5, 1);
        this.photo.rotation = -0.06 + Math.sin(time * 0.3) * 0.005;
        break;
      case "interior":
        cam.frame(W, H, lerp(1.05, 1.35, ease(p)), f.chair.x, f.chair.y, ease(p));
        this.blink(view.lamps, time);
        break;
      case "cord":
        cam.frame(W, H, lerp(1.25, 1.1, ease(p)), f.cord.x, lerp(f.cord.y - 0.15, f.cord.y + 0.05, ease(p)), 1);
        break;
      case "suspects":
        cam.frame(W, H, 1.05, 0.5, 0.5, 0);
        this.stageSuspect(ms);
        break;
      case "log": {
        const n = this.logYs.length;
        if (!n) {
          cam.frame(W, H, lerp(1.15, 1.4, ease(p)), lerp(0.3, 0.55, ease(p)), 0.45, 1);
          break;
        }
        const i = Math.min(n - 1, Math.floor(p * n * 1.1));
        const y = this.logYs[i] ?? 0.5;
        cam.frame(W, H, 1.35, 0.5, lerp(0.3, y, 0.8), 1);
        this.logHighlight
          .clear()
          .roundRect(ART_W * 0.27, y * ART_H - 42, ART_W * 0.47, 64, 8)
          .fill({ color: hex(C.amber), alpha: 0.22 + 0.06 * Math.sin(time * 6) });
        break;
      }
      case "board":
        cam.frame(W, H, lerp(1.6, 3.6, ease(p)), f.lamps.x, f.lamps.y + 0.03, 1);
        view.lamps.forEach((s, i) => (s.alpha = 0.8 + 0.2 * Math.sin(time * 9 + i)));
        break;
    }
  }

  /** The suspect being named slides in from the right; the last one slides out to the left. */
  private stageSuspect(ms: number) {
    const tl = introClock.timeline!;
    const line = lineAt(tl, ms);
    const named = line?.suspect ?? null;
    for (const [id, sprite] of this.suspectSprites) {
      const l = tl.lines.find((x) => x.suspect === id);
      if (!l) continue;
      const since = (ms - l.startMs) / 600;
      const on = id === named;
      const target = on ? 0.62 : since > 0 ? 0.3 : 0.9;
      sprite.x += (target * ART_W - sprite.x) * 0.12;
      sprite.y = ART_H * 1.02;
      sprite.alpha += ((on ? 1 : 0) - sprite.alpha) * 0.14;
    }
  }

  private blink(lamps: Sprite[], time: number) {
    lamps.forEach((s, i) => {
      const phase = Math.sin(time * (0.7 + (i % 7) * 0.13) + i * 2.1);
      s.alpha = phase > 0.64 ? 0.85 : Math.max(0, s.alpha - 0.05);
    });
  }
}
