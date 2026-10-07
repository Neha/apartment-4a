export const SESSION_COOKIE = "apartment_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function sessionSecret(): string {
  return process.env.APP_PASSWORD?.trim() ?? "";
}

export async function signSession(secret: string, expiresAt: number): Promise<string> {
  const payload = String(expiresAt);
  const signature = await hmac(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifySession(secret: string, token: string | undefined): Promise<boolean> {
  if (!secret || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await hmac(secret, payload);
  if (!fixedEqual(signature, expected)) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function passwordsMatch(input: string, secret: string): boolean {
  return fixedEqual(input, secret);
}

async function hmac(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fixedEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}
