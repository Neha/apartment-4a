"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicAgent, PublicMessage, PublicRun, TaskRecord } from "../lib/types";
import { PixelHead } from "./pixel-head";

type InspectorProps = {
  agent: PublicAgent | undefined;
  task: Pick<TaskRecord, "id"> | null;
  run: PublicRun | undefined;
  messages: PublicMessage[];
  names: Record<string, string>;
};

type Tab = "task" | "files" | "talk";

export function Inspector({ agent, task, run, messages, names }: InspectorProps) {
  const [tab, setTab] = useState<Tab>("task");
  const seen = useRef(messages.length);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setTab("task");
  }, [agent?.id]);

  useEffect(() => {
    if (tab === "talk") {
      seen.current = messages.length;
      setUnread(0);
      return;
    }
    setUnread(Math.max(0, messages.length - seen.current));
  }, [tab, messages.length]);

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
          <button
            type="button"
            role="tab"
            aria-selected={tab === "talk"}
            aria-label={unread > 0 ? `Discussion, ${unread} new` : "Discussion"}
            className={tab === "talk" ? "tab tab-on" : "tab"}
            onClick={() => setTab("talk")}
          >
            Discussion
            {unread > 0 ? <span className="tab-count">{unread}</span> : null}
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
          <h3>Discussion</h3>
          <DiscussionList messages={messages} names={names} currentTaskId={task?.id ?? null} />
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

function DiscussionList({
  messages,
  names,
  currentTaskId,
}: {
  messages: PublicMessage[];
  names: Record<string, string>;
  currentTaskId: string | null;
}) {
  const threads = threadsFor(messages);
  const [followId, setFollowId] = useState<string | null>(currentTaskId);
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    setFollowId(currentTaskId);
  }, [currentTaskId]);

  const follow = threads.find((thread) => thread.taskId === followId) ?? threads[0] ?? null;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [follow?.taskId, follow?.messages.length]);

  if (!follow) return <p className="muted">The team has not posted yet.</p>;
  const live = follow.taskId === currentTaskId;

  return (
    <>
      <label className="discussion-follow">
        Follow a task
        <select value={follow.taskId} onChange={(event) => setFollowId(event.target.value)}>
          {threads.map((thread) => (
            <option key={thread.taskId} value={thread.taskId}>
              {thread.taskId === currentTaskId ? "This task · " : ""}
              {clip(thread.taskText, 72)} ({thread.messages.length})
            </option>
          ))}
        </select>
      </label>
      <p className="discussion-task" title={follow.taskText}>
        {live ? "This task. " : "Earlier task. "}
        {follow.taskText}
      </p>
      <ul>
        {follow.messages.map((message, index) => (
          <li key={message.id} ref={index === follow.messages.length - 1 ? end : undefined}>
            <PixelHead id={message.agentId} />
            <div>
              <strong>{names[message.agentId] ?? message.agentId}</strong>
              <time dateTime={message.createdAt}>{formatWhen(message.createdAt)}</time>
              <p>{message.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function threadsFor(messages: PublicMessage[]): Array<{ taskId: string; taskText: string; messages: PublicMessage[] }> {
  const order: string[] = [];
  const byTask = new Map<string, PublicMessage[]>();
  for (const message of messages) {
    const thread = byTask.get(message.taskId);
    if (thread) thread.push(message);
    else {
      byTask.set(message.taskId, [message]);
      order.push(message.taskId);
    }
  }
  return order
    .map((taskId) => {
      const thread = byTask.get(taskId) ?? [];
      const sorted = [...thread].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { taskId, taskText: sorted.at(-1)?.taskText ?? "Earlier task", messages: sorted };
    })
    .sort((a, b) => (b.messages.at(-1)?.createdAt ?? "").localeCompare(a.messages.at(-1)?.createdAt ?? ""));
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
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

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
