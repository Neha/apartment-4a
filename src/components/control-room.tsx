"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { pipelineForTask, specialistsForTask } from "../lib/route";
import { AGENT_IDS, type AgentId, type PublicAgent, type PublicRun, type PublicState, type TaskRecord } from "../lib/types";
import { Inspector } from "./inspector";
import { Office, type TaskReadout } from "./office";
import { PixelHead } from "./pixel-head";

type View = "room" | "project" | "integrations";

const STAR_WARS_NAMES = [
  "Luke Skywalker",
  "Leia Organa",
  "Han Solo",
  "Chewbacca",
  "Obi-Wan Kenobi",
  "Darth Vader",
  "Yoda",
  "Padmé Amidala",
  "Anakin Skywalker",
  "Rey",
  "Finn",
  "Poe Dameron",
  "Lando Calrissian",
  "Ahsoka Tano",
  "Grogu",
  "Mace Windu",
  "Qui-Gon Jinn",
  "R2-D2",
  "C-3PO",
  "Boba Fett",
];

function pickWelcomeName(): string {
  const pick = () => STAR_WARS_NAMES[Math.floor(Math.random() * STAR_WARS_NAMES.length)];
  try {
    const key = "apartment-welcome-name";
    const stored = sessionStorage.getItem(key);
    if (stored && STAR_WARS_NAMES.includes(stored)) return stored;
    const name = pick();
    sessionStorage.setItem(key, name);
    return name;
  } catch {
    return pick();
  }
}

