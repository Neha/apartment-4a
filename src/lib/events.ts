import type { CheckItem } from "./types";

export type RunDraft = {
  thought: string;
  checklist: CheckItem[];
  files: string[];
};

export type KnownEvent =
  | { type: "assistant"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool_call";
      call_id: string;
      name: string;
      status: "running" | "completed" | "error";
      args?: unknown;
    };

const PATH_KEYS = ["path", "file_path", "filePath", "target_file", "targetFile"];

export function extractFilePath(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const record = args as Record<string, unknown>;
  for (const key of PATH_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function activityForTool(name: string): string {
  const normalized = name.toLowerCase();
  if (/(shell|bash|terminal|command)/.test(normalized)) return "Running a command";
  if (/(edit|write|strreplace|apply)/.test(normalized)) return "Editing files";
  if (/(read|grep|search|glob|list)/.test(normalized)) return "Reading the repo";
  return "Working";
}

export function applyEvent(draft: RunDraft, event: KnownEvent): string | null {
  if (event.type === "assistant") {
    draft.thought = `${draft.thought}${event.text}`.slice(-8000);
    const line = draft.thought
      .split("\n")
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith("HANDOFF:") && !part.startsWith("SUMMARY:") && part !== "---")
      .at(-1);
    return line ? line.slice(0, 90) : "Writing";
  }

  if (event.type === "thinking") return "Thinking";

  const file = extractFilePath(event.args);
  const label = file ? `${activityForTool(event.name)}: ${file}` : activityForTool(event.name);
  const state = event.status === "completed" ? "done" : event.status === "error" ? "failed" : "open";
  const existing = draft.checklist.find((item) => item.id === event.call_id);
  if (existing) {
    existing.label = label;
    existing.state = state;
  } else {
    draft.checklist.push({ id: event.call_id, label, state });
    if (draft.checklist.length > 40) draft.checklist.splice(0, draft.checklist.length - 40);
  }
  if (file && !draft.files.includes(file)) draft.files.push(file);
  return label.slice(0, 90);
}
