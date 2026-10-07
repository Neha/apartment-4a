import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySession } from "./lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secret = sessionSecret();
  const signedIn = await verifySession(secret, request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    if (signedIn) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (isPublic(pathname)) return NextResponse.next();
  if (signedIn) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

function isPublic(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/api/login") return true;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/logo.svg") return true;
  if (pathname === "/apartment.jpg" || pathname === "/login-bg.jpg" || pathname.startsWith("/heads/")) return true;
  return false;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
