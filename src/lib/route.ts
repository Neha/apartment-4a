import type { SpecialistId } from "./types";

const MAX_SPECIALISTS = 3;

function add(order: SpecialistId[], id: SpecialistId): void {
  if (!order.includes(id) && order.length < MAX_SPECIALISTS) order.push(id);
}

/** Picks teammates from the task text. The user never names agents. */
export function specialistsForTask(text: string): SpecialistId[] {
  const task = text.toLowerCase();
  const order: SpecialistId[] = [];
  const asksOnly = /^(what|who|why|how|when|where)\b/.test(task.trim());
  const asksForWork = /\b(write|add|create|implement|fix|plan|draft|update)\b/.test(task);
  if (asksOnly && !asksForWork) return [];

  const writesDoc = /\b(note|readme|document|docs|page|draft)\b/.test(task) && /\b(write|add|create|draft|plan)\b/.test(task);
  if (writesDoc) {
    add(order, "sheldon");
    add(order, "penny");
    add(order, "amy");
    return order;
  }

  if (/\b(structure|architecture|design|outline)\b/.test(task)) add(order, "sheldon");
  if (/\b(ux|requirement|wording|copy|user-facing)\b/.test(task)) add(order, "penny");
  if (/\b(build|ci|deploy|script|pipeline)\b/.test(task)) add(order, "howard");
  if (/\b(bug|debug|log|crash|failing)\b/.test(task)) add(order, "raj");
  if (/\b(test|check|verify|missing|qa)\b/.test(task)) add(order, "amy");
  if (/\b(status|progress|schedule|tracker)\b/.test(task)) add(order, "bernadette");
  return order;
}
