// Code-drawn stand-ins for the painted art (see cases/night-operator/art/PROMPTS.md).
// Canvas 2D gives real gradients, blur and soft light; Pixi turns each canvas into a texture.

import { C } from "./palette.js";

export type Mood = "calm" | "uneasy" | "cracking";

function canvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  const ctx = el.getContext("2d")!;
  return { el, ctx };
}

const rand = (() => {
  let seed = 7;
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
})();

/** Gouache speckle and paper tooth over everything already drawn. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.06) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (rand() - 0.5) * 255 * amount;
    d[i] = d[i]! + n;
    d[i + 1] = d[i + 1]! + n;
    d[i + 2] = d[i + 2]! + n;
  }
  ctx.putImageData(img, 0, 0);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function withAlpha(hex: string, a: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.7) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---- backdrops ---------------------------------------------------------------------

/** The exchange at 2 a.m.: one lit window, rain-slick street, the hotel sign across the way. */
export function paintExterior(w = 1920, h = 1080) {
  const { el, ctx } = canvas(w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, "#05070c");
  sky.addColorStop(1, C.ink3);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Distant skyline.
  ctx.fillStyle = "#0d1320";
  for (let x = -40; x < w; x += 90 + rand() * 120) {
    const bh = 180 + rand() * 260;
    ctx.fillRect(x, h * 0.62 - bh, 70 + rand() * 110, bh);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = withAlpha(C.amber, 0.15 + rand() * 0.25);
    ctx.fillRect(rand() * w, h * 0.3 + rand() * h * 0.3, 4, 6);
  }

  // The exchange building.
  const bx = w * 0.3,
    bw = w * 0.42,
    by = h * 0.12,
    bh = h * 0.6;
  const facade = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  facade.addColorStop(0, "#3a2219");
  facade.addColorStop(0.5, "#24150f");
  facade.addColorStop(1, "#150c09");
  ctx.fillStyle = facade;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  for (let y = by; y < by + bh; y += 14) {
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.lineTo(bx + bw, y);
    ctx.stroke();
  }
  // Cornice.
  ctx.fillStyle = "#4a2d20";
  ctx.fillRect(bx - 20, by - 24, bw + 40, 30);
  ctx.fillStyle = C.brassLo;
  ctx.fillRect(bx - 20, by + 6, bw + 40, 4);

  // Windows: one lit on the second floor.
  const cols = 6,
    rows = 4;
  const ww = bw / cols - 36,
    wh = bh / rows - 60;
  const lit = { c: 3, r: 1 };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = bx + 18 + c * (bw / cols),
        y = by + 40 + r * (bh / rows);
      const isLit = c === lit.c && r === lit.r;
      const g = ctx.createLinearGradient(x, y, x, y + wh);
      if (isLit) {
        g.addColorStop(0, C.amberHi);
        g.addColorStop(1, C.amber);
      } else {
        g.addColorStop(0, "#1b2740");
        g.addColorStop(1, "#0b111d");
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, ww, wh);
      ctx.strokeStyle = "#120a07";
      ctx.lineWidth = 5;
      ctx.strokeRect(x, y, ww, wh);
      ctx.beginPath();
      ctx.moveTo(x + ww / 2, y);
      ctx.lineTo(x + ww / 2, y + wh);
      ctx.moveTo(x, y + wh / 2);
      ctx.lineTo(x + ww, y + wh / 2);
      ctx.stroke();
      if (isLit) {
        glow(ctx, x + ww / 2, y + wh / 2, 260, C.amber, 0.35);
        // A slumped shape at the board, seen through the glass.
        ctx.fillStyle = "rgba(40,20,8,0.85)";
        ctx.beginPath();
        ctx.ellipse(x + ww * 0.35, y + wh * 0.72, ww * 0.16, wh * 0.14, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

  // Door and steps.
  ctx.fillStyle = "#0b0705";
  ctx.fillRect(bx + bw / 2 - 60, by + bh - 150, 120, 150);
  glow(ctx, bx + bw / 2, by + bh - 170, 70, C.amber, 0.3);

  // Hotel neon across the street.
  ctx.save();
  ctx.translate(w * 0.1, h * 0.2);
  ctx.fillStyle = "#14090b";
  ctx.fillRect(-30, -20, 120, 520);
  ctx.font = `${Math.round(h * 0.045)}px Limelight, Georgia, serif`;
  ctx.shadowColor = C.red;
  ctx.shadowBlur = 40;
  ctx.fillStyle = "#ff6a5a";
  "MARLOWE".split("").forEach((ch, i) => ctx.fillText(ch, 30, 40 + i * 64));
  ctx.restore();
  glow(ctx, w * 0.12, h * 0.42, 340, C.red, 0.18);

  // Street lamp.
  const lx = w * 0.82;
  ctx.fillStyle = "#06080c";
  ctx.fillRect(lx - 6, h * 0.25, 12, h * 0.5);
  ctx.fillRect(lx - 40, h * 0.25, 80, 10);
  glow(ctx, lx, h * 0.27, 300, C.amberHi, 0.4);
  const cone = ctx.createLinearGradient(lx, h * 0.27, lx, h * 0.78);
  cone.addColorStop(0, withAlpha(C.amberHi, 0.25));
  cone.addColorStop(1, withAlpha(C.amberHi, 0));
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(lx - 20, h * 0.27);
  ctx.lineTo(lx + 20, h * 0.27);
  ctx.lineTo(lx + 220, h * 0.78);
  ctx.lineTo(lx - 220, h * 0.78);
  ctx.fill();

  // Wet street and reflections.
  const street = ctx.createLinearGradient(0, h * 0.72, 0, h);
  street.addColorStop(0, "#0c121d");
  street.addColorStop(1, "#05070b");
  ctx.fillStyle = street;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.fillStyle = "#1a1410";
  ctx.fillRect(0, h * 0.72, w, 10);
  for (const [x, color, a] of [
    [bx + 18 + lit.c * (bw / cols) + ww / 2, C.amber, 0.45],
    [lx, C.amberHi, 0.4],
    [w * 0.12, "#ff6a5a", 0.3],
  ] as const) {
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = withAlpha(color, a * (1 - i / 26));
      const y = h * 0.74 + i * 10;
      ctx.fillRect(x - 30 + (rand() - 0.5) * 30, y, 60 - i, 4);
    }
  }
  // Fog.
  const fog = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.8);
  fog.addColorStop(0, "rgba(127,142,166,0)");
  fog.addColorStop(1, "rgba(127,142,166,0.10)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.5, w, h * 0.3);
  vignette(ctx, w, h, 0.8);
  grain(ctx, w, h, 0.05);
  return el;
}

/** Where the lamps sit on the interior board, as fractions of the canvas, for Pixi to blink. */
export const INTERIOR_BOARD = { x: 0.08, y: 0.28, w: 0.84, h: 0.34, cols: 22, rows: 5 };

/** The switchboard room: rows of jacks, Dot's chair pushed back, rain on the window. */
export function paintInterior(w = 1920, h = 1080) {
  const { el, ctx } = canvas(w, h);
  const wall = ctx.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, "#0b101a");
  wall.addColorStop(1, "#06080d");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);

  // Window, upper right, with blue streetlight.
  const wx = w * 0.78,
    wy = h * 0.04,
    ww = w * 0.16,
    wh = h * 0.2;
  const win = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  win.addColorStop(0, "#1b2a45");
  win.addColorStop(1, "#0c1424");
  ctx.fillStyle = win;
  ctx.fillRect(wx, wy, ww, wh);
  ctx.strokeStyle = "#05070b";
  ctx.lineWidth = 8;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy);
  ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.stroke();
  glow(ctx, wx + ww / 2, wy + wh, 360, "#3d5a8a", 0.25);

  // The board: wooden cabinet, brass-edged jack field.
  const b = INTERIOR_BOARD;
  const bx = w * b.x,
    by = h * b.y,
    bw = w * b.w,
    bh = h * b.h;
  const wood = ctx.createLinearGradient(0, by - 60, 0, h);
  wood.addColorStop(0, C.woodHi);
  wood.addColorStop(1, C.wood);
  ctx.fillStyle = wood;
  ctx.fillRect(bx - 40, by - 60, bw + 80, h - by + 60);
  ctx.fillStyle = "#120c08";
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = C.brass;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx, by, bw, bh);
  for (let r = 0; r < b.rows; r++)
    for (let c = 0; c < b.cols; c++) {
      const x = bx + (c + 0.5) * (bw / b.cols),
        y = by + (r + 0.5) * (bh / b.rows);
      ctx.fillStyle = "#2a1f12"; // lamp socket (Pixi lights it)
      ctx.beginPath();
      ctx.arc(x, y - 16, 7, 0, Math.PI * 2);
      ctx.fill();
      const ring = ctx.createRadialGradient(x - 3, y + 8, 1, x, y + 10, 11);
      ring.addColorStop(0, C.brassHi);
      ring.addColorStop(1, C.brassLo);
      ctx.fillStyle = ring;
      ctx.beginPath();
      ctx.arc(x, y + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(x, y + 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  // Desk shelf with plugs.
  ctx.fillStyle = "#24160c";
  ctx.fillRect(bx - 60, by + bh + 40, bw + 120, 40);
  ctx.fillStyle = C.woodHi;
  ctx.fillRect(bx - 60, by + bh + 40, bw + 120, 6);
  // Cords drooping from a few jacks.
  ctx.strokeStyle = "#0e0b09";
  ctx.lineWidth = 7;
  for (let i = 0; i < 5; i++) {
    const x = bx + bw * (0.15 + i * 0.17);
    ctx.beginPath();
    ctx.moveTo(x, by + bh * (0.3 + (i % 3) * 0.2));
    ctx.bezierCurveTo(x - 30, by + bh + 20, x + 60, by + bh + 30, x + 40, by + bh + 46);
    ctx.stroke();
  }

  // Desk lamp, left, throwing amber across the board.
  glow(ctx, w * 0.16, by + bh + 20, 520, C.amber, 0.28);
  ctx.fillStyle = "#0a0806";
  ctx.beginPath();
  ctx.moveTo(w * 0.12, by + bh - 20);
  ctx.lineTo(w * 0.2, by + bh - 20);
  ctx.lineTo(w * 0.18, by + bh - 70);
  ctx.lineTo(w * 0.14, by + bh - 70);
  ctx.fill();

  // Dot's chair, pushed back and turned.
  const cx = w * 0.5,
    cy = h * 0.82;
  ctx.fillStyle = "#07090d";
  ctx.beginPath();
  ctx.roundRect(cx - 110, cy - 230, 200, 210, 30);
  ctx.fill();
  ctx.fillRect(cx - 140, cy - 30, 260, 40);
  ctx.fillRect(cx - 8, cy + 10, 16, 120);
  ctx.fillRect(cx - 100, cy + 120, 200, 12);
  ctx.strokeStyle = withAlpha(C.amber, 0.35);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cx - 110, cy - 230, 200, 210, 30);
  ctx.stroke();
  // Headset dangling off the desk.
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx + 180, by + bh + 46);
  ctx.quadraticCurveTo(cx + 190, by + bh + 160, cx + 175, by + bh + 210);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 175, by + bh + 230, 26, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  vignette(ctx, w, h, 0.85);
  grain(ctx, w, h, 0.05);
  return el;
}

