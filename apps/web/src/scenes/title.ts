// Title card: the exchange at night in the rain, the lit window breathing, the odd flash.

import { Container, Graphics, Sprite } from "pixi.js";
import { backdrop, focals } from "../art/assets.js";
import { C, hex } from "../art/palette.js";
import type { Layout } from "../layout.js";
import { artSprite, Camera, glowTexture, Rain, type Scene } from "./common.js";

export class TitleScene implements Scene {
  root = new Container();
  private camera = new Camera();
  private rain = new Rain(260, 0.4);
  private flash = new Graphics();
  private windowGlow = new Sprite(glowTexture());
  private layout: Layout | null = null;
  private nextFlash = 4;

  constructor(private caseId: string) {
    this.root.addChild(this.camera.view, this.rain.view, this.flash);
  }

  async enter() {
    if (this.camera.board.children.length) return;
    this.camera.board.addChild(artSprite(await backdrop.exterior(this.caseId)));
    this.windowGlow.anchor.set(0.5);
    this.windowGlow.tint = hex(C.amber);
    this.windowGlow.blendMode = "add";
    const { litWindow } = focals();
    this.windowGlow.position.set(litWindow.x * 1920, litWindow.y * 1080);
    this.windowGlow.scale.set(4);
    this.camera.board.addChild(this.windowGlow);
  }

  exit() {}

  resize(l: Layout) {
    this.layout = l;
    this.rain.resize(l.width, l.height);
    this.flash.clear().rect(0, 0, l.width, l.height).fill(0xdfe8ff);
    this.flash.alpha = 0;
  }

  update(dt: number, time: number) {
    if (!this.layout) return;
    const zoom = 1.04 + 0.03 * Math.sin(time * 0.08);
    const { litWindow } = focals();
    this.camera.frame(this.layout.width, this.layout.height, zoom, litWindow.x, litWindow.y, 0.4);
    this.windowGlow.alpha = 0.18 + 0.06 * Math.sin(time * 1.3) + (Math.random() < 0.02 ? -0.1 : 0);
    this.rain.update(dt);
    // Distant lightning: a double flicker every so often.
    this.nextFlash -= dt;
    if (this.nextFlash < 0) {
      this.flash.alpha = 0.22;
      this.nextFlash = 7 + Math.random() * 9;
    } else this.flash.alpha = Math.max(0, this.flash.alpha - dt * (this.flash.alpha > 0.1 ? 2.5 : 0.9));
  }
}
