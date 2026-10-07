"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { specialistsForTask } from "../lib/route";
import type { AgentId, PublicAgent, PublicRun, PublicState, TaskRecord } from "../lib/types";
import { Inspector } from "./inspector";
import { Office, type TaskReadout } from "./office";
import { PixelHead } from "./pixel-head";

type View = "room" | "project" | "integrations" | "settings";

export function ControlRoom() {
  const [state, setState] = useState<PublicState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState("leonard");
  const [view, setView] = useState<View>("room");
  const [draft, setDraft] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [clock, setClock] = useState("");
  const [projectName, setProjectName] = useState("");
  const [repoPath, setRepoPath] = useState("");

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
  const online = state?.agents.filter((agent) => agent.status !== "offline").length ?? 0;
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

  async function connect() {
    setFormError(null);
    const response = await fetch("/api/connect", { method: "POST" });
    if (!response.ok) setFormError("Cursor login could not start.");
    await refresh();
  }

  function openSettings() {
    setProjectName(state?.project.name ?? "");
    setRepoPath(state?.project.repoPath ?? "");
    setView("settings");
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const response = await fetch("/api/project", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName, repoPath }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setFormError(body?.error ?? "The project could not be saved.");
      return;
    }
    await refresh();
    setView("room");
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img className="mark" src="/logo.svg" alt="" />
          <div>
            <strong>Agent Room</strong>
            <span>Apartment 4A</span>
          </div>
        </div>
        <p className="tagline">A team of agents, one task at a time.</p>
        <div className="top-meta">
          <span className="online-count">
            <i className={online > 0 ? "dot dot-on" : "dot"} />
            {online}/{state?.agents.length ?? 7} online
          </span>
          <time>{clock}</time>
        </div>
      </header>

      <div className="body">
        <aside className="sidebar">
          <section className="queue" aria-label="Task queue">
            <div className="side-label">
              <h2>This task</h2>
              <span>{queue.filter((step) => step.phase === "done").length}/{queue.length || 0}</span>
            </div>
            {state?.task ? <p className="queue-task">{state.task.text}</p> : <p className="queue-task">No task yet.</p>}
            {queue.length === 0 ? <p className="queue-empty">Assign a task and the lineup appears here.</p> : null}
            <ol className="queue-list">
              {queue.map((step) => (
                <li key={step.agent.id}>
                  <button
                    type="button"
                    className={step.agent.id === selectedAgent?.id ? `queue-row queue-${step.phase} selected` : `queue-row queue-${step.phase}`}
                    onClick={() => {
                      setSelected(step.agent.id);
                      setView("room");
                    }}
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
          </section>
          <div className="side-label">
            <h2>AI Team</h2>
            <span>
              {online}/{state?.agents.length ?? 7} online
            </span>
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
            <button type="button" onClick={openSettings}>
              Settings
            </button>
          </nav>
          <p className="side-foot">
            <span className="side-foot-links">
              <Link href="/about">About</Link>
              <Link href="/privacy">Privacy</Link>
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
              readout={readoutFor(state, names, nextStep)}
              onSelect={(id) => setSelected(id)}
            />
          ) : null}
          {state && view === "project" ? (
            <section className="panel">
              <h2>{state.project.name}</h2>
              <p className="muted">Agents edit this folder. One writer runs at a time, in the order shown under This task.</p>
              <p className="path">{state.project.repoPath}</p>
              <h3>Recent tasks</h3>
              {state.recentTasks.length === 0 ? <p className="muted">No tasks yet.</p> : null}
              <ul className="task-list">
                {state.recentTasks.map((task) => (
                  <li key={task.id}>
                    <span className={`status-pill status-${task.status === "running" ? "working" : task.status === "error" ? "blocked" : "done"}`}>
                      {task.status}
                    </span>
                    {task.text}
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
          {state && view === "settings" ? (
            <section className="panel">
              <h2>Settings</h2>
              <form className="settings" onSubmit={(event) => void saveProject(event)}>
                <label>
                  Project name
                  <input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={60} />
                </label>
                <label>
                  Folder the agents edit
                  <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} spellCheck={false} />
                </label>
                <button type="submit" className="primary" disabled={state.busy}>
                  Save
                </button>
              </form>
            </section>
          ) : null}
          <form className="composer" onSubmit={(event) => void assign(event)}>
            <p className="composer-label">
              <span aria-hidden="true">◆</span> Give your team a task...
            </p>
            <div className="composer-row">
              <label className="sr-only" htmlFor="task">
                Give your team a task
              </label>
              <input
                id="task"
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
            task={state.task}
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

const TASK_HINTS = [
  "Review this PR",
  "Implement dark mode",
  "Fix failing tests",
  "Investigate production issue",
];

const SLICE: Record<AgentId, string> = {
  leonard: "Plan",
  sheldon: "Structure",
  penny: "Wording",
  howard: "Build",
  raj: "Debugging",
  amy: "Check",
  bernadette: "Status",
};

type QueuePhase = "done" | "now" | "next" | "waiting" | "stopped";

type QueueStep = {
  index: number;
  agent: PublicAgent;
  slice: string;
  phase: QueuePhase;
};

function queueFor(state: PublicState | null): QueueStep[] {
  const task = state?.task;
  if (!state || !task) return [];
  const runs = new Map<string, PublicRun>();
  for (const run of state.runs) runs.set(run.agentId, run);
  const planned: AgentId[] = ["leonard", ...specialistsForTask(task.text)];
  const ids = task.status === "running" ? planned : planned.filter((id) => runs.has(id));
  let namedNext = false;
  return ids.flatMap((id, index) => {
    const agent = state.agents.find((item) => item.id === id);
    if (!agent) return [];
    const run = runs.get(id);
    let phase: QueuePhase;
    if (run?.status === "error" || agent.status === "blocked") phase = "stopped";
    else if (run?.status === "finished") phase = "done";
    else if (agent.status === "working" || run?.status === "running") phase = "now";
    else if (!namedNext) {
      phase = "next";
      namedNext = true;
    } else phase = "waiting";
    return [{ index: index + 1, agent, slice: SLICE[id], phase }];
  });
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
  if (!task) return "Assign a task below. You do not name anyone. The wording decides who works.";
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
    return {
      headline: "Nobody is running a task",
      detail: "Assign a task and the lineup appears on the left.",
      conclusion: nextStep,
      tone: "quiet",
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
      tone: "error",
    };
  }
  if (task.status === "running") {
    return {
      headline: worker ? `${worker.name} is running this` : "The task is running",
      detail: task.text,
      conclusion: nextStep,
      tone: "working",
    };
  }
  const finishedBy = notes.length ? notes.map((run) => names[run.agentId] ?? run.agentId).join(" and ") : "The team";
  return {
    headline: `Done. ${finishedBy} finished`,
    detail: task.text,
    conclusion: nextStep,
    tone: "done",
  };
}

