"use client";

import { useEffect, useRef } from "react";
import type { AgentId, PublicAgent } from "../lib/types";
import { drawRoom, hitTest, ROOM } from "./office-scene";

export type TaskReadout = {
  headline: string;
  detail: string;
  conclusion: string | null;
  tone: "quiet" | "working" | "done" | "error";
};

type OfficeProps = {
  agents: PublicAgent[];
  selectedId: AgentId;
  readout: TaskReadout;
  onSelect: (id: AgentId) => void;
};

export function Office({ agents, selectedId, readout, onSelect }: OfficeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ agents, selectedId, onSelect });
  live.current = { agents, selectedId, onSelect };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = ROOM.w;
    canvas.height = ROOM.h;
    const image = new Image();
    image.src = "/apartment.jpg";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const loop = (now: number) => {
      if (image.complete && image.naturalWidth > 0) {
        drawRoom(ctx, image, live.current.agents, live.current.selectedId, now, reduceMotion);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="office-frame">
      <div className="office-stage">
        <canvas
          ref={canvasRef}
          className="office-canvas"
          aria-label="Team apartment. Characters move when they are working."
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * ROOM.w;
            const y = ((event.clientY - rect.top) / rect.height) * ROOM.h;
            const id = hitTest(x, y);
            if (id) live.current.onSelect(id);
          }}
        />
      </div>
      <section className={`task-readout task-readout-${readout.tone}`} aria-live="polite">
        <p className="task-readout-headline">{readout.headline}</p>
      </section>
    </div>
  );
}
