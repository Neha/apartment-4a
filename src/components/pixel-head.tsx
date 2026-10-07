import type { AgentId } from "../lib/types";

export function PixelHead({ id, large = false }: { id: AgentId; large?: boolean }) {
  return (
    <img
      src={`/heads/${id}.png`}
      alt=""
      className={large ? "pixel-head pixel-head-lg" : "pixel-head"}
    />
  );
}
