// Pieces every scene shares: a cover-fit camera over 1920x1080 artwork, rain, soft glows.

import { Container, Sprite, Texture } from "pixi.js";
import type { Layout } from "../layout.js";

export const ART_W = 1920;
export const ART_H = 1080;

export interface Scene {
  root: Container;
  enter(): void | Promise<void>;
  exit(): void;
  update(dt: number, time: number): void;
  resize(layout: Layout): void;
}

/** A 1920x1080 artboard shown cover-fit, with zoom and a focal point to push in on. */
export class Camera {
  readonly view = new Container();
  readonly board = new Container();
  constructor() {
    this.view.addChild(this.board);
  }
  /** zoom >= 1; focal in 0..1 artboard space; p blends from centre (0) to focal (1). */
  frame(screenW: number, screenH: number, zoom: number, fx: number, fy: number, p = 1, ox = 0, oy = 0, ow = screenW, oh = screenH) {
    const s = Math.max(ow / ART_W, oh / ART_H) * zoom;
    const halfW = ow / (2 * s),
      halfH = oh / (2 * s);
    const px = clamp(lerp(ART_W / 2, fx * ART_W, p), halfW, ART_W - halfW);
    const py = clamp(lerp(ART_H / 2, fy * ART_H, p), halfH, ART_H - halfH);
    this.board.scale.set(s);
    this.board.pivot.set(px, py);
    this.board.position.set(ox + ow / 2, oy + oh / 2);
  }
}

export function artSprite(texture: Texture) {
  const s = new Sprite(texture);
  s.width = ART_W;
  s.height = ART_H;
  return s;
}

let glowTex: Texture | null = null;
/** A soft radial glow, white so it can be tinted. */
export function glowTexture(): Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = Texture.from(c);
  return glowTex;
}

let streakTex: Texture | null = null;
function streakTexture(): Texture {
  if (streakTex) return streakTex;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(200,215,240,0)");
  g.addColorStop(1, "rgba(200,215,240,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(1, 0, 2, 64);
  streakTex = Texture.from(c);
  return streakTex;
}

/** Slanted rain streaks in screen space. */
export class Rain {
  readonly view = new Container();
  private drops: { s: Sprite; v: number }[] = [];
  private w = 0;
  private h = 0;
  constructor(count = 220, private alpha = 0.35) {
    for (let i = 0; i < count; i++) {
      const s = new Sprite(streakTexture());
      s.rotation = 0.18;
      this.view.addChild(s);
      this.drops.push({ s, v: 0 });
    }
  }
  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    for (const d of this.drops) this.reset(d, true);
  }
  private reset(d: { s: Sprite; v: number }, anywhere: boolean) {
    const depth = Math.random();
    d.v = 900 + depth * 900;
    d.s.alpha = this.alpha * (0.3 + depth * 0.7);
    d.s.scale.set(0.6 + depth * 0.8, 0.5 + depth);
    d.s.x = Math.random() * (this.w + 200);
    d.s.y = anywhere ? Math.random() * this.h : -80;
  }
  update(dt: number) {
    for (const d of this.drops) {
      d.s.y += d.v * dt;
      d.s.x -= d.v * dt * 0.18;
      if (d.s.y > this.h) this.reset(d, false);
    }
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
export const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
