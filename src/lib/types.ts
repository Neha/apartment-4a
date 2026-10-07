export const AGENT_IDS = [
  "leonard",
  "sheldon",
  "penny",
  "howard",
  "raj",
  "amy",
  "bernadette",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export const SPECIALIST_IDS = [
  "sheldon",
  "penny",
  "howard",
  "raj",
  "amy",
  "bernadette",
] as const;

export type SpecialistId = (typeof SPECIALIST_IDS)[number];

export type AgentStatus = "offline" | "idle" | "working" | "blocked" | "done";

export type CheckState = "open" | "done" | "failed";

export type CheckItem = {
  id: string;
  label: string;
  state: CheckState;
};

export type TaskStatus = "running" | "finished" | "error";

export type RunStatus = "running" | "finished" | "error" | "cancelled";

export type TaskRecord = {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
};

export type RunRecord = {
  id: string;
  taskId: string;
  agentId: AgentId;
  cursorRunId: string | null;
  status: RunStatus;
  thought: string;
  summary: string;
  checklist: CheckItem[];
  files: string[];
  error: string | null;
};

export type MessageRecord = {
  id: string;
  taskId: string;
  agentId: AgentId;
  text: string;
  createdAt: string;
};

export type AgentState = {
  cursorAgentId: string | null;
  status: AgentStatus;
  activity: string;
};

export type Store = {
  version: 1;
  project: {
    name: string;
    repoPath: string;
  };
  agents: Record<AgentId, AgentState>;
  tasks: TaskRecord[];
  runs: RunRecord[];
  messages: MessageRecord[];
};

export type PublicAgent = {
  id: AgentId;
  name: string;
  role: string;
  title: string;
  status: AgentStatus;
  activity: string;
  linked: boolean;
};

export type PublicRun = {
  id: string;
  agentId: AgentId;
  status: RunStatus;
  thought: string;
  summary: string;
  checklist: CheckItem[];
  files: string[];
  error: string | null;
};

export type CredentialSource = "environment" | "login" | "none";

export type PublicState = {
  project: { name: string; repoPath: string };
  keyConfigured: boolean;
  credentialSource: CredentialSource;
  accountEmail: string | null;
  loginInFlight: boolean;
  loginUrl: string | null;
  loginError: string | null;
  busy: boolean;
  agents: PublicAgent[];
  task: TaskRecord | null;
  runs: PublicRun[];
  messages: MessageRecord[];
  recentTasks: Pick<TaskRecord, "id" | "text" | "status" | "createdAt">[];
};
