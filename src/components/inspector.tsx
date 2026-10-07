"use client";

import { useEffect, useState } from "react";
import type { MessageRecord, PublicAgent, PublicRun, TaskRecord } from "../lib/types";
import { PixelHead } from "./pixel-head";

type InspectorProps = {
  agent: PublicAgent | undefined;
  task: TaskRecord | null;
  run: PublicRun | undefined;
  messages: MessageRecord[];
  names: Record<string, string>;
};

type Tab = "task" | "files" | "talk";

export function Inspector({ agent, task, run, messages, names }: InspectorProps) {
  const [tab, setTab] = useState<Tab>("task");

  useEffect(() => {
    setTab("task");
  }, [agent?.id]);

  if (!agent) return null;
  const thought = visibleThought(run?.thought || "");
  const summary = run?.summary?.trim() || agent.activity || "No update yet.";

  return (
    <aside className="inspector">
      <div className="inspector-pin">
        <header className="inspector-head">
          <PixelHead id={agent.id} large />
          <div className="who">
            <h2>{agent.name}</h2>
            <p className="who-role">
              {agent.role} / {agent.title}
            </p>
          </div>
          <span className={`status-badge status-badge-${agent.status}`}>{badgeFor(agent.status)}</span>
        </header>
        <div className="tabs" role="tablist" aria-label="Agent details">
          <button type="button" role="tab" aria-selected={tab === "task"} className={tab === "task" ? "tab tab-on" : "tab"} onClick={() => setTab("task")}>
            Current Task
          </button>
          <button type="button" role="tab" aria-selected={tab === "files"} className={tab === "files" ? "tab tab-on" : "tab"} onClick={() => setTab("files")}>
            Files
          </button>
          <button type="button" role="tab" aria-selected={tab === "talk"} className={tab === "talk" ? "tab tab-on" : "tab"} onClick={() => setTab("talk")}>
            Discussion
          </button>
        </div>
      </div>

      <div className="inspector-scroll">
      {tab === "task" ? (
        <section className="card">
          <p className="section-label">{task ? "Their update" : "Waiting"}</p>
          <p className="thought">{summary}</p>
          {run?.error ? <p className="form-error">{run.error}</p> : null}
          {thought ? (
            <details className="full-note">
              <summary>Read the full note</summary>
              <p className="thought">{plainAnswer(thought)}</p>
            </details>
          ) : null}
        </section>
      ) : null}

      {tab === "files" ? (
        <section className="card">
          <h3>Files in this run</h3>
          <FileList files={run?.files ?? []} />
        </section>
      ) : null}

      {tab === "talk" ? (
        <section className="card discussion">
          <h3>Team Discussion</h3>
          <DiscussionList messages={messages} names={names} />
        </section>
      ) : null}
      </div>
    </aside>
  );
}

function FileList({ files }: { files: string[] }) {
  if (files.length === 0) return <p className="muted">No files yet.</p>;
  return (
    <ul className="files">
      {files.map((file) => (
        <li key={file} title={file}>
          <span>{shortPath(file)}</span>
        </li>
      ))}
    </ul>
  );
}

function DiscussionList({ messages, names }: { messages: MessageRecord[]; names: Record<string, string> }) {
  if (messages.length === 0) return <p className="muted">The team has not posted yet.</p>;
  return (
    <ul>
      {messages.map((message) => (
        <li key={message.id}>
          <PixelHead id={message.agentId} />
          <div>
            <strong>{names[message.agentId] ?? message.agentId}</strong>
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            <p>{message.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function plainAnswer(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`+/g, "")
    .replace(/^#+\s+/gm, "")
    .trim();
}

function visibleThought(text: string): string {
  const cut = text.lastIndexOf("\n---");
  const body = (cut >= 0 ? text.slice(0, cut) : text).trim();
  return body;
}

function shortPath(file: string): string {
  const parts = file.replace(/\\/g, "/").split("/");
  return parts.slice(-2).join("/");
}

function badgeFor(status: PublicAgent["status"]): string {
  if (status === "offline") return "Offline";
  if (status === "working") return "Working";
  if (status === "blocked") return "Blocked";
  if (status === "done") return "Done";
  if (status === "idle") return "Idle";
  return "Online";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
