import type { AgentId, AgentStatus, PublicAgent } from "../lib/types";
import { clipPixelText, paintPixelText, pixelTextWidth } from "./pixel-text";

const ROOM_W = 656;
const ROOM_H = 478;

type Spot = {
  id: AgentId;
  x: number;
  y: number;
};

type BubbleSpot = { x: number; y: number };

export const ROOM = { w: ROOM_W, h: ROOM_H };

const SPOTS: Spot[] = [
  { id: "sheldon", x: 224, y: 158 },
  { id: "howard", x: 528, y: 158 },
  { id: "penny", x: 206, y: 296 },
  { id: "leonard", x: 398, y: 318 },
  { id: "raj", x: 546, y: 268 },
  { id: "bernadette", x: 98, y: 448 },
  { id: "amy", x: 524, y: 432 },
];

const BUBBLES: Record<AgentId, BubbleSpot> = {
  sheldon: { x: 246, y: 58 },
  howard: { x: 552, y: 78 },
  penny: { x: 210, y: 208 },
  leonard: { x: 400, y: 246 },
  raj: { x: 560, y: 228 },
  bernadette: { x: 168, y: 372 },
  amy: { x: 540, y: 358 },
};

const COLORS: Record<AgentId, Record<string, string>> = {
  sheldon: { h: "#6b3e22", s: "#f3c39a", e: "#1b1b1b", c: "#2f8f45", p: "#c6aa74", k: "#2a241c", l: "#243044", r: "#3ddc97", g: "#161616" },
  penny: { h: "#f0d15c", s: "#f3c39a", e: "#1b1b1b", c: "#e56b93", p: "#3e4d73", k: "#2a241c", l: "#243044", r: "#3ddc97", g: "#161616" },
  leonard: { h: "#6a3b22", s: "#f3c39a", e: "#1b1b1b", c: "#d9c7a4", p: "#4d5968", k: "#2a241c", l: "#243044", r: "#3ddc97", g: "#161616" },
  howard: { h: "#5a341c", s: "#f3c39a", e: "#1b1b1b", c: "#d23b3b", p: "#2e3848", k: "#2a241c", l: "#243044", r: "#3ddc97", g: "#161616" },
  raj: { h: "#1c1c1c", s: "#f3c39a", e: "#1b1b1b", c: "#6a3e9a", p: "#2c3850", k: "#2a241c", l: "#243044", r: "#3ddc97", g: "#161616" },
  bernadette: { h: "#f2d15a", s: "#f3c39a", e: "#1b1b1b", c: "#e56b93", p: "#4a3428", k: "#2a241c", l: "#243044", r: "#3ddc97", g: "#161616" },
  amy: { h: "#7a4a2a", s: "#f3c39a", e: "#1b1b1b", c: "#7a3d8c", p: "#3a2a4a", k: "#2a241c", l: "#243044", r: "#3ddc97", g: "#161616" },
};


function caption(agent: PublicAgent): string {
  if (agent.status === "working") return agent.activity || "Working…";
  if (agent.status === "blocked") return agent.activity || "Blocked";
  if (agent.status === "done") return "Done";
  if (agent.status === "offline") return "Offline";
  return "Sitting idle";
}

function dotColor(status: AgentStatus): string {
  if (status === "working") return "#e6b450";
  if (status === "blocked") return "#d26262";
  if (status === "done") return "#3d9a62";
  if (status === "offline") return "#66758c";
  return "#f0a020";
}

function stateColor(status: AgentStatus): string {
  if (status === "working") return "#f0c14e";
  if (status === "blocked") return "#ff8f8f";
  if (status === "done") return "#7ddea3";
  if (status === "offline") return "#93a0b5";
  return "#f0a020";
}

function paintSprite(
  ctx: CanvasRenderingContext2D,
  sprite: string[],
  left: number,
  top: number,
  scale: number,
  colors: Record<string, string>,
  blink: boolean,
): void {
  for (let row = 0; row < sprite.length; row += 1) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col += 1) {
      const pixel = line[col];
      if (pixel === ".") continue;
      const key = blink && pixel === "e" ? "s" : pixel;
      ctx.fillStyle = colors[key] ?? "#ffffff";
      ctx.fillRect(left + col * scale, top + row * scale, scale, scale);
    }
  }
}

export function hitTest(x: number, y: number): AgentId | null {
  let best: AgentId | null = null;
  let bestDistance = 46;
  for (const spot of SPOTS) {
    const dx = x - spot.x;
    const dy = y - (spot.y - 28);
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = spot.id;
      bestDistance = distance;
    }
  }
  return best;
}

