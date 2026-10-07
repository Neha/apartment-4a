import "server-only";
import { Cursor, CursorAgentError } from "@cursor/sdk";
import { publish } from "./hub";
import type { CredentialSource } from "./types";

type AccountCache = {
  at: number;
  loggedIn: boolean;
  email: string | null;
};

type AccountRuntime = {
  cache: AccountCache | null;
  loginInFlight: boolean;
  loginUrl: string | null;
  loginError: string | null;
};

const globalAccount = globalThis as unknown as { agentRoomAccount?: AccountRuntime };

function runtime(): AccountRuntime {
  if (!globalAccount.agentRoomAccount) {
    globalAccount.agentRoomAccount = {
      cache: null,
      loginInFlight: false,
      loginUrl: null,
      loginError: null,
    };
  }
  return globalAccount.agentRoomAccount;
}

export type AccountSnapshot = {
  keyConfigured: boolean;
  credentialSource: CredentialSource;
  email: string | null;
  loginInFlight: boolean;
  loginUrl: string | null;
  loginError: string | null;
};

function snapshot(source: CredentialSource, email: string | null): AccountSnapshot {
  const current = runtime();
  return {
    keyConfigured: source !== "none",
    credentialSource: source,
    email,
    loginInFlight: current.loginInFlight,
    loginUrl: current.loginUrl,
    loginError: current.loginError,
  };
}

export async function accountStatus(): Promise<AccountSnapshot> {
  const current = runtime();
  if (process.env.CURSOR_API_KEY?.trim()) {
    return snapshot("environment", current.cache?.email ?? null);
  }

  if (!current.cache || Date.now() - current.cache.at > 10_000) {
    try {
      const status = await Cursor.auth.status();
      current.cache = {
        at: Date.now(),
        loggedIn: status.status === "logged-in",
        email: status.status === "logged-in" ? (status.email ?? null) : null,
      };
    } catch (error) {
      const message = error instanceof CursorAgentError ? error.message : "unknown";
      console.error("[agent-room] auth status failed", message);
      current.cache = { at: Date.now(), loggedIn: false, email: null };
    }
  }

  return snapshot(current.cache.loggedIn ? "login" : "none", current.cache.email);
}

export function beginLogin(): { status: "ready" | "waiting" } {
  const current = runtime();
  if (process.env.CURSOR_API_KEY?.trim()) return { status: "ready" };
  if (current.loginInFlight) return { status: "waiting" };

  current.loginInFlight = true;
  current.loginError = null;
  publish();

  void Cursor.auth
    .login({
      apiKeyName: "Apartment 4A",
      onLoginUrl: (url) => {
        current.loginUrl = url;
        publish();
      },
    })
    .then((result) => {
      current.cache = { at: Date.now(), loggedIn: true, email: result.email ?? null };
      current.loginError = null;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Cursor login did not finish.";
      current.loginError = /cursor_|api[_ ]?key/i.test(message) ? "Cursor login did not finish." : message.slice(0, 240);
      console.error("[agent-room] login failed", current.loginError);
    })
    .finally(() => {
      current.loginInFlight = false;
      current.loginUrl = null;
      publish();
    });

  return { status: "waiting" };
}
