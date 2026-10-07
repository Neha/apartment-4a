import "server-only";
import fs from "node:fs";
import { Agent, CursorAgentError, type SDKAgent, type SDKMessage } from "@cursor/sdk";
import { accountStatus } from "./account";
import { applyEvent, type KnownEvent, type RunDraft } from "./events";
import { parseHandoff, type Handoff } from "./handoff";
import { publish } from "./hub";
import { rosterEntry } from "./roster";
import { pipelineForTask } from "./route";
import { isBusy, loadStore, setBusy, updateStore } from "./store";
import { AGENT_IDS, type AgentId, type RunRecord } from "./types";

type RunOutcome = {
  ok: boolean;
  handoff: Handoff;
};

function agentOptions(repoPath: string) {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  return {
    ...(apiKey ? { apiKey } : {}),
    model: { id: process.env.CURSOR_MODEL?.trim() || "composer-2.5" },
    local: { cwd: repoPath },
  };
}

function emptyRun(id: string, taskId: string, agentId: AgentId): RunRecord {
  return {
    id,
    taskId,
    agentId,
    cursorRunId: null,
    status: "running",
    thought: "",
    summary: "",
    checklist: [],
    files: [],
    error: null,
  };
}

function latestRun(store: { runs: RunRecord[] }, taskId: string, agentId: AgentId): RunRecord | undefined {
  return [...store.runs].reverse().find((run) => run.taskId === taskId && run.agentId === agentId);
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "The agent run failed.";
  if (/cursor_|api[_ ]?key/i.test(message)) return "Cursor rejected the credentials. Reconnect in Integrations.";
  return message.slice(0, 240);
}

function normalize(event: SDKMessage): KnownEvent | null {
  if (event.type === "assistant") {
    const text = event.message.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("");
    return text ? { type: "assistant", text } : null;
  }
  if (event.type === "thinking") return { type: "thinking", text: event.text };
  if (event.type === "tool_call") {
    return {
      type: "tool_call",
      call_id: event.call_id,
      name: event.name,
      status: event.status,
      args: event.args,
    };
  }
  return null;
}

async function dispose(agent: SDKAgent | null): Promise<void> {
  if (!agent) return;
  await agent[Symbol.asyncDispose]();
}

async function ensureRun(taskId: string, agentId: AgentId, activity: string): Promise<void> {
  await updateStore((store) => {
    store.agents[agentId].status = "working";
    store.agents[agentId].activity = activity;
    if (!latestRun(store, taskId, agentId)) {
      store.runs.push(emptyRun(crypto.randomUUID(), taskId, agentId));
    }
  });
}

function handoffNote(summary: string, nextId: AgentId | null): string {
  const text = summary.trim();
  if (!nextId) return text;
  const name = rosterEntry(nextId).name;
  return text ? `Handed this to ${name}. ${text}` : `Handed this to ${name}.`;
}

async function runAgent(
  taskId: string,
  agentId: AgentId,
  prompt: string,
  repoPath: string,
  nextId: AgentId | null,
): Promise<RunOutcome> {
  const savedId = loadStore().agents[agentId].cursorAgentId;
  let handle: SDKAgent | null = null;
  let active: Awaited<ReturnType<SDKAgent["send"]>> | null = null;
  try {
    handle = savedId
      ? await Agent.resume(savedId, agentOptions(repoPath))
      : await Agent.create(agentOptions(repoPath));

    if (!savedId) {
      const createdId = handle.agentId;
      await updateStore((store) => {
        store.agents[agentId].cursorAgentId = createdId;
      });
    }

    const run = await handle.send(prompt);
    active = run;
    console.log(`[agent-room] ${agentId} run ${run.id}`);
    await updateStore((store) => {
      const record = latestRun(store, taskId, agentId);
      if (record) record.cursorRunId = run.id;
    });

    const draft: RunDraft = { thought: "", checklist: [], files: [] };
    for await (const event of run.stream()) {
      const known = normalize(event);
      if (!known) continue;
      const activity = applyEvent(draft, known);
      await updateStore((store) => {
        const record = latestRun(store, taskId, agentId);
        if (!record) return;
        record.thought = draft.thought;
        record.checklist = structuredClone(draft.checklist);
        record.files = [...draft.files];
        if (activity) store.agents[agentId].activity = activity;
      });
    }

    const result = await run.wait();
    const finalText = result.result || draft.thought;
    const parsed = parseHandoff(finalText);
    const handoff: Handoff = agentId === "leonard" ? parsed : { agentId: null, summary: parsed.summary };
    const failed = result.status !== "finished";
    const failure = failed ? (result.error?.message ?? "The run failed.") : null;

    await updateStore((store) => {
      const record = latestRun(store, taskId, agentId);
      if (record) {
        record.thought = finalText;
        record.summary = handoff.summary;
        record.status = result.status === "finished" ? "finished" : result.status === "cancelled" ? "cancelled" : "error";
        record.error = failure;
        record.checklist = draft.checklist.map((item) =>
          !failed && item.state === "open" ? { ...item, state: "done" as const } : item,
        );
        record.files = [...draft.files];
      }
      store.agents[agentId].status = failed ? "blocked" : "idle";
      store.agents[agentId].activity = failed ? (failure ?? "Blocked").slice(0, 90) : "";
      const note = handoffNote(handoff.summary, !failed ? (nextId ?? handoff.agentId) : null);
      if (note) {
        store.messages.push({
          id: crypto.randomUUID(),
          taskId,
          agentId,
          text: note,
          createdAt: new Date().toISOString(),
        });
      }
    });

    return { ok: !failed, handoff };
  } catch (error) {
    if (active?.supports("wait")) await active.wait().catch(() => undefined);
    const message = safeMessage(error);
    const retryable = error instanceof CursorAgentError ? error.isRetryable : false;
    console.error(`[agent-room] ${agentId} failed`, message, `retryable=${retryable}`);
    await updateStore((store) => {
      const record = latestRun(store, taskId, agentId);
      if (record && record.status === "running") {
        record.status = "error";
        record.error = message;
      }
      store.agents[agentId].status = "blocked";
      store.agents[agentId].activity = message;
    });
    return { ok: false, handoff: { agentId: null, summary: "" } };
  } finally {
    await dispose(handle);
  }
}

