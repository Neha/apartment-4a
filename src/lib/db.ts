import "server-only";
import { Pool, type PoolClient } from "pg";
import { AGENT_IDS, type Store } from "./types";

const globalDb = globalThis as unknown as { apartmentPool?: Pool; apartmentSchema?: Promise<void> };

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url || null;
}

function pool(): Pool {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set.");
  if (!globalDb.apartmentPool) {
    globalDb.apartmentPool = new Pool({ connectionString: url, max: 5 });
  }
  return globalDb.apartmentPool;
}

function ensureSchema(): Promise<void> {
  if (!globalDb.apartmentSchema) {
    globalDb.apartmentSchema = pool()
      .query(`
        CREATE TABLE IF NOT EXISTS apartment_state (
          id integer PRIMARY KEY,
          document jsonb NOT NULL,
          CONSTRAINT apartment_state_one_row CHECK (id = 1)
        );
        CREATE TABLE IF NOT EXISTS apartment_tasks (
          id text PRIMARY KEY,
          text text NOT NULL,
          status text NOT NULL,
          created_at timestamptz NOT NULL
        );
        CREATE TABLE IF NOT EXISTS apartment_runs (
          id text PRIMARY KEY,
          task_id text NOT NULL,
          agent_id text NOT NULL,
          status text NOT NULL,
          summary text NOT NULL DEFAULT '',
          error text,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS apartment_messages (
          id text PRIMARY KEY,
          task_id text NOT NULL,
          agent_id text NOT NULL,
          text text NOT NULL,
          created_at timestamptz NOT NULL
        );
        CREATE TABLE IF NOT EXISTS apartment_files (
          run_id text NOT NULL,
          task_id text NOT NULL,
          agent_id text NOT NULL,
          path text NOT NULL,
          recorded_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (run_id, path)
        );
        CREATE TABLE IF NOT EXISTS apartment_log (
          id bigserial PRIMARY KEY,
          at timestamptz NOT NULL DEFAULT now(),
          task_id text,
          run_id text,
          agent_id text,
          kind text NOT NULL,
          message text NOT NULL
        )
      `)
      .then(() => undefined)
      .catch((error: unknown) => {
        globalDb.apartmentSchema = undefined;
        throw error;
      });
  }
  return globalDb.apartmentSchema;
}

export async function readStateDocument(): Promise<Partial<Store> | null> {
  await ensureSchema();
  const result = await pool().query<{ document: Partial<Store> }>("SELECT document FROM apartment_state WHERE id = 1");
  return result.rows[0]?.document ?? null;
}

export async function writeStateDocument(store: Store, before: Store | null): Promise<void> {
  await ensureSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO apartment_state (id, document)
       VALUES (1, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document`,
      [JSON.stringify(store)],
    );
    await recordTracking(client, before, store);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function recordTracking(client: PoolClient, before: Store | null, after: Store): Promise<void> {
  const cleared = after.tasks.length === 0 && after.runs.length === 0 && after.messages.length === 0 && (before?.tasks.length ?? 0) > 0;
  if (cleared) {
    await client.query("DELETE FROM apartment_log");
    await client.query("DELETE FROM apartment_files");
    await client.query("DELETE FROM apartment_messages");
    await client.query("DELETE FROM apartment_runs");
    await client.query("DELETE FROM apartment_tasks");
    await client.query(
      `INSERT INTO apartment_log (kind, message) VALUES ('history', 'Cleared tasks, discussion, file references, and the log.')`,
    );
    return;
  }

  const previousTasks = new Map((before?.tasks ?? []).map((task) => [task.id, task]));
  for (const task of after.tasks) {
    await client.query(
      `INSERT INTO apartment_tasks (id, text, status, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, status = EXCLUDED.status`,
      [task.id, task.text, task.status, task.createdAt],
    );
    const prior = previousTasks.get(task.id);
    if (!prior) await log(client, "task", `${task.status}: ${clip(task.text, 180)}`, { taskId: task.id });
    else if (prior.status !== task.status) await log(client, "task", `Status ${prior.status} → ${task.status}`, { taskId: task.id });
  }

  const previousRuns = new Map((before?.runs ?? []).map((run) => [run.id, run]));
  for (const run of after.runs) {
    await client.query(
      `INSERT INTO apartment_runs (id, task_id, agent_id, status, summary, error, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         summary = EXCLUDED.summary,
         error = EXCLUDED.error,
         updated_at = now()`,
      [run.id, run.taskId, run.agentId, run.status, run.summary, run.error],
    );
    const prior = previousRuns.get(run.id);
    if (!prior) await log(client, "run", `${run.agentId} started`, { taskId: run.taskId, runId: run.id, agentId: run.agentId });
    else if (prior.status !== run.status) {
      await log(client, "run", `${run.agentId} ${run.status}${run.summary ? `: ${clip(run.summary, 180)}` : ""}`, {
        taskId: run.taskId,
        runId: run.id,
        agentId: run.agentId,
      });
    }
    const seen = new Set(prior?.files ?? []);
    for (const file of run.files) {
      if (seen.has(file)) continue;
      await client.query(
        `INSERT INTO apartment_files (run_id, task_id, agent_id, path)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (run_id, path) DO NOTHING`,
        [run.id, run.taskId, run.agentId, file],
      );
      await log(client, "file", file, { taskId: run.taskId, runId: run.id, agentId: run.agentId });
    }
  }

  const previousMessages = new Set((before?.messages ?? []).map((message) => message.id));
  for (const message of after.messages) {
    await client.query(
      `INSERT INTO apartment_messages (id, task_id, agent_id, text, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [message.id, message.taskId, message.agentId, message.text, message.createdAt],
    );
    if (!previousMessages.has(message.id)) {
      await log(client, "message", clip(message.text, 180), { taskId: message.taskId, agentId: message.agentId });
    }
  }

  for (const id of AGENT_IDS) {
    const next = after.agents[id];
    const prior = before?.agents[id];
    if (!next) continue;
    if (prior && prior.status === next.status && prior.activity === next.activity) continue;
    if (!prior && next.status === "idle" && !next.activity) continue;
    const detail = next.activity ? `${next.status}: ${clip(next.activity, 160)}` : next.status;
    await log(client, "agent", `${id} ${detail}`, { agentId: id });
  }
}

async function log(
  client: PoolClient,
  kind: string,
  message: string,
  refs: { taskId?: string; runId?: string; agentId?: string } = {},
): Promise<void> {
  await client.query(
    `INSERT INTO apartment_log (kind, message, task_id, run_id, agent_id) VALUES ($1, $2, $3, $4, $5)`,
    [kind, clip(message, 500), refs.taskId ?? null, refs.runId ?? null, refs.agentId ?? null],
  );
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
