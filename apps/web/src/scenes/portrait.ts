// A suspect on the line: breathing, a bob and brighter key light while speaking, a crossfade
// when nerves cross a threshold, jitter at 8+, snap to black when they hang up. No lip-sync.

import { Container, Sprite, Texture } from "pixi.js";
import { moodFor, portrait } from "../art/assets.js";
import type { Mood } from "../art/paint.js";
import { C, hex } from "../art/palette.js";

export class PortraitView {
  readonly view = new Container();
  private body = new Container();
  private current = new Sprite();
  private incoming = new Sprite();
  private key = new Sprite(); // additive amber copy for the speaking light
  private suspect: string | null = null;
  private mood: Mood | null = null;
  private fade = 1;
  private speakAmt = 0;
  private blackout = 0;
  private height = 400;
  private token = 0;

  constructor(private caseId: string) {
    for (const s of [this.current, this.incoming, this.key]) s.anchor.set(0.5, 1);
    this.key.blendMode = "add";
    this.key.tint = hex(C.amber);
    this.body.addChild(this.current, this.incoming, this.key);
    this.view.addChild(this.body);
    this.view.alpha = 0;
  }

  setHeight(h: number) {
    this.height = h;
    this.fit();
  }

  private fit() {
    for (const s of [this.current, this.incoming, this.key]) {
      if (!s.texture || s.texture === Texture.EMPTY) continue;
      s.scale.set(this.height / s.texture.height);
    }
  }

  /** Show a suspect (or nobody) at a nerves level. Loads textures as needed. */
  async show(suspectId: string | null, nerves: number) {
    const mood = moodFor(nerves);
    if (suspectId === this.suspect && mood === this.mood) return;
    const token = ++this.token;
    if (!suspectId) {
      this.suspect = null;
      this.mood = null;
      return;
    }
    const tex = await portrait(this.caseId, suspectId, mood);
    if (token !== this.token) return;
    const sameSuspect = suspectId === this.suspect;
    this.suspect = suspectId;
    this.mood = mood;
    this.blackout = 0;
    if (sameSuspect) {
      // Crossfade into the new expression.
      this.incoming.texture = tex;
      this.incoming.alpha = 0;
      this.fade = 0;
    } else {
      this.current.texture = tex;
      this.incoming.alpha = 0;
      this.fade = 1;
    }
    this.key.texture = tex;
    this.fit();
  }

  /** The suspect slammed the phone down. */
  hangUp() {
    this.blackout = 0.0001;
  }

  update(dt: number, time: number, speaking: boolean, nerves: number, reducedMotion: boolean) {
    const target = this.suspect ? 1 : 0;
    this.view.alpha += (target - this.view.alpha) * Math.min(1, dt * 5);

    if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt * 2.2);
      this.incoming.alpha = this.fade;
      if (this.fade >= 1) {
        this.current.texture = this.incoming.texture;
        this.incoming.alpha = 0;
      }
    }

    this.speakAmt += ((speaking ? 1 : 0) - this.speakAmt) * Math.min(1, dt * 8);
    this.key.alpha = 0.06 + this.speakAmt * 0.12;

    if (reducedMotion) {
      this.body.scale.set(1);
      this.body.position.set(0, 0);
    } else {
      const breath = Math.sin(time * 1.7) * 0.006;
      this.body.scale.set(1 + breath * 0.3, 1 + breath);
      const bob = Math.sin(time * 8.5) * 3 * this.speakAmt + Math.sin(time * 3.1) * 1.2 * this.speakAmt;
      const jitter = nerves >= 8 ? (Math.random() - 0.5) * 3 : 0;
      this.body.position.set(jitter, -bob);
    }

    if (this.blackout > 0) {
      this.blackout += dt;
      const k = Math.min(1, this.blackout / 0.15);
      const g = Math.round(255 * (1 - k));
      this.current.tint = (g << 16) | (g << 8) | g;
      this.key.alpha = 0;
      if (this.blackout > 0.6) {
        this.suspect = null;
        this.mood = null;
        this.blackout = 0;
      }
    } else this.current.tint = 0xffffff;
  }
}