async function markTask(taskId: string, status: "finished" | "error"): Promise<void> {
  await updateStore((store) => {
    const task = store.tasks.find((item) => item.id === taskId);
    if (task && task.status === "running") task.status = status;
  });
}

async function runPipeline(taskId: string, taskText: string, repoPath: string): Promise<void> {
  try {
    const specialists = pipelineForTask(taskText).filter((id) => id !== "leonard" && id !== "bernadette");
    const teamLine =
      specialists.length > 0
        ? `The server will run these teammates after you, in order: ${specialists.join(", ")}. Bernadette explains the result to the user after that. Write the plan only. Do not produce the final deliverable.`
        : "Do this task yourself. Bernadette explains the result to the user afterwards.";
    const leadPrompt = `${rosterEntry("leonard").prompt}\n\n${teamLine}\n\nTask:\n${taskText}`;
    const follow = [...specialists];
    const lead = await runAgent(taskId, "leonard", leadPrompt, repoPath, specialists[0] ?? "bernadette");
    if (!lead.ok) {
      await markTask(taskId, "error");
      return;
    }
    if (lead.handoff.agentId && lead.handoff.agentId !== "bernadette" && !follow.includes(lead.handoff.agentId)) {
      follow.push(lead.handoff.agentId);
    }

    let notes = lead.handoff.summary;
    for (let index = 0; index < follow.length; index += 1) {
      const specialistId = follow[index];
      const nextId = follow[index + 1] ?? "bernadette";
      await ensureRun(taskId, specialistId, "Picking up the handoff");
      const specialist = rosterEntry(specialistId);
      const prompt = `${specialist.prompt}\n\nOriginal task:\n${taskText}\n\nNotes so far:\n${notes || "Leonard finished the plan."}`;
      const followUp = await runAgent(taskId, specialistId, prompt, repoPath, nextId);
      if (!followUp.ok) {
        await markTask(taskId, "error");
        return;
      }
      if (followUp.handoff.summary) notes = `${notes}\n${followUp.handoff.summary}`.trim();
    }
    await ensureRun(taskId, "bernadette", "Writing the conclusion");
    const closing = await runAgent(
      taskId,
      "bernadette",
      `You are Bernadette, the project manager. The team finished a task. Do not change files. Tell the user what happened, in everyday language.

Write two or three short sentences: what they asked for, what the team actually did, and the next step. No jargon and no code.

Original task:
${taskText}

Notes from the team:
${notes || "The team finished without extra notes."}

End your reply with a trailer in exactly this shape, and write nothing after it:

---
SUMMARY: the same conclusion in two sentences a person can act on

Do not hand this task to anyone else.`,
      repoPath,
      null,
    );
    if (!closing.ok) {
      await markTask(taskId, "error");
      return;
    }
    await markTask(taskId, "finished");
  } catch (error) {
    console.error("[agent-room] pipeline failed", safeMessage(error));
    await updateStore((store) => {
      const task = store.tasks.find((item) => item.id === taskId);
      if (task && task.status === "running") task.status = "error";
      for (const id of AGENT_IDS) {
        if (store.agents[id].status === "working") {
          store.agents[id].status = "blocked";
          store.agents[id].activity = "The task stopped unexpectedly.";
        }
      }
    });
  } finally {
    setBusy(false);
    publish();
  }
}

export async function assignTask(text: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, status: 400, error: "Write a task first." };
  if (trimmed.length > 4000) return { ok: false, status: 400, error: "Keep the task under 4000 characters." };

  const account = await accountStatus();
  if (!account.keyConfigured) {
    return {
      ok: false,
      status: 400,
      error: "Connect Cursor in Integrations, or set CURSOR_API_KEY in .env.local and restart.",
    };
  }

  const repoPath = loadStore().project.repoPath;
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    return { ok: false, status: 400, error: "The project folder on this computer does not exist." };
  }

  const taskId = crypto.randomUUID();
  let started = false;
  await updateStore((store) => {
    if (isBusy()) return;
    setBusy(true);
    started = true;
    for (const id of AGENT_IDS) {
      store.agents[id].status = "idle";
      store.agents[id].activity = "";
    }
    store.agents.leonard.status = "working";
    store.agents.leonard.activity = "Reviewing the task";
    store.tasks.push({
      id: taskId,
      text: trimmed,
      status: "running",
      createdAt: new Date().toISOString(),
    });
    store.runs.push(emptyRun(crypto.randomUUID(), taskId, "leonard"));
  });

  if (!started) {
    return { ok: false, status: 409, error: "The team is already working on a task." };
  }

  void runPipeline(taskId, trimmed, repoPath);
  return { ok: true };
}
