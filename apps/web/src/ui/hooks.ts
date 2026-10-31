import { useEffect, useState } from "react";
import { portraitUrl } from "../art/assets.js";
import { CASE_ID } from "../controller.js";
import { computeLayout, type Layout } from "../layout.js";
import { useStore } from "../state/store.js";

export function useLayout(): Layout {
  const suspects = useStore((s) => s.case?.suspects.length ?? 4);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return computeLayout(size.w, size.h, suspects);
}

export function usePortraitUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void portraitUrl(CASE_ID, id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}

export const box = (r: { x: number; y: number; w: number; h: number }) => ({ left: r.x, top: r.y, width: r.w, height: r.h });
