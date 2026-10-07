import { assignTask } from "../../../lib/orchestrator";
import { clearHistory } from "../../../lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const result = await assignTask(text);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const result = await clearHistory();
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}