export function drawRoom(ctx: CanvasRenderingContext2D, image: CanvasImageSource): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ROOM_W, ROOM_H);
  ctx.drawImage(image, 0, 0, ROOM_W, ROOM_H);
}

export function drawLabels(
  ctx: CanvasRenderingContext2D,
  agents: PublicAgent[],
  selectedId: string,
  now: number,
  reduceMotion: boolean,
  scaleX: number,
  scaleY: number,
  dpr: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const anyoneWorking = agents.some((agent) => agent.status === "working");

  for (const spot of SPOTS) {
    const agent = byId.get(spot.id);
    if (!agent) continue;
    const working = agent.status === "working";
    const motion = !reduceMotion && (working || !anyoneWorking);
    const float = motion ? (working ? (Math.floor(now / 180) % 2 === 0 ? -3 : 2) : Math.floor(now / 180) % 2 === 0 ? 0 : -2) : 0;
    drawBubble(
      ctx,
      agent,
      BUBBLES[spot.id].x * scaleX,
      (BUBBLES[spot.id].y + float) * scaleY,
      spot.id === selectedId,
      now,
      motion,
      scaleX,
      scaleY,
      dpr,
    );
  }
}

const MINI_STILL = ["..hh..", ".hssh.", ".hssh.", "..cc..", ".cccc.", "cc..cc", ".p..p.", ".k..k."];
const MINI_TYPE = ["..hh..", ".hssh.", ".hssh.", ".cccc.", "ccrrcc", ".cccc.", ".p..p.", ".k..k."];

function drawBubble(
  ctx: CanvasRenderingContext2D,
  agent: PublicAgent,
  anchorX: number,
  bottom: number,
  selected: boolean,
  now: number,
  motion: boolean,
  scaleX: number,
  scaleY: number,
  dpr: number,
): void {
  const roomW = 148;
  const padX = 4 * scaleX;
  const padY = 3 * scaleY;
  const cell = 3 * Math.min(scaleX, scaleY);
  const avatarW = 6 * cell;
  const avatarH = 8 * cell;
  const namePixel = (8 * scaleY) / 7;
  const captionPixel = (7 * scaleY) / 7;
  const lineGap = 4 * dpr;
  const nameH = 8 * scaleY;
  const lineH = 7 * scaleY;
  const textBlock = nameH + lineGap + lineH + lineGap + lineH;
  const width = roomW * scaleX;
  const height = Math.max(avatarH, textBlock) + padY * 2;
  const textMax = Math.max(8, width - padX * 3 - avatarW);
  const name = agent.name;
  const role = clipPixelText(agent.role, textMax, captionPixel);
  const text = clipPixelText(caption(agent), textMax, captionPixel);
  const maxX = ROOM_W * scaleX;
  let x = Math.round(anchorX - width / 2);
  let y = Math.round(bottom - height);
  x = Math.max(4, Math.min(maxX - width - 4, x));
  y = Math.max(4, y);

  ctx.fillStyle = "#1c2b4a";
  ctx.strokeStyle = selected ? "#f0c14e" : "#41557a";
  ctx.lineWidth = (selected ? 2 : 1) * dpr;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8 * dpr);
  ctx.fill();
  ctx.stroke();

  const working = agent.status === "working";
  const mini = working && motion && Math.floor(now / 160) % 2 === 0 ? MINI_TYPE : MINI_STILL;
  const miniBob = motion ? (Math.floor(now / 280) % 2 === 0 ? 0 : -cell) : 0;
  const avatarX = x + padX;
  const avatarY = y + Math.round((height - avatarH) / 2) + miniBob;
  paintSprite(ctx, mini, avatarX, avatarY, cell, COLORS[agent.id], false);

  ctx.fillStyle = dotColor(agent.status);
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarW - cell,
    avatarY + cell * 1.5,
    2.5 * Math.min(scaleX, scaleY),
    0,
    Math.PI * 2,
  );
  ctx.fill();

  const textX = avatarX + avatarW + padX;
  const textTop = y + (height - textBlock) / 2;
  ctx.fillStyle = "#ffe08a";
  paintPixelText(ctx, clipPixelText(name, textMax, namePixel), textX, textTop, namePixel);
  ctx.fillStyle = "#9ec1ff";
  paintPixelText(ctx, role, textX, textTop + nameH + lineGap, captionPixel);
  ctx.fillStyle = stateColor(agent.status);
  paintPixelText(ctx, text, textX, textTop + nameH + lineGap + lineH + lineGap, captionPixel);
}
