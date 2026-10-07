import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordsMatch, signSession, verifySession } from "./session";

test("a signed session is accepted until it expires", async () => {
  const token = await signSession("secret", Date.now() + 60_000);
  assert.equal(await verifySession("secret", token), true);
});

test("a session signed with another secret is rejected", async () => {
  const token = await signSession("secret", Date.now() + 60_000);
  assert.equal(await verifySession("other", token), false);
});

test("an expired session is rejected", async () => {
  const token = await signSession("secret", Date.now() - 1_000);
  assert.equal(await verifySession("secret", token), false);
});

test("password comparison rejects a different password", () => {
  assert.equal(passwordsMatch("correct", "correct"), true);
  assert.equal(passwordsMatch("wrong", "correct"), false);
});
