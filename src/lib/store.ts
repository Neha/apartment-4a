import "server-only";
import fs from "node:fs";
import path from "node:path";
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
    const status = saved.status === "working" ? "blocked" : saved.status;
    agents[id] = {
      cursorAgentId: typeof saved.cursorAgentId === "string" ? saved.cursorAgentId : null,
      status: status === "offline" ? "idle" : status,
      activity: saved.status === "working" ? "Stopped when the app restarted" : saved.activity || "",
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

export function loadStore(): Store {
  try {
    const raw = JSON.parse(fs.readFileSync(storeFile, "utf8")) as Partial<Store>;
    return normalize(raw);
  } catch {
    return freshStore();
  }
}

function saveStore(store: Store): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const temp = `${storeFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, storeFile);
}

export function updateStore<T>(mutator: (store: Store) => T): Promise<T> {
  const current = runtime();
  const job = current.queue.then(() => {
    const store = loadStore();
    const result = mutator(store);
    saveStore(store);
    publish();
    return result;
  });
  current.queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
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
  const runs = task ? store.runs.filter((run) => run.taskId === task.id) : [];
  return {
    project: store.project,
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
    messages: store.messages.slice(-30),
    recentTasks: store.tasks.slice(-8).reverse().map((item) => ({
      id: item.id,
      text: item.text,
      status: item.status,
      createdAt: item.createdAt,
    })),
  };
}
