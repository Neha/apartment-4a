import "server-only";
import fs from "node:fs";
import path from "node:path";
import { databaseUrl, readStateDocument, writeStateDocument } from "./db";
import { publish } from "./hub";
import { ROSTER } from "./roster";
import { visibleThought } from "./handoff";
import {
  AGENT_IDS,
  type AgentId,
  type AgentState,
  type CredentialSource,
  type PublicState,
  type Store,
} from "./types";

type Runtime = {
  queue: Promise<unknown>;
  busy: boolean;
};

const globalRuntime = globalThis as unknown as { agentRoomRuntime?: Runtime };

function runtime(): Runtime {
  if (!globalRuntime.agentRoomRuntime) {
    globalRuntime.agentRoomRuntime = { queue: Promise.resolve(), busy: false };
  }
  return globalRuntime.agentRoomRuntime;
}

export function isBusy(): boolean {
  return runtime().busy;
}

export function setBusy(busy: boolean): void {
  runtime().busy = busy;
}

const dataDir = path.join(process.cwd(), "data");
const storeFile = path.join(dataDir, "store.json");

function defaultRepoPath(): string {
  return path.join(process.cwd(), "workspace");
}

function freshAgent(): AgentState {
  return { cursorAgentId: null, status: "idle", activity: "" };
}

function freshStore(): Store {
  const agents = Object.fromEntries(AGENT_IDS.map((id) => [id, freshAgent()])) as Store["agents"];
  return {
    version: 1,
    project: { name: "Apartment 4A", repoPath: defaultRepoPath() },
    agents,
    tasks: [],
    runs: [],
    messages: [],
  };
}

function normalize(raw: Partial<Store> | null): Store {
  const base = freshStore();
  if (!raw || raw.version !== 1) return base;
  const agents = { ...base.agents };
  for (const id of AGENT_IDS) {
    const saved = raw.agents?.[id];
    if (!saved) continue;
    const status = saved.status === "offline" ? "idle" : saved.status;
    agents[id] = {
      cursorAgentId: typeof saved.cursorAgentId === "string" ? saved.cursorAgentId : null,
      status: status === "working" || status === "blocked" || status === "done" || status === "idle" ? status : "idle",
      activity: saved.activity || "",
    };
  }
  return {
    version: 1,
    project: {
      name: raw.project?.name?.trim() || base.project.name,
      repoPath: raw.project?.repoPath?.trim() || base.project.repoPath,
    },
    agents,
    tasks: Array.isArray(raw.tasks) ? raw.tasks.slice(-40) : [],
    runs: Array.isArray(raw.runs) ? raw.runs.slice(-80) : [],
    messages: Array.isArray(raw.messages) ? raw.messages.slice(-100) : [],
  };
}

let recoveredThisProcess = false;

/** A working agent only exists while this process is running the task. */
function recoverInterruptedWork(store: Store): boolean {
  let changed = false;
  for (const id of AGENT_IDS) {
    if (store.agents[id].status !== "working") continue;
    store.agents[id].status = "blocked";
    store.agents[id].activity = "Stopped when the app restarted";
    changed = true;
  }
  for (const task of store.tasks) {
    if (task.status !== "running") continue;
    task.status = "error";
    changed = true;
  }
  for (const run of store.runs) {
    if (run.status !== "running") continue;
    run.status = "error";
    run.error = run.error ?? "Stopped when the app restarted";
    changed = true;
  }
  return changed;
}

let opening: Promise<void> | null = null;

function readFileStore(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(storeFile, "utf8")) as Partial<Store>;
    return normalize(raw);
  } catch {
    return freshStore();
  }
}

async function readPersistedStore(): Promise<Store> {
  if (!databaseUrl()) return readFileStore();
  const saved = await readStateDocument();
  if (saved) return normalize(saved);
  const seeded = readFileStore();
  await writeStateDocument(seeded, null);
  return seeded;
}

function ensureOpen(): Promise<void> {
  if (recoveredThisProcess) return Promise.resolve();
  if (!opening) {
    opening = (async () => {
      const store = await readPersistedStore();
      const before = structuredClone(store);
      if (recoverInterruptedWork(store)) await saveStore(store, before);
      recoveredThisProcess = true;
    })().catch((error: unknown) => {
      opening = null;
      throw error;
    });
  }
  return opening;
}

export async function loadStore(): Promise<Store> {
  await ensureOpen();
  return readPersistedStore();
}

async function saveStore(store: Store, before: Store | null = null): Promise<void> {
  if (databaseUrl()) {
    await writeStateDocument(store, before);
    return;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const temp = `${storeFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, storeFile);
}

export function updateStore<T>(mutator: (store: Store) => T): Promise<T> {
  const current = runtime();
  const job = current.queue.then(async () => {
    const store = await loadStore();
    const before = structuredClone(store);
    const result = mutator(store);
    await saveStore(store, before);
    publish();
    return result;
  });
  current.queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

export function clearHistory(): Promise<{ ok: true } | { ok: false; error: string }> {
  return updateStore((store) => {
    if (isBusy() || store.tasks.some((task) => task.status === "running")) {
      return { ok: false as const, error: "Wait until the current task finishes." };
    }
    store.tasks = [];
    store.runs = [];
    store.messages = [];
    for (const id of AGENT_IDS) {
      store.agents[id].status = "idle";
      store.agents[id].activity = "";
    }
    return { ok: true as const };
  });
}

export function toPublicState(
  store: Store,
  account: {
    keyConfigured: boolean;
    credentialSource: CredentialSource;
    email: string | null;
    loginInFlight: boolean;
    loginUrl: string | null;
    loginError: string | null;
  },
): PublicState {
  const latest = store.tasks.at(-1) ?? null;
  const task = latest && latest.status !== "finished" ? latest : null;
  const focusId = task?.id ?? latest?.id ?? null;
  const runs = focusId ? store.runs.filter((run) => run.taskId === focusId) : [];
  return {
    project: store.project,
    latestTask: latest
      ? { id: latest.id, text: latest.text, status: latest.status, createdAt: latest.createdAt }
      : null,
    keyConfigured: account.keyConfigured,
    credentialSource: account.credentialSource,
    accountEmail: account.email,
    loginInFlight: account.loginInFlight,
    loginUrl: account.loginUrl,
    loginError: account.loginError,
    busy: isBusy(),
    agents: ROSTER.map((entry) => {
      const saved = store.agents[entry.id as AgentId];
      const status = account.keyConfigured ? saved.status : "offline";
      return {
        id: entry.id,
        name: entry.name,
        role: entry.role,
        title: entry.title,
        status,
        activity: status === "offline" ? "" : saved.activity,
        linked: Boolean(saved.cursorAgentId),
      };
    }),
    task,
    runs: runs.map((run) => ({
      id: run.id,
      agentId: run.agentId,
      status: run.status,
      thought: visibleThought(run.thought),
      summary: run.summary,
      checklist: run.checklist,
      files: run.files,
      error: run.error,
    })),
    messages: store.messages.slice(-30).map((message) => ({
      ...message,
      taskText: store.tasks.find((item) => item.id === message.taskId)?.text ?? "Earlier task",
    })),
    recentTasks: store.tasks.slice(-8).reverse().map((item) => ({
      id: item.id,
      text: item.text,
      status: item.status,
      createdAt: item.createdAt,
    })),
  };
}
