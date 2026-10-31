// One layout for both renderers: Pixi draws into these rects and React positions its
// overlays (subtitles, suspect cards, notebook) on the same numbers.
//
// Portrait first: the suspect on the line gets most of the height. The switchboard is a
// brass rail with one card per suspect, and the receiver control sits beneath it.

export type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  width: number;
  height: number;
  /** Laptop and up: notebook is a fixed column. Below: a drawer. */
  wide: boolean;
  topBar: Rect;
  stage: Rect; // the booth where the suspect's portrait appears
  subtitles: Rect; // bottom band of the stage
  board: Rect; // brass rail + suspect cards
  cards: Rect[]; // one per suspect, in switchboard order
  jacks: { x: number; y: number }[]; // where a patch cord plugs into each card
  plugRest: { x: number; y: number }; // where the idle cord hangs
  receiver: Rect; // the receiver control bar
  notebook: Rect;
};

export const TOP_BAR = 56;
export const RECEIVER_BAR = 92;
export const BOARD_H = 132;

export function computeLayout(width: number, height: number, suspects: number): Layout {
  const wide = width >= 1000;
  const notebookW = wide ? Math.round(Math.min(420, Math.max(320, width * 0.27))) : Math.min(400, width - 32);
  const leftW = wide ? width - notebookW : width;
  const stageH = Math.max(220, height - TOP_BAR - BOARD_H - RECEIVER_BAR);

  const topBar = { x: 0, y: 0, w: width, h: TOP_BAR };
  const stage = { x: 0, y: TOP_BAR, w: leftW, h: stageH };
  const subH = Math.min(150, Math.round(stageH * 0.3));
  const subtitles = { x: 0, y: stage.y + stageH - subH, w: leftW, h: subH };
  const board = { x: 0, y: stage.y + stageH, w: leftW, h: BOARD_H };
  const receiver = { x: 0, y: board.y + BOARD_H, w: leftW, h: height - board.y - BOARD_H };
  const notebook = { x: wide ? leftW : width - notebookW, y: TOP_BAR, w: notebookW, h: height - TOP_BAR };

  // Cards hang under a brass rail; the rail's jack for each card sits just above it.
  const gap = 12;
  const railY = board.y + 18;
  const cardW = Math.min(210, (board.w - 96 - gap * (suspects - 1)) / Math.max(1, suspects));
  const rowW = cardW * suspects + gap * (suspects - 1);
  const rowX = board.x + (board.w - rowW) / 2 + 24;
  const cards = Array.from({ length: suspects }, (_, i) => ({ x: rowX + i * (cardW + gap), y: railY + 14, w: cardW, h: BOARD_H - 44 }));
  const jacks = cards.map((c) => ({ x: c.x + c.w / 2, y: railY }));

  return { width, height, wide, topBar, stage, subtitles, board, cards, jacks, plugRest: { x: rowX - 34, y: railY + 40 }, receiver, notebook };
}
