import { isBusy, updateStore } from "../../../lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request) {
  if (isBusy()) {
    return Response.json(
      { error: "Wait until the current task finishes before changing the project." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;

  if (name !== undefined && (name.length === 0 || name.length > 60)) {
    return Response.json({ error: "Use a project name under 60 characters." }, { status: 400 });
  }

  await updateStore((store) => {
    if (name) store.project.name = name;
  });

  return Response.json({ ok: true });
}