export function ControlRoom() {
  const [state, setState] = useState<PublicState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState("leonard");
  const [view, setView] = useState<View>("room");
  const [draft, setDraft] = useState("");
  const [taskFieldReady, setTaskFieldReady] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [clock, setClock] = useState("");
  const [welcomeName, setWelcomeName] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("The team state could not be loaded.");
      const next = (await response.json()) as PublicState;
      setState(next);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The team state could not be loaded.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const source = new EventSource("/api/events");
    source.onmessage = () => void refresh();
    const poll = window.setInterval(() => void refresh(), 2000);
    return () => {
      source.close();
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    setWelcomeName(pickWelcomeName());
  }, []);

  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date());
    setClock(format());
    const timer = window.setInterval(() => setClock(format()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const agent of state?.agents ?? []) map[agent.id] = agent.name;
    return map;
  }, [state]);

  const workingId = state?.agents.find((agent) => agent.status === "working")?.id ?? null;
  useEffect(() => {
    if (workingId) setSelected(workingId);
  }, [workingId]);

  const selectedAgent = state?.agents.find((agent) => agent.id === selected) ?? state?.agents[0];
  const selectedRun = state?.runs.find((run) => run.agentId === selectedAgent?.id);
  const team = teamSummary(state?.agents);
  const queue = queueFor(state);
  const nextStep = nextStepFor(state, queue);

  async function assign(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setFormError(body?.error ?? "The task could not be assigned.");
        return;
      }
      setDraft("");
      setSelected("leonard");
      setView("room");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function clearHistory() {
    setHistoryError(null);
    setClearing(true);
    try {
      const response = await fetch("/api/tasks", { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setHistoryError(body?.error ?? "History could not be cleared.");
        return;
      }
      setConfirmClear(false);
      await refresh();
    } finally {
      setClearing(false);
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    window.location.assign("/login");
  }

  async function connect() {
    setFormError(null);
    const response = await fetch("/api/connect", { method: "POST" });
    if (!response.ok) setFormError("Cursor login could not start.");
    await refresh();
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img className="mark" src="/logo.svg" alt="" />
          <div>
            <strong>Apartment 4A</strong>
            <span>BazingaAI</span>
          </div>
        </div>
        <nav className="top-nav" aria-label="Main">
          <button type="button" className={view === "room" ? "top-link top-link-on" : "top-link"} onClick={() => setView("room")}>
            Apartment
          </button>
          <button type="button" className={view === "project" ? "top-link top-link-on" : "top-link"} onClick={() => setView("project")}>
            Tasks
          </button>
        </nav>
        <div className="top-meta">
          <span className="online-count" title={team.title}>
            <i className={team.dotClass} />
            {team.text}
          </span>
          <time>{clock}</time>
          {welcomeName ? <p className="welcome">Welcome, {welcomeName}</p> : null}
          <button type="button" className="sign-out" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <section className="queue" aria-label="Task queue">
            <TaskPanel
              state={state}
              queue={queue}
              selectedId={selectedAgent?.id}
              nextStep={nextStep}
              onHistory={() => setView("project")}
              onSelect={(id) => {
                setSelected(id);
                setView("room");
              }}
            />
          </section>
          <div className="side-label">
            <h2>AI Team</h2>
            <span title={team.title}>{team.text}</span>
          </div>
          <ul className="roster">
            {(state?.agents ?? []).map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  className={agent.id === selectedAgent?.id ? "roster-button selected" : "roster-button"}
                  onClick={() => {
                    setSelected(agent.id);
                    setView("room");
                  }}
                >
                  <PixelHead id={agent.id} />
                  <span>
                    <strong>{agent.name}</strong>
                    <small>{agent.role}</small>
                  </span>
                  <i className={`dot dot-${agent.status}`} title={agent.status} />
                </button>
              </li>
            ))}
          </ul>
          <nav className="side-nav">
            <button type="button" onClick={() => setView("project")}>
              Project
            </button>
            <button type="button" onClick={() => setView("integrations")}>
              Integrations
            </button>
          </nav>
          <p className="side-foot">
            <span className="side-foot-links">
              <Link href="/about">About</Link>
              <Link href="/privacy">Privacy</Link>
              <a href="https://github.com/Neha/apartment-4a" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </span>
            <span>© 2026 Neha Sharma</span>
            <span className="side-foot-links">
              <a href="https://www.linkedin.com/in/nehha/" rel="noreferrer">LinkedIn</a>
              <a href="https://x.com/hellonehha" rel="noreferrer">X</a>
            </span>
          </p>
        </aside>

        <main className="stage">
          {loadError ? <p className="banner">{loadError}</p> : null}
          {!state ? <p className="stage-empty">Loading the team…</p> : null}
          {state && view === "room" ? (
            <Office
              agents={state.agents}
              selectedId={selectedAgent?.id ?? "leonard"}
              readout={{
                ...readoutFor(state, names, nextStep),
                steps: queue.map((step) => ({
                  id: step.agent.id,
                  name: step.agent.name,
                  phase: step.phase,
                  progress: step.progress,
                })),
              }}
              onSelect={(id) => setSelected(id)}
            />
          ) : null}
          {state && view === "project" ? (
            <section className="panel">
              <h2>{state.project.name}</h2>
              <div className="history-head">
                <h3>Recent tasks</h3>
                {confirmClear ? (
                  <div className="history-confirm">
                    <button type="button" className="clear-history" disabled={clearing} onClick={() => void clearHistory()}>
                      {clearing ? "Clearing…" : "Clear"}
                    </button>
                    <button type="button" className="history-cancel" disabled={clearing} onClick={() => setConfirmClear(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="clear-history"
                    disabled={state.recentTasks.length === 0 || state.busy}
                    onClick={() => {
                      setHistoryError(null);
                      setConfirmClear(true);
                    }}
                  >
                    Clear history
                  </button>
                )}
              </div>
              <p className="muted">
                {confirmClear
                  ? "This removes every saved task and the discussion. The team stays connected."
                  : "This list shows the latest 8 tasks. The app keeps the latest 40. Nothing expires by date or time. When a 41st task is saved, the oldest one is dropped."}
              </p>
              {historyError ? <p className="form-error">{historyError}</p> : null}
              {state.recentTasks.length === 0 ? <p className="muted">No tasks yet. A first task will show up here with the date and time it was assigned.</p> : null}
              <ul className="task-list">
                {state.recentTasks.map((task) => (
                  <li key={task.id}>
                    <span className={`status-pill status-${task.status === "running" ? "working" : task.status === "error" ? "blocked" : "done"}`}>
                      {task.status}
                    </span>
                    <span>
                      <span className="task-line">{task.text}</span>
                      <time dateTime={task.createdAt}>{formatWhen(task.createdAt)}</time>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {state && view === "integrations" ? (
            <section className="panel">
              <h2>Cursor agents</h2>
              <p>
                {state.keyConfigured
                  ? state.credentialSource === "environment"
                    ? "The server is using CURSOR_API_KEY."
                    : `Signed in${state.accountEmail ? ` as ${state.accountEmail}` : ""}.`
                  : "The team stays offline until Cursor is connected."}
              </p>
              <p className="muted">
                The first task creates a local agent for Leonard and stores the id. A specialist is created the same way, the first time Leonard hands work to them. Later tasks resume those agents.
              </p>
              {state.loginInFlight ? <p>Waiting for the browser login to finish.</p> : null}
              {state.loginUrl ? (
                <p>
                  <a href={state.loginUrl}>Open the Cursor login</a> if the browser did not.
                </p>
              ) : null}
              {state.loginError ? <p className="form-error">{state.loginError}</p> : null}
              <button type="button" className="primary" onClick={() => void connect()} disabled={state.keyConfigured || state.loginInFlight}>
                {state.keyConfigured ? "Connected" : state.loginInFlight ? "Waiting for login" : "Connect Cursor"}
              </button>
            </section>
          ) : null}
          <form className="composer" autoComplete="off" onSubmit={(event) => void assign(event)}>
            <p className="composer-label">
              <span aria-hidden="true">◆</span> Give your team a task...
            </p>
            <div className="composer-row">
              <label className="sr-only" htmlFor="apartment-task">
                Give your team a task
              </label>
              <input
                id="apartment-task"
                name="apartment-task"
                autoComplete="off"
                readOnly={!taskFieldReady}
                onFocus={() => setTaskFieldReady(true)}
                value={draft}
                placeholder="e.g. Review PR #128, fix CI, and missing tests..."
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="assign-button" disabled={pending || state?.busy || !draft.trim()}>
                <span aria-hidden="true">▶</span>
                {state?.busy ? "Working" : "Assign Task"}
              </button>
            </div>
            <p className="composer-hints">
              {TASK_HINTS.map((hint, index) => (
                <span key={hint}>
                  {index > 0 ? <span className="hint-dot"> · </span> : null}
                  <button type="button" onClick={() => setDraft(hint)}>
                    {hint}
                  </button>
                </span>
              ))}
            </p>
            {formError ? <p className="form-error">{formError}</p> : null}
            {state && !state.keyConfigured ? (
              <p className="form-error">Connect Cursor in Integrations before assigning a task.</p>
            ) : null}
          </form>
        </main>

        {state ? (
          <Inspector
            agent={selectedAgent}
            task={state.task ?? state.latestTask}
            run={selectedRun}
            messages={state.messages}
            names={names}
          />
        ) : (
          <aside className="inspector" />
        )}
      </div>
    </div>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function TaskPanel({
  state,
  queue,
  selectedId,
  nextStep,
  onHistory,
  onSelect,
}: {
  state: PublicState | null;
  queue: QueueStep[];
  selectedId: string | undefined;
  nextStep: string;
  onHistory: () => void;
  onSelect: (id: AgentId) => void;
}) {
  const latest = state?.latestTask ?? null;

  if (!state?.task && !latest) {
    return (
      <>
        <div className="side-label">
          <h2>Start here</h2>
        </div>
        <p className="queue-task">No task yet.</p>
        <p className="queue-empty">Type one below.</p>
      </>
    );
  }

  if (!state?.task && latest) {
    return (
      <>
        <div className="side-label">
          <h2 className="with-icon">
            <LastTaskIcon />
            Last task
          </h2>
        </div>
        <p className="queue-task" title={latest.text}>{latest.text}</p>
        <p className="queue-empty">{formatWhen(latest.createdAt)}</p>
        {queue.length > 0 ? (
          <ol className="queue-list">
            {queue.map((step) => (
              <li key={step.agent.id}>
                <button
                  type="button"
                  className={step.agent.id === selectedId ? `queue-row queue-${step.phase} selected` : `queue-row queue-${step.phase}`}
                  onClick={() => onSelect(step.agent.id)}
                >
                  <span className="queue-index">{step.index}</span>
                  <PixelHead id={step.agent.id} />
                  <span>
                    <strong>{step.agent.name}</strong>
                    <small>{step.slice}</small>
                  </span>
                  <em className={`queue-phase queue-phase-${step.phase}`}>{phaseLabel(step.phase)}</em>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        <p className="queue-next">{nextStep}</p>
        <button type="button" className="queue-history" onClick={onHistory}>
          Task history
        </button>
      </>
    );
  }

  return (
    <>
      <div className="side-label">
        <h2>In progress</h2>
        <span>{queue.filter((step) => step.phase === "done").length}/{queue.length || 0}</span>
      </div>
      <p className="queue-task">{state?.task?.text}</p>
      <ol className="queue-list">
        {queue.map((step) => (
          <li key={step.agent.id}>
            <button
              type="button"
              className={step.agent.id === selectedId ? `queue-row queue-${step.phase} selected` : `queue-row queue-${step.phase}`}
              onClick={() => onSelect(step.agent.id)}
            >
              <span className="queue-index">{step.index}</span>
              <PixelHead id={step.agent.id} />
              <span>
                <strong>{step.agent.name}</strong>
                <small>{step.slice}</small>
              </span>
              <em className={`queue-phase queue-phase-${step.phase}`}>{phaseLabel(step.phase)}</em>
            </button>
          </li>
        ))}
      </ol>
      <p className="queue-next">{nextStep}</p>
    </>
  );
}

function teamSummary(agents: PublicAgent[] | undefined): { text: string; dotClass: string; title: string } {
  const list = agents ?? [];
  const total = list.length;
  if (total === 0) return { text: "0 connected", dotClass: "dot", title: "Not connected" };
  let idle = 0;
  let working = 0;
  let blocked = 0;
  let done = 0;
  let offline = 0;
  for (const agent of list) {
    if (agent.status === "working") working += 1;
    else if (agent.status === "blocked") blocked += 1;
    else if (agent.status === "done") done += 1;
    else if (agent.status === "offline") offline += 1;
    else idle += 1;
  }
  if (offline === total) return { text: `0/${total} connected`, dotClass: "dot", title: "Cursor is not connected" };
  if (working > 0) return { text: `${working} working`, dotClass: "dot dot-working", title: `${working} working, ${idle} idle` };
  if (blocked > 0) return { text: `${blocked} blocked`, dotClass: "dot dot-blocked", title: `${blocked} blocked` };
  if (idle === total) return { text: `${total} idle`, dotClass: "dot dot-idle", title: "Connected, waiting for a task" };
  if (done > 0 && idle === 0 && offline === 0) return { text: `${done} done`, dotClass: "dot dot-done", title: "Finished" };
  return { text: `${total - offline}/${total} idle`, dotClass: "dot dot-idle", title: "Connected and idle" };
}

function LastTaskIcon() {
  return (
    <svg className="section-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 8.2 7 10l3.8-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TASK_HINTS = [
  "Review this PR",
  "Implement dark mode",
  "Fix failing tests",
  "Investigate production issue",
];

const SLICE: Record<AgentId, string> = {
  leonard: "Plan",
  sheldon: "Structure",
  penny: "Product",
  howard: "Build",
  raj: "Debugging",
  amy: "Check",
  bernadette: "Code",
};

type QueuePhase = "done" | "now" | "next" | "waiting" | "stopped";

type QueueStep = {
  index: number;
  agent: PublicAgent;
  slice: string;
  phase: QueuePhase;
  progress: number;
};

function isAgentId(id: string): id is AgentId {
  return (AGENT_IDS as readonly string[]).includes(id);
}

function queueFor(state: PublicState | null): QueueStep[] {
  const task = state?.task ?? state?.latestTask ?? null;
  if (!state || !task) return [];
  const runs = new Map<string, PublicRun>();
  for (const run of state.runs) runs.set(run.agentId, run);
  const mentioned = new Set(
    state.messages.filter((message) => message.taskId === task.id).map((message) => message.agentId),
  );
  const planned = pipelineForTask(task.text);
  const pennyCloses = !specialistsForTask(task.text).includes("penny");
  const seen = new Set<string>(planned);
  const extras: AgentId[] = [];
  for (const id of [...runs.keys(), ...mentioned]) {
    if (seen.has(id) || !isAgentId(id)) continue;
    seen.add(id);
    extras.push(id);
  }
  const withCloser: AgentId[] = pennyCloses
    ? [...planned.filter((id) => id !== "penny"), ...extras, "penny"]
    : [...planned, ...extras];
  const ids =
    task.status === "running"
      ? withCloser
      : withCloser.filter((id) => runs.has(id) || mentioned.has(id));
  let namedNext = false;
  return ids.flatMap((id, index) => {
    const agent = state.agents.find((item) => item.id === id);
    if (!agent) return [];
    const run = runs.get(id);
    let phase: QueuePhase;
    if (run?.status === "error") phase = "stopped";
    else if (agent.status === "blocked" && run?.status !== "finished") phase = "stopped";
    else if (run?.status === "finished" || (task.status !== "running" && mentioned.has(id))) phase = "done";
    else if (agent.status === "working" || run?.status === "running") phase = "now";
    else if (!namedNext) {
      phase = "next";
      namedNext = true;
    } else phase = "waiting";
    const slice = id === "penny" && pennyCloses && index === ids.length - 1 ? "Conclusion" : SLICE[id];
    return [{ index: index + 1, agent, slice, phase, progress: stepProgress(phase, run) }];
  });
}

function stepProgress(phase: QueuePhase, run: PublicRun | undefined): number {
  if (phase === "done" || phase === "stopped") return 1;
  if (phase !== "now") return 0;
  const items = run?.checklist ?? [];
  const finished = items.filter((item) => item.state === "done").length;
  if (items.length === 0) return 0.45;
  return Math.max(0.2, Math.min(0.9, finished / items.length));
}

function phaseLabel(phase: QueuePhase): string {
  if (phase === "now") return "Now";
  if (phase === "next") return "Up next";
  if (phase === "waiting") return "Waiting";
  if (phase === "stopped") return "Stopped";
  return "Done";
}

function nextStepFor(state: PublicState | null, steps: QueueStep[]): string {
  const task: TaskRecord | null = state?.task ?? null;
  if (!task && !state?.latestTask) return "Type the first task below. You do not name anyone. The wording decides who works.";
  if (!task) {
    const done = steps.filter((step) => step.phase === "done");
    const last = done.at(-1);
    const summary = last
      ? [...(state?.runs ?? [])].reverse().find((run) => run.agentId === last.agent.id && run.summary.trim())?.summary.trim()
      : "";
    if (summary) return summary;
    if (done.length > 1) {
      return `${done[0].agent.name} handed this to ${done.slice(1).map((step) => step.agent.name).join(", then ")}.`;
    }
    if (done.length === 1) return `${done[0].agent.name} finished this task.`;
    return "Assign the next task below. Earlier tasks stay under Tasks.";
  }
  const now = steps.find((step) => step.phase === "now");
  const next = steps.find((step) => step.phase === "next");
  const stopped = steps.find((step) => step.phase === "stopped");
  if (task.status === "error") {
    return stopped
      ? `${stopped.agent.name} stopped on ${stopped.slice}. Read the error on the right, then assign the task again.`
      : "The task stopped. Read the error on the right, then assign it again.";
  }
  if (now && next) return `${now.agent.name} is on ${now.slice}. Next, ${next.agent.name} takes ${next.slice}.`;
  if (now) return `${now.agent.name} is on ${now.slice}. That is the last step on this task.`;
  if (next) return `Up next: ${next.agent.name} takes ${next.slice}.`;
  if (task.status === "finished") return "This task is finished. Assign another task below when you want the team to continue.";
  return "Waiting for the team.";
}

function readoutFor(state: PublicState, names: Record<string, string>, nextStep: string): TaskReadout {
  const task = state.task;
  if (!task) {
    const latest = state.latestTask;
    if (!latest) {
      return {
        headline: "Welcome in",
        detail: "No task yet. Type the first one below.",
        conclusion: nextStep,
        steps: [],
      tone: "quiet",
      };
    }
    const penny = state.runs.find((run) => run.agentId === "penny" && run.summary.trim());
    return {
      headline: "Last task",
      detail: latest.text,
      conclusion: penny?.summary.trim() || nextStep,
      steps: [],
      tone: latest.status === "finished" ? "done" : "quiet",
    };
  }
  const notes = state.runs.filter((run) => run.status === "finished");
  const worker = state.agents.find((agent) => agent.status === "working");
  const blocked = state.agents.find((agent) => agent.status === "blocked");
  if (task.status === "error") {
    return {
      headline: blocked ? `${blocked.name} stopped` : "The task stopped",
      detail: task.text,
      conclusion: nextStep,
      steps: [],
      tone: "error",
    };
  }
  if (task.status === "running") {
    const penny = state.runs.find((run) => run.agentId === "penny" && run.summary.trim());
    return {
      headline: worker ? `${worker.name} is running this` : "The task is running",
      detail: task.text,
      conclusion: penny?.summary.trim() || "Penny will explain what was done, and what to do next, when the others finish.",
      steps: [],
      tone: "working",
    };
  }
  const finishedBy = notes.length ? notes.map((run) => names[run.agentId] ?? run.agentId).join(" and ") : "The team";
  const penny = state.runs.find((run) => run.agentId === "penny" && run.summary.trim());
  return {
    headline: `Done. ${finishedBy} finished`,
    detail: task.text,
    conclusion: penny?.summary.trim() || nextStep,
    steps: [],
      tone: "done",
  };
}

