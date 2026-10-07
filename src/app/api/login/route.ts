import { NextResponse } from "next/server";
import { passwordsMatch, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionSecret, signSession } from "../../../lib/session";

export async function POST(request: Request) {
  const secret = sessionSecret();
  if (!secret) {
    return NextResponse.json({ error: "Set APP_PASSWORD in .env.local and restart the app." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  if (!passwordsMatch(password, secret)) {
    return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  }

  const token = await signSession(secret, Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
