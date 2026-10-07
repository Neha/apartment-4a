import assert from "node:assert/strict";
import { test } from "node:test";
import { applyEvent, extractFilePath, type RunDraft } from "./events";

function draft(): RunDraft {
  return { thought: "", checklist: [], files: [] };
}

test("extractFilePath reads a path field", () => {
  assert.equal(extractFilePath({ filePath: "src/auth.ts" }), "src/auth.ts");
  assert.equal(extractFilePath("nope"), null);
  assert.equal(extractFilePath({ note: "none" }), null);
});

test("applyEvent records a tool call and then completes it", () => {
  const run = draft();
  applyEvent(run, {
    type: "tool_call",
    call_id: "call-1",
    name: "edit",
    status: "running",
    args: { path: "src/login.ts" },
  });
  applyEvent(run, {
    type: "tool_call",
    call_id: "call-1",
    name: "edit",
    status: "completed",
    args: { path: "src/login.ts" },
  });
  assert.equal(run.checklist.length, 1);
  assert.equal(run.checklist[0]?.state, "done");
  assert.deepEqual(run.files, ["src/login.ts"]);
});

test("applyEvent keeps assistant text and a short activity", () => {
  const run = draft();
  const activity = applyEvent(run, { type: "assistant", text: "Checking the login form.\n" });
  assert.match(run.thought, /Checking the login form/);
  assert.equal(activity, "Checking the login form.");
});