/** Extreme close-up: the brass-tipped cord hanging loose, lamps out of focus behind. */
export function paintCord(w = 1920, h = 1080) {
  const { el, ctx } = canvas(w, h);
  ctx.fillStyle = "#07090e";
  ctx.fillRect(0, 0, w, h);
  ctx.filter = "blur(18px)";
  for (let i = 0; i < 26; i++) glow(ctx, rand() * w, rand() * h * 0.7, 40 + rand() * 70, C.amber, 0.2 + rand() * 0.35);
  ctx.filter = "none";
  // Jack panel edge at the top.
  const panel = ctx.createLinearGradient(0, 0, 0, h * 0.22);
  panel.addColorStop(0, "#1a120a");
  panel.addColorStop(1, "#0c0805");
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, w, h * 0.22);
  ctx.fillStyle = C.brass;
  ctx.fillRect(0, h * 0.22 - 8, w, 8);
  for (let i = 0; i < 7; i++) {
    const x = w * (0.12 + i * 0.13);
    const ring = ctx.createRadialGradient(x - 10, h * 0.11 - 10, 4, x, h * 0.11, 46);
    ring.addColorStop(0, C.brassHi);
    ring.addColorStop(1, C.brassLo);
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(x, h * 0.11, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x, h * 0.11, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  // The cord: from the empty jack, sagging down and out of frame.
  const x0 = w * 0.51,
    y0 = h * 0.11;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0c0a08";
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(x0 + 60, h * 0.42);
  ctx.bezierCurveTo(x0 + 120, h * 0.75, x0 - 260, h * 0.8, x0 - 420, h * 1.1);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(C.amber, 0.35);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x0 + 50, h * 0.44);
  ctx.bezierCurveTo(x0 + 100, h * 0.74, x0 - 260, h * 0.77, x0 - 420, h * 1.07);
  ctx.stroke();
  // The plug, hanging just below its jack.
  ctx.save();
  ctx.translate(x0 + 40, h * 0.3);
  ctx.rotate(0.18);
  const sleeve = ctx.createLinearGradient(-40, 0, 40, 0);
  sleeve.addColorStop(0, C.brassLo);
  sleeve.addColorStop(0.35, C.brassHi);
  sleeve.addColorStop(1, C.brassLo);
  ctx.fillStyle = sleeve;
  ctx.beginPath();
  ctx.roundRect(-36, -40, 72, 150, 12);
  ctx.fill();
  ctx.fillStyle = "#1b1209";
  ctx.fillRect(-38, 20, 76, 12);
  ctx.fillStyle = sleeve;
  ctx.beginPath();
  ctx.roundRect(-14, -120, 28, 90, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -124, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  glow(ctx, x0 + 30, h * 0.28, 260, C.amberHi, 0.18);
  vignette(ctx, w, h, 0.9);
  grain(ctx, w, h, 0.05);
  return el;
}

/** Dot's call log on the desk. Returns the canvas and the y-centre of each entry (0..1). */
export function paintLog(entries: string[], w = 1920, h = 1080) {
  const { el, ctx } = canvas(w, h);
  // Desk wood.
  ctx.fillStyle = C.wood;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    ctx.strokeStyle = withAlpha(i % 2 ? C.woodHi : "#1e1009", 0.25);
    ctx.lineWidth = 1 + rand() * 3;
    const y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + rand() * 30 - 15, w * 0.7, y + rand() * 30 - 15, w, y + rand() * 20 - 10);
    ctx.stroke();
  }
  glow(ctx, w * 0.75, h * 0.2, 900, C.amber, 0.25);
  // The page.
  const px = w * 0.24,
    py = h * 0.08,
    pw = w * 0.52,
    ph = h * 0.9;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.rotate(-0.025);
  ctx.translate(-pw / 2, -ph / 2);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 40;
  const paper = ctx.createLinearGradient(0, 0, pw, ph);
  paper.addColorStop(0, C.paper);
  paper.addColorStop(1, C.paperLo);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, pw, ph);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(60,90,140,0.35)";
  ctx.lineWidth = 2;
  for (let y = 120; y < ph; y += 56) {
    ctx.beginPath();
    ctx.moveTo(30, y);
    ctx.lineTo(pw - 30, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(170,40,40,0.4)";
  ctx.beginPath();
  ctx.moveTo(110, 0);
  ctx.lineTo(110, ph);
  ctx.stroke();
  ctx.fillStyle = "#2b2116";
  ctx.font = `${Math.round(h * 0.04)}px Limelight, Georgia, serif`;
  ctx.fillText("CALL LOG · POSITION 3", 130, 86);
  ctx.font = `${Math.round(h * 0.031)}px "Special Elite", "Courier New", monospace`;
  const ys: number[] = [];
  entries.forEach((line, i) => {
    const y = 160 + i * 112;
    ctx.fillStyle = i >= entries.length - 2 ? "#3a1d1d" : "#1e1810";
    wrap(ctx, line, 130, y, pw - 170, 48);
    ys.push((py + y + 10) / h);
  });
  ctx.restore();
  // Coffee ring.
  ctx.strokeStyle = "rgba(70,40,15,0.35)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.72, 90, 0, Math.PI * 1.8);
  ctx.stroke();
  vignette(ctx, w, h, 0.85);
  grain(ctx, w, h, 0.05);
  return { el, ys };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

// ---- portraits -----------------------------------------------------------------------

type Look = {
  suit: string;
  skin: string;
  hair: string;
  face: "male" | "female";
  hat?: "none" | "fedora" | "wide" | "police";
  extras: (ctx: CanvasRenderingContext2D, m: MoodShape) => void;
  sad?: boolean; // cracking reads as grief rather than anger
};

type MoodShape = { mood: Mood; brow: number; mouth: number; eye: number; sweat: boolean };

const MOODS: Record<Mood, Omit<MoodShape, "mood">> = {
  calm: { brow: 0, mouth: 10, eye: 0.75, sweat: false },
  uneasy: { brow: 0.12, mouth: 0, eye: 1, sweat: false },
  cracking: { brow: 0.3, mouth: -14, eye: 1.15, sweat: true },
};

const HEAD = { x: 384, y: 440, rx: 112, ry: 146 };

const LOOKS: Record<string, Look> = {
  doyle: {
    suit: "#22242b",
    skin: "#c99a74",
    hair: "#151210",
    face: "male",
    hat: "none",
    extras(ctx, m) {
      // Slicked hair with grey temples, thin moustache, carnation, cigarette.
      ctx.fillStyle = "#151210";
      ctx.beginPath();
      ctx.ellipse(HEAD.x + 4, HEAD.y - 96, 120, 66, 0.05, Math.PI, Math.PI * 2.02);
      ctx.fill();
      ctx.fillStyle = "rgba(200,200,210,0.5)";
      ctx.fillRect(HEAD.x - 116, HEAD.y - 70, 14, 50);
      ctx.fillRect(HEAD.x + 102, HEAD.y - 70, 14, 50);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(HEAD.x - 90 + i * 30, HEAD.y - 140);
        ctx.quadraticCurveTo(HEAD.x - 40 + i * 30, HEAD.y - 160, HEAD.x + 20 + i * 30, HEAD.y - 130);
        ctx.stroke();
      }
      ctx.fillStyle = "#1a120c";
      ctx.beginPath();
      ctx.ellipse(HEAD.x, HEAD.y + 58, 38, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b8322a";
      ctx.beginPath();
      ctx.arc(250, 790, 18, 0, Math.PI * 2);
      ctx.fill();
      // Vest and tie.
      ctx.fillStyle = "#2d3038";
      ctx.beginPath();
      ctx.moveTo(330, 700);
      ctx.lineTo(438, 700);
      ctx.lineTo(420, 1152);
      ctx.lineTo(348, 1152);
      ctx.fill();
      ctx.fillStyle = m.mood === "cracking" ? "#6b1f1a" : "#5a1813";
      ctx.beginPath();
      ctx.moveTo(374, 690);
      ctx.lineTo(394, 690);
      ctx.lineTo(408, 900);
      ctx.lineTo(384, 930);
      ctx.lineTo(360, 900);
      ctx.fill();
      // Cigarette in the hand at lower right.
      hand(ctx, 560, 960, "#c99a74");
      ctx.fillStyle = "#eee";
      ctx.save();
      ctx.translate(590, 930);
      ctx.rotate(m.mood === "cracking" ? 0.9 : -0.4);
      ctx.fillRect(0, -5, 70, 10);
      ctx.fillStyle = C.amber;
      ctx.fillRect(66, -5, 8, 10);
      ctx.restore();
    },
  },
  evelyn: {
    suit: "#0d0d12",
    skin: "#dcb59a",
    hair: "#2a1a12",
    face: "female",
    hat: "wide",
    sad: true,
    extras(ctx, m) {
      // Fur stole over the shoulders.
      ctx.fillStyle = "#4a3a2c";
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.ellipse(170 + i * 11, 720 + Math.sin(i) * 12, 30, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Pearls.
      for (let i = 0; i < 17; i++) {
        const a = Math.PI * (0.15 + (i / 16) * 0.7);
        const x = 384 + Math.cos(a) * 92,
          y = 640 + Math.sin(a) * 70;
        const p = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
        p.addColorStop(0, "#fff");
        p.addColorStop(1, "#9a9284");
        ctx.fillStyle = p;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cocktail glass.
      hand(ctx, 590, 940, "#dcb59a");
      ctx.strokeStyle = "rgba(230,230,240,0.7)";
      ctx.lineWidth = 3;
      const tilt = m.mood === "cracking" ? 0.25 : 0;
      ctx.save();
      ctx.translate(610, 880);
      ctx.rotate(tilt);
      ctx.beginPath();
      ctx.moveTo(-40, -70);
      ctx.lineTo(40, -70);
      ctx.lineTo(0, -20);
      ctx.closePath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 40);
      ctx.stroke();
      ctx.fillStyle = withAlpha(C.amber, 0.6);
      ctx.beginPath();
      ctx.moveTo(-30, -62);
      ctx.lineTo(30, -62);
      ctx.lineTo(0, -28);
      ctx.fill();
      ctx.restore();
    },
  },
  leo: {
    suit: "#3b3a36",
    skin: "#c8987a",
    hair: "#3a2516",
    face: "male",
    hat: "fedora",
    sad: true,
    extras(ctx, m) {
      // Rumpled shirt, loosened tie, pencil, notepad.
      ctx.fillStyle = "#cfc7b4";
      ctx.beginPath();
      ctx.moveTo(320, 690);
      ctx.lineTo(448, 690);
      ctx.lineTo(470, 1152);
      ctx.lineTo(298, 1152);
      ctx.fill();
      ctx.fillStyle = "#2f3f57";
      ctx.beginPath();
      ctx.moveTo(380, 740);
      ctx.lineTo(402, 740);
      ctx.lineTo(420, 960);
      ctx.lineTo(395, 990);
      ctx.lineTo(372, 960);
      ctx.fill();
      ctx.fillStyle = "#e6dcc4";
      ctx.save();
      ctx.translate(560, 930);
      ctx.rotate(m.mood === "cracking" ? 0.3 : -0.12);
      ctx.fillRect(-60, -80, 120, 160);
      ctx.strokeStyle = "rgba(60,60,80,0.5)";
      for (let y = -60; y < 70; y += 18) {
        ctx.beginPath();
        ctx.moveTo(-50, y);
        ctx.lineTo(50, y);
        ctx.stroke();
      }
      ctx.restore();
      hand(ctx, 540, 1010, "#c8987a");
      ctx.fillStyle = "#d9b23c";
      ctx.save();
      ctx.translate(HEAD.x + 110, HEAD.y - 10);
      ctx.rotate(-0.5);
      ctx.fillRect(0, 0, 70, 9);
      ctx.restore();
    },
  },
  riley: {
    suit: "#141c2e",
    skin: "#d2a07e",
    hair: "#4a2c18",
    face: "male",
    hat: "police",
    extras(ctx) {
      // Brass buttons, badge, stubble.
      for (let i = 0; i < 4; i++) {
        const y = 760 + i * 95;
        for (const x of [330, 438]) {
          const b = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 13);
          b.addColorStop(0, C.brassHi);
          b.addColorStop(1, C.brassLo);
          ctx.fillStyle = b;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const badge = ctx.createLinearGradient(220, 760, 280, 830);
      badge.addColorStop(0, C.brassHi);
      badge.addColorStop(1, C.brassLo);
      ctx.fillStyle = badge;
      star(ctx, 250, 800, 30, 14);
      ctx.fillStyle = "rgba(40,30,25,0.25)";
      for (let i = 0; i < 400; i++) {
        const a = rand() * Math.PI,
          r = rand();
        ctx.fillRect(HEAD.x + Math.cos(a) * HEAD.rx * 0.85 * r, HEAD.y + 50 + Math.sin(a) * 80 * r, 2, 2);
      }
    },
  },
};

function hand(ctx: CanvasRenderingContext2D, x: number, y: number, skin: string) {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, y, 48, 38, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,30,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 14, y + 10, 40, 26, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, r2: number) {
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r2 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.fill();
}

/** Shoulders, neck and head, lit from the left by an amber key, blue fill on the right. */
function bust(ctx: CanvasRenderingContext2D, look: Look, m: MoodShape) {
  const W = 768,
    H = 1152;
  // Rim glow behind.
  glow(ctx, HEAD.x - 60, HEAD.y + 120, 520, C.amber, 0.12);
  // Shoulders.
  const suit = ctx.createLinearGradient(80, 0, 690, 0);
  suit.addColorStop(0, shade(look.suit, 1.9));
  suit.addColorStop(0.35, look.suit);
  suit.addColorStop(1, shade(look.suit, 0.5));
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.moveTo(60, H);
  ctx.bezierCurveTo(60, 820, 150, 700, 320, 670);
  ctx.lineTo(448, 670);
  ctx.bezierCurveTo(618, 700, 708, 820, 708, H);
  ctx.closePath();
  ctx.fill();
  // Lapels.
  ctx.fillStyle = shade(look.suit, 0.75);
  ctx.beginPath();
  ctx.moveTo(320, 672);
  ctx.lineTo(260, 760);
  ctx.lineTo(352, 1000);
  ctx.lineTo(366, 700);
  ctx.closePath();
  ctx.moveTo(448, 672);
  ctx.lineTo(508, 760);
  ctx.lineTo(416, 1000);
  ctx.lineTo(402, 700);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(C.amberHi, 0.4);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(62, H);
  ctx.bezierCurveTo(62, 820, 150, 702, 320, 672);
  ctx.stroke();

  // Neck.
  const skin = ctx.createLinearGradient(HEAD.x - HEAD.rx, 0, HEAD.x + HEAD.rx, 0);
  skin.addColorStop(0, shade(look.skin, 1.15));
  skin.addColorStop(0.45, look.skin);
  skin.addColorStop(1, shade(look.skin, 0.38));
  ctx.fillStyle = skin;
  ctx.fillRect(HEAD.x - 48, HEAD.y + 100, 96, 110);
  ctx.fillStyle = "rgba(0,0,20,0.35)";
  ctx.fillRect(HEAD.x - 48, HEAD.y + 120, 96, 30);
  // Collar.
  ctx.fillStyle = look.face === "male" ? "#e8e2d4" : shade(look.suit, 1.2);
  ctx.beginPath();
  ctx.moveTo(HEAD.x - 60, HEAD.y + 200);
  ctx.lineTo(HEAD.x, HEAD.y + 260);
  ctx.lineTo(HEAD.x + 60, HEAD.y + 200);
  ctx.lineTo(HEAD.x + 56, HEAD.y + 236);
  ctx.lineTo(HEAD.x, HEAD.y + 280);
  ctx.lineTo(HEAD.x - 56, HEAD.y + 236);
  ctx.fill();

  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  if (look.face === "male") {
    ctx.moveTo(HEAD.x - HEAD.rx, HEAD.y - 30);
    ctx.bezierCurveTo(HEAD.x - HEAD.rx, HEAD.y - 190, HEAD.x + HEAD.rx, HEAD.y - 190, HEAD.x + HEAD.rx, HEAD.y - 30);
    ctx.bezierCurveTo(HEAD.x + HEAD.rx, HEAD.y + 80, HEAD.x + 60, HEAD.y + 150, HEAD.x, HEAD.y + 150);
    ctx.bezierCurveTo(HEAD.x - 60, HEAD.y + 150, HEAD.x - HEAD.rx, HEAD.y + 80, HEAD.x - HEAD.rx, HEAD.y - 30);
  } else ctx.ellipse(HEAD.x, HEAD.y, HEAD.rx * 0.9, HEAD.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ear on the lit side.
  ctx.beginPath();
  ctx.ellipse(HEAD.x - HEAD.rx + 4, HEAD.y + 4, 16, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair under any hat.
  if (look.face === "female") {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.ellipse(HEAD.x - 70, HEAD.y + 40, 50, 110, 0.15, 0, Math.PI * 2);
    ctx.ellipse(HEAD.x + 74, HEAD.y + 40, 46, 110, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(HEAD.x, HEAD.y + 10, HEAD.rx * 0.78, HEAD.ry * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  face(ctx, look, m);

  // Hats.
  if (look.hat === "fedora" || look.hat === "police" || look.hat === "wide") hat(ctx, look.hat, m);
  // The shadow side: cool blue fill.
  const fill = ctx.createLinearGradient(HEAD.x, 0, W, 0);
  fill.addColorStop(0, "rgba(20,30,60,0)");
  fill.addColorStop(1, "rgba(20,30,60,0.45)");
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
}

function face(ctx: CanvasRenderingContext2D, look: Look, m: MoodShape) {
  const ex = 46,
    ey = HEAD.y - 6;
  // Eye sockets.
  ctx.fillStyle = "rgba(60,30,20,0.25)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(HEAD.x + s * ex, ey, 30, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes: lids drop when calm, widen under pressure.
  for (const s of [-1, 1]) {
    const x = HEAD.x + s * ex;
    ctx.fillStyle = "#efe7da";
    ctx.beginPath();
    ctx.ellipse(x, ey, 18, 9 * m.eye, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1410";
    ctx.beginPath();
    ctx.arc(x + (m.mood === "uneasy" ? s * 0 - 5 : 1), ey, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // Upper lid.
    ctx.strokeStyle = "#2a1810";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, ey, 19, 10 * m.eye, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // Brows: inner end lifts with worry (sad) or drops with anger.
    const tilt = (look.sad ? -1 : 1) * m.brow * 40;
    ctx.strokeStyle = look.hair;
    ctx.lineWidth = look.face === "male" ? 9 : 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - s * 24, ey - 30 - (look.sad ? 0 : 0));
    ctx.lineTo(x + s * 22, ey - 30 + tilt * (s === -1 ? 1 : 1) * 0.5 - (look.sad ? 0 : 0));
    ctx.stroke();
  }
  if (look.face === "female") {
    ctx.fillStyle = "rgba(170,60,70,0.25)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(HEAD.x + s * 62, HEAD.y + 46, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Nose: a lit ridge and a shadow.
  ctx.strokeStyle = "rgba(60,25,15,0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(HEAD.x + 4, ey + 6);
  ctx.quadraticCurveTo(HEAD.x + 18, ey + 52, HEAD.x + 2, ey + 62);
  ctx.stroke();
  // Mouth.
  const my = HEAD.y + 88;
  ctx.strokeStyle = look.face === "female" ? "#8a2a2a" : "#5a2a1e";
  ctx.lineWidth = look.face === "female" ? 7 : 5;
  ctx.beginPath();
  ctx.moveTo(HEAD.x - 30, my);
  ctx.quadraticCurveTo(HEAD.x + (m.mood === "calm" ? 8 : 0), my + m.mouth, HEAD.x + 30, my - (m.mood === "calm" ? 6 : 0));
  ctx.stroke();
  if (m.sweat) {
    ctx.fillStyle = "rgba(220,235,255,0.75)";
    for (const [x, y] of [
      [HEAD.x - 70, HEAD.y - 70],
      [HEAD.x + 64, HEAD.y - 50],
      [HEAD.x - 88, HEAD.y + 10],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.quadraticCurveTo(x + 7, y + 4, x, y + 8);
      ctx.quadraticCurveTo(x - 7, y + 4, x, y - 10);
      ctx.fill();
    }
    if (look.sad) {
      ctx.strokeStyle = "rgba(200,220,255,0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(HEAD.x - 50, ey + 12);
      ctx.quadraticCurveTo(HEAD.x - 56, ey + 50, HEAD.x - 48, ey + 80);
      ctx.stroke();
    }
  }
}

function hat(ctx: CanvasRenderingContext2D, kind: "fedora" | "police" | "wide", m: MoodShape) {
  const y = HEAD.y - 110 - (m.mood === "cracking" && kind === "fedora" ? 18 : 0);
  if (kind === "wide") {
    ctx.fillStyle = "#08080b";
    ctx.beginPath();
    ctx.ellipse(HEAD.x + 10, y + 10, 250, 46, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(HEAD.x + 10, y - 30, 120, 60, -0.08, Math.PI, Math.PI * 2);
    ctx.fillRect(HEAD.x - 110, y - 30, 240, 40);
    ctx.fill();
    // Net veil, pushed up when she cracks.
    if (m.mood !== "cracking") {
      ctx.strokeStyle = "rgba(20,20,26,0.5)";
      ctx.lineWidth = 1.5;
      for (let i = -12; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(HEAD.x + i * 16, y + 30);
        ctx.lineTo(HEAD.x + i * 16 + 60, HEAD.y + 20);
        ctx.moveTo(HEAD.x + i * 16, y + 30);
        ctx.lineTo(HEAD.x + i * 16 - 60, HEAD.y + 20);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = withAlpha(C.amberHi, 0.35);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(HEAD.x + 10, y + 10, 250, 46, -0.08, Math.PI * 0.9, Math.PI * 1.3);
    ctx.stroke();
    return;
  }
  if (kind === "fedora") {
    ctx.fillStyle = "#2b2721";
    ctx.beginPath();
    ctx.ellipse(HEAD.x, y + 16, 190, 34, 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(HEAD.x - 118, y + 10);
    ctx.bezierCurveTo(HEAD.x - 120, y - 110, HEAD.x + 120, y - 110, HEAD.x + 118, y + 10);
    ctx.fill();
    ctx.fillStyle = "#14110d";
    ctx.fillRect(HEAD.x - 118, y - 18, 236, 22);
    // PRESS card in the band.
    ctx.fillStyle = C.paper;
    ctx.save();
    ctx.translate(HEAD.x + 50, y - 34);
    ctx.rotate(0.12);
    ctx.fillRect(0, 0, 58, 40);
    ctx.fillStyle = "#222";
    ctx.font = "bold 15px 'Special Elite', monospace";
    ctx.fillText("PRESS", 4, 26);
    ctx.restore();
    return;
  }
  // Police cap: crown, band, peak, badge.
  ctx.fillStyle = "#0f1626";
  ctx.beginPath();
  ctx.ellipse(HEAD.x, y - 30, 150, 50, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(HEAD.x - 120, y - 30, 240, 56);
  ctx.fillStyle = "#05070c";
  ctx.beginPath();
  ctx.ellipse(HEAD.x, y + 34, 130, 26, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#1d1d1d";
  ctx.fillRect(HEAD.x - 120, y + 6, 240, 18);
  const g = ctx.createLinearGradient(HEAD.x - 20, y - 40, HEAD.x + 20, y);
  g.addColorStop(0, C.brassHi);
  g.addColorStop(1, C.brassLo);
  ctx.fillStyle = g;
  star(ctx, HEAD.x, y - 16, 22, 11);
}

function shade(hex: string, k: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** A suspect portrait (768x1152, transparent) in one of three moods. */
export function paintPortrait(id: string, mood: Mood) {
  const { el, ctx } = canvas(768, 1152);
  const look = LOOKS[id] ?? LOOKS.doyle!;
  const m = { mood, ...MOODS[mood] };
  bust(ctx, look, m);
  look.extras(ctx, m);
  grain(ctx, 768, 1152, 0.07);
  return el;
}

/** Mrs. Hale: silver roll, spectacles, headset round her neck. */
export function paintHale() {
  const { el, ctx } = canvas(768, 1152);
  const look: Look = { suit: "#3a3f4a", skin: "#e0b9a0", hair: "#c9c9cf", face: "female", extras: () => {} };
  bust(ctx, look, { mood: "calm", ...MOODS.calm, mouth: 8 });
  ctx.fillStyle = "#cfcfd6";
  ctx.beginPath();
  ctx.ellipse(HEAD.x, HEAD.y - 120, 120, 60, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(HEAD.x, HEAD.y - 150, 100, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a08850";
  ctx.lineWidth = 4;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(HEAD.x + s * 46, HEAD.y - 6, 28, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(HEAD.x, HEAD.y + 250, 120, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  grain(ctx, 768, 1152, 0.06);
  return el;
}

/** Dot's photo: a faded black-and-white print with a white border. */
export function paintDot() {
  const { el, ctx } = canvas(600, 760);
  ctx.fillStyle = "#efe9dc";
  ctx.fillRect(0, 0, 600, 760);
  ctx.save();
  ctx.translate(40, 40);
  ctx.beginPath();
  ctx.rect(0, 0, 520, 600);
  ctx.clip();
  ctx.fillStyle = "#5c5c5c";
  ctx.fillRect(0, 0, 520, 600);
  ctx.scale(0.62, 0.62);
  ctx.translate(30, -120);
  const look: Look = { suit: "#2b2b2b", skin: "#bdbdbd", hair: "#262626", face: "female", sad: false, extras: () => {} };
  bust(ctx, look, { mood: "calm", ...MOODS.calm, mouth: 16 });
  ctx.restore();
  // Desaturate and fade.
  const img = ctx.getImageData(0, 0, 600, 760);
  for (let i = 0; i < img.data.length; i += 4) {
    const g = 0.3 * img.data[i]! + 0.59 * img.data[i + 1]! + 0.11 * img.data[i + 2]!;
    img.data[i] = g * 0.9 + 30;
    img.data[i + 1] = g * 0.88 + 26;
    img.data[i + 2] = g * 0.8 + 20;
  }
  ctx.putImageData(img, 0, 0);
  grain(ctx, 600, 760, 0.1);
  return el;
}
