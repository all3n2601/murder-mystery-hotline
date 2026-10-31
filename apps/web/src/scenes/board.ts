// The playable exchange: the booth where the suspect on the line appears, and under it a brass
// rail with a jack per suspect card. A patch cord swings into the rail on connect and whips out
// on a hang-up. The cards themselves (names, lamps, nerves) are DOM, drawn over the rail.

import gsap from "gsap";
import { BlurFilter, Container, Graphics, Sprite } from "pixi.js";
import { backdrop, focals } from "../art/assets.js";
import { C, hex } from "../art/palette.js";
import type { Layout } from "../layout.js";
import { useStore, type Store } from "../state/store.js";
import { artSprite, Camera, glowTexture, type Scene } from "./common.js";
import { PortraitView } from "./portrait.js";

export class BoardScene implements Scene {
  root = new Container();
  private bg = new Camera();
  private shade = new Graphics();
  private booth = new Graphics();
  private boothLight = new Sprite(glowTexture());
  private portrait: PortraitView;
  private panel = new Graphics();
  private cords = new Graphics();
  private plug = { x: 0, y: 0 };
  private plugged: string | null = null;
  private flicker = 1;
  private layout: Layout | null = null;
  private unsub: (() => void) | null = null;

  constructor(private caseId: string) {
    this.portrait = new PortraitView(caseId);
    this.boothLight.anchor.set(0.5);
    this.boothLight.tint = hex(C.amber);
    this.boothLight.blendMode = "add";
    this.root.addChild(this.bg.view, this.shade, this.boothLight, this.booth, this.portrait.view, this.panel, this.cords);
  }

  async enter() {
    if (!this.bg.board.children.length) {
      const bg = artSprite(await backdrop.interior(this.caseId));
      bg.filters = [new BlurFilter({ strength: 5 })];
      this.bg.board.addChild(bg);
    }
    this.unsub = useStore.subscribe((s, prev) => this.onState(s, prev));
    this.onState(useStore.getState(), null);
  }

  exit() {
    this.unsub?.();
  }

  private jackFor(s: Store, id: string | null) {
    const index = s.case?.suspects.findIndex((x) => x.id === id) ?? -1;
    return index >= 0 ? this.layout?.jacks[index] : undefined;
  }

  private onState(s: Store, prev: Store | null) {
    const call = s.call?.status === "connected" ? s.call.suspectId : null;
    void this.portrait.show(call, call ? (s.nerves[call] ?? 0) : 0);
    if (!this.layout) return;
    const jack = this.jackFor(s, call);
    if (call && call !== this.plugged && jack) {
      this.plugged = call;
      gsap.to(this.plug, { x: jack.x, y: jack.y, duration: s.reducedMotion ? 0 : 0.55, ease: "back.out(1.3)" });
    }
    const wasConnected = prev?.call?.status === "connected" ? prev.call.suspectId : null;
    if (!call && this.plugged) {
      const yanked = s.call?.status === "ended" && s.call.reason === "suspect" && !!wasConnected;
      if (yanked) this.portrait.hangUp();
      this.plugged = null;
      const rest = this.layout.plugRest;
      gsap.to(this.plug, { x: rest.x, y: rest.y, duration: s.reducedMotion ? 0 : yanked ? 0.28 : 0.5, ease: yanked ? "power4.out" : "power2.inOut" });
    }
  }

