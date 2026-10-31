// Duotone noir: ink blue-black, warm amber lamps, brass hardware, red only for danger.
// Mirrored as CSS custom properties in styles.css.

export const C = {
  ink: "#0a0e16",
  ink2: "#121a27",
  ink3: "#1c2638",
  steel: "#3a4a63",
  fog: "#7f8ea6",
  amber: "#f2a33a",
  amberHi: "#ffd58a",
  amberLo: "#8a4b12",
  brass: "#c9a24a",
  brassHi: "#f0d58c",
  brassLo: "#5e4515",
  paper: "#e8dcc0",
  paperLo: "#b9a77f",
  red: "#c0392b",
  wood: "#3b2414",
  woodHi: "#6b4224",
} as const;

export const hex = (c: string) => Number.parseInt(c.slice(1), 16);
