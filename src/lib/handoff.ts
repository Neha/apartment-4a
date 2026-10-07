import { SPECIALIST_IDS, type SpecialistId } from "./types";

export type Handoff = {
  agentId: SpecialistId | null;
  summary: string;
};

const SPECIALIST_SET = new Set<string>(SPECIALIST_IDS);

export function parseHandoff(text: string): Handoff {
  const handoffs = [...text.matchAll(/^HANDOFF:\s*([a-z]+)\s*$/gim)];
  const summaries = [...text.matchAll(/^SUMMARY:\s*(.+)\s*$/gim)];
  const rawId = handoffs.at(-1)?.[1]?.toLowerCase() ?? "none";
  const agentId = SPECIALIST_SET.has(rawId) ? (rawId as SpecialistId) : null;
  const summary = summaries.at(-1)?.[1]?.trim() || visibleThought(text).slice(0, 400);
  return { agentId, summary };
}

export function visibleThought(text: string): string {
  const marker = text.lastIndexOf("\n---");
  const cut = marker >= 0 ? text.slice(0, marker) : text;
  return cut.trim().slice(-1600);
}