  resize(l: Layout) {
    this.layout = l;
    const { stage, board, receiver } = l;
    this.shade
      .clear()
      .rect(0, 0, l.width, l.height)
      .fill({ color: hex(C.ink), alpha: 0.5 })
      .rect(stage.x, stage.y, stage.w, stage.h)
      .fill({ color: 0x000000, alpha: 0.15 });

    // Art Deco booth arch, sized to the portrait.
    const bw = Math.min(stage.w * 0.56, stage.h * 0.82),
      bx = stage.x + stage.w / 2 - bw / 2,
      by = stage.y + 12,
      bh = stage.h - 12;
    this.booth
      .clear()
      .moveTo(bx, by + bh)
      .lineTo(bx, by + bw / 2)
      .arc(bx + bw / 2, by + bw / 2, bw / 2, Math.PI, 0)
      .lineTo(bx + bw, by + bh)
      .stroke({ width: 3, color: hex(C.brass), alpha: 0.6 })
      .moveTo(bx + 10, by + bh)
      .lineTo(bx + 10, by + bw / 2)
      .arc(bx + bw / 2, by + bw / 2, bw / 2 - 10, Math.PI, 0)
      .lineTo(bx + bw - 10, by + bh)
      .stroke({ width: 1, color: hex(C.brass), alpha: 0.35 });
    for (let i = 1; i < 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      this.booth
        .moveTo(bx + bw / 2 + Math.cos(a) * (bw / 2 - 10), by + bw / 2 + Math.sin(a) * (bw / 2 - 10))
        .lineTo(bx + bw / 2 + Math.cos(a) * (bw / 2 - 36), by + bw / 2 + Math.sin(a) * (bw / 2 - 36))
        .stroke({ width: 2, color: hex(C.brass), alpha: 0.45 });
    }
    this.boothLight.position.set(stage.x + stage.w / 2 - bw * 0.12, stage.y + stage.h * 0.42);
    this.boothLight.scale.set(bw / 46);
    this.portrait.view.position.set(stage.x + stage.w / 2, stage.y + stage.h);
    this.portrait.setHeight(stage.h * 0.98);

    // The switchboard: a wooden ledge with a brass rail and a jack above each suspect card.
    const railY = l.jacks[0]?.y ?? board.y + 18;
    this.panel
      .clear()
      .rect(board.x, board.y, board.w, board.h + receiver.h)
      .fill(hex(C.wood))
      .rect(board.x, board.y, board.w, 5)
      .fill(hex(C.woodHi))
      .rect(board.x + 16, railY - 7, board.w - 32, 14)
      .fill(0x120c08)
      .rect(board.x + 16, railY - 7, board.w - 32, 2)
      .fill({ color: hex(C.brassHi), alpha: 0.6 })
      .rect(board.x + 16, railY + 5, board.w - 32, 2)
      .fill({ color: hex(C.brassLo), alpha: 0.9 });
    for (const j of l.jacks) this.panel.circle(j.x, j.y, 9).fill(hex(C.brass)).circle(j.x, j.y, 6).fill(hex(C.brassLo)).circle(j.x, j.y, 3).fill(0x000000);
    this.panel.circle(l.plugRest.x, l.plugRest.y - 30, 7).fill(hex(C.brassLo));

    // Re-seat the plug for the new layout.
    gsap.killTweensOf(this.plug);
    Object.assign(this.plug, this.jackFor(useStore.getState(), this.plugged) ?? l.plugRest);

    const { lamps } = focals();
    this.bg.frame(l.width, l.height, 1.1, lamps.x, lamps.y, 0.5);
  }

  update(dt: number, time: number) {
    if (!this.layout) return;
    const s = useStore.getState();
    const call = s.call?.status === "connected" ? s.call.suspectId : null;
    const nerves = call ? (s.nerves[call] ?? 0) : 0;
    const speaking = !!call && s.speaking === call;
    this.portrait.update(dt, time, speaking, nerves, s.reducedMotion);

    // Booth key light: warm while a line is open; it stutters while they think, and when they crack.
    const unsteady = !s.reducedMotion && ((s.awaitingReply && Math.random() < 0.08) || (nerves >= 8 && Math.random() < 0.06));
    this.flicker = unsteady ? 0.45 : Math.min(1, this.flicker + dt * 3);
    this.boothLight.alpha = (call ? 0.3 + (speaking ? 0.08 : 0) : 0.08) * this.flicker;

    this.drawCord();
  }

  private drawCord() {
    const l = this.layout!;
    const anchor = { x: l.plugRest.x, y: l.plugRest.y - 30 };
    const { x, y } = this.plug;
    const sag = Math.max(40, Math.abs(x - anchor.x) * 0.18 + 40);
    this.cords
      .clear()
      .moveTo(anchor.x, anchor.y)
      .bezierCurveTo(anchor.x, anchor.y + sag, x, y + sag, x, y + 20)
      .stroke({ width: 6, color: 0x0b0806 })
      .moveTo(anchor.x - 1.5, anchor.y)
      .bezierCurveTo(anchor.x - 1.5, anchor.y + sag, x - 1.5, y + sag, x - 1.5, y + 20)
      .stroke({ width: 1.2, color: hex(C.amber), alpha: 0.35 })
      .roundRect(x - 7, y - 2, 14, 24, 3)
      .fill(hex(C.brass))
      .rect(x - 8, y + 9, 16, 3)
      .fill(0x1b1209)
      .roundRect(x - 3, y - 12, 6, 12, 2)
      .fill(hex(C.brassHi));
  }
}
