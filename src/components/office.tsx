"use client";

import { useEffect, useRef } from "react";
import type { AgentId, PublicAgent } from "../lib/types";
import { drawLabels, drawRoom, hitTest, ROOM } from "./office-scene";

export type ProgressStep = {
  id: string;
  name: string;
  phase: "done" | "now" | "next" | "waiting" | "stopped";
  progress: number;
};

export type TaskReadout = {
  headline: string;
  detail: string;
  conclusion: string | null;
  tone: "quiet" | "working" | "done" | "error";
  steps: ProgressStep[];
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
    const art = document.createElement("canvas");
    art.width = ROOM.w;
    art.height = ROOM.h;
    const artCtx = art.getContext("2d");
    if (!artCtx) return;
    const image = new Image();
    image.src = "/apartment.jpg?v=3";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const loop = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      if (image.complete && image.naturalWidth > 0 && rect.width > 0 && rect.height > 0) {
        drawRoom(artCtx, image);
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(art, 0, 0, width, height);
        drawLabels(
          ctx,
          live.current.agents,
          live.current.selectedId,
          now,
          reduceMotion,
          width / ROOM.w,
          height / ROOM.h,
          dpr,
        );
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="office-frame">
      <div className="office-stage">
        <div className="office-canvas-wrap">
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
      </div>
      <section className={`task-readout task-readout-${readout.tone}`} aria-live="polite">
        {readout.steps.length > 0 ? (
          <div className="task-progress" role="group" aria-label="Last task progress">
            {readout.steps.map((step) => (
              <div key={step.id} className="task-progress-seg">
                <span
                  className={`task-progress-fill is-${step.phase}`}
                  style={{ width: `${Math.round(step.progress * 100)}%` }}
                />
                <span className="task-progress-name">{step.name}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="task-readout-headline">{readout.headline}</p>
        {readout.conclusion ? <p className="task-readout-conclusion">{readout.conclusion}</p> : null}
      </section>
    </div>
  );
}
