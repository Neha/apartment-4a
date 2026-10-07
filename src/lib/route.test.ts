import assert from "node:assert/strict";
import { test } from "node:test";
import { pipelineForTask, specialistsForTask } from "./route";

test("a status note brings structure, wording, and a check", () => {
  const text =
    "Write a one-page status note in the workspace. Explain what this folder is for, what is already done, what is still left, and how someone would check the work.";
  assert.deepEqual(specialistsForTask(text), ["sheldon", "penny", "amy"]);
});

test("a question stays with the lead", () => {
  assert.deepEqual(specialistsForTask("what is https://github.com/Neha/go-learn-app/issues/11"), []);
});

test("a failing build brings build and debugging", () => {
  assert.deepEqual(specialistsForTask("Fix the failing build and the error in the log"), ["howard", "raj"]);
});

test("Bernadette closes every task after the specialists", () => {
  assert.deepEqual(pipelineForTask("Fix the failing build and the error in the log"), ["leonard", "howard", "raj", "bernadette"]);
  assert.deepEqual(pipelineForTask("Add the missing tests"), ["leonard", "amy", "bernadette"]);
});
