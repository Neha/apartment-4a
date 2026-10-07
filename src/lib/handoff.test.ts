import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHandoff, visibleThought } from "./handoff";

test("parseHandoff reads the last trailer", () => {
  const text = `I looked at the auth flow.

---
HANDOFF: amy
SUMMARY: Add a regression test for the empty password case.

---
HANDOFF: none
SUMMARY: I already covered it.`;

  assert.deepEqual(parseHandoff(text), {
    agentId: null,
    summary: "I already covered it.",
  });
});

test("parseHandoff accepts a specialist", () => {
  const text = "Please continue.\n---\nHANDOFF: howard\nSUMMARY: The build script fails on a missing env var.";
  assert.equal(parseHandoff(text).agentId, "howard");
  assert.equal(parseHandoff(text).summary, "The build script fails on a missing env var.");
});

test("parseHandoff ignores an unknown teammate", () => {
  const handoff = parseHandoff("HANDOFF: stuart\nSUMMARY: No such role.");
  assert.equal(handoff.agentId, null);
  assert.equal(handoff.summary, "No such role.");
});

test("visibleThought drops the trailer", () => {
  const text = "The checklist is updated.\n---\nHANDOFF: amy\nSUMMARY: Write the test.";
  assert.equal(visibleThought(text), "The checklist is updated.");
});
