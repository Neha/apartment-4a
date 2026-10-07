import { accountStatus, beginLogin } from "../../../lib/account";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const account = await accountStatus();
  if (account.keyConfigured) return Response.json({ status: "ready" });
  return Response.json(beginLogin());
}
