// Loads the painted art in cases/<id>/art/, and falls back to the code-drawn stand-ins for
// anything missing. Art is named by its base ("doyle-calm", "bg-exterior"); a .webp is used in
// preference to a .png of the same name. The server's manifest says which files exist, so
// missing art never costs a failed request.

import { Assets, Texture } from "pixi.js";
import { paintCord, paintDot, paintExterior, paintHale, paintInterior, paintLog, paintPortrait, type Mood } from "./paint.js";

export type Manifest = { art: string[]; intro: string[] };

let manifest: Manifest = { art: [], intro: [] };
const cache = new Map<string, Texture>();

export async function loadManifest(caseId: string): Promise<Manifest> {
  try {
    const res = await fetch(`/cases/${caseId}/manifest.json`);
    if (res.ok) manifest = (await res.json()) as Manifest;
  } catch {}
  return manifest;
}

const EXTENSIONS = ["webp", "png"];

/** The shipped file for an art base name, or null if it's drawn in code. */
function fileFor(base: string): string | null {
  for (const ext of EXTENSIONS) if (manifest.art.includes(`${base}.${ext}`)) return `${base}.${ext}`;
  return null;
}

export const hasIntroAudio = () => manifest.intro.includes("narration.wav");

async function art(caseId: string, base: string, fallback: () => HTMLCanvasElement): Promise<Texture> {
  const key = `${caseId}/${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let tex: Texture | null = null;
  const file = fileFor(base);
  if (file) {
    try {
      tex = await Assets.load<Texture>(`/cases/${caseId}/art/${file}`);
    } catch {}
  }
  tex ??= Texture.from(fallback());
  cache.set(key, tex);
  return tex;
}

export const MOODS: Mood[] = ["calm", "uneasy", "cracking"];

export const moodFor = (nerves: number): Mood => (nerves >= 8 ? "cracking" : nerves >= 4 ? "uneasy" : "calm");

export const portrait = (caseId: string, id: string, mood: Mood) => art(caseId, `${id}-${mood}`, () => paintPortrait(id, mood));
export const dotPhoto = (caseId: string) => art(caseId, "dot", paintDot);
export const backdrop = {
  exterior: (caseId: string) => art(caseId, "bg-exterior", () => paintExterior()),
  interior: (caseId: string) => art(caseId, "bg-interior", () => paintInterior()),
  cord: (caseId: string) => art(caseId, "bg-cord", () => paintCord()),
};

/** The painted call-log backdrop, or null to use the code-drawn page (whose lines can be highlighted). */
export const paintedLog = (caseId: string) => (isCodeDrawn("bg-log") ? Promise.resolve(null) : art(caseId, "bg-log", () => paintLog([]).el));

/**
 * Where the camera pushes in, per backdrop, in 0..1 artboard space. Painted art puts the lit
 * window, the chair and the lamps in different places from the code-drawn stand-ins.
 */
export function focals() {
  const ext = isCodeDrawn("bg-exterior");
  const int = isCodeDrawn("bg-interior");
  return {
    litWindow: ext ? { x: 0.545, y: 0.345 } : { x: 0.598, y: 0.3 },
    chair: int ? { x: 0.5, y: 0.62 } : { x: 0.24, y: 0.72 },
    lamps: int ? { x: 0.5, y: 0.42 } : { x: 0.74, y: 0.3 },
    cord: isCodeDrawn("bg-cord") ? { x: 0.52, y: 0.35 } : { x: 0.5, y: 0.45 },
  };
}

/** The call log close-up is always drawn in code, so its lines can be highlighted. */
export function callLog(entries: string[]) {
  const { el, ys } = paintLog(entries);
  return { texture: Texture.from(el), ys };
}

/** The data-URL of a portrait, for DOM cards (accusation file, hint cards). */
export async function portraitUrl(caseId: string, id: string): Promise<string> {
  const file = fileFor(id === "hale" || id === "dot" ? id : `${id}-calm`);
  if (file) return `/cases/${caseId}/art/${file}`;
  return (id === "hale" ? paintHale() : id === "dot" ? paintDot() : paintPortrait(id, "calm")).toDataURL("image/png");
}

/** True when an art base is drawn in code (no file supplied), so overlays can match it. */
export const isCodeDrawn = (base: string) => fileFor(base) === null;
