import { accountStatus } from "../../../lib/account";
import { loadStore, toPublicState } from "../../../lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [store, account] = await Promise.all([Promise.resolve(loadStore()), accountStatus()]);
  return Response.json(toPublicState(store, account));
}
