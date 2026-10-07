import assert from "node:assert/strict";
import { test } from "node:test";
import { pipelineForTask, specialistsForTask } from "./route";

test("a status note brings structure, wording, and a check", () => {
  const text =
    "Write a one-page status note in the workspace. Explain what this folder is for, what is already done, what is still left, and how someone would check the work.";
  assert.deepEqual(specialistsForTask(text), ["sheldon", "penny", "amy"]);
  assert.deepEqual(pipelineForTask(text), ["leonard", "sheldon", "penny", "amy"]);
});

test("a question stays with the lead", () => {
  assert.deepEqual(specialistsForTask("what is https://github.com/Neha/go-learn-app/issues/11"), []);
});

test("a failing build brings build and debugging", () => {
  assert.deepEqual(specialistsForTask("Fix the failing build and the error in the log"), ["howard", "raj"]);
});

test("Penny closes every task after the specialists", () => {
  assert.deepEqual(pipelineForTask("Fix the failing build and the error in the log"), ["leonard", "howard", "raj", "penny"]);
  assert.deepEqual(pipelineForTask("Add the missing tests"), ["leonard", "amy", "penny"]);
});

test("implementation brings the coder, then Penny closes", () => {
  assert.deepEqual(specialistsForTask("Implement the login form component"), ["bernadette"]);
  assert.deepEqual(pipelineForTask("Implement the login form component"), ["leonard", "bernadette", "penny"]);
});

test("design and develop brings architecture and the coder", () => {
  const text = "design & develop a pwa music player on which user can upload the file and play the music";
  assert.deepEqual(specialistsForTask(text), ["sheldon", "bernadette"]);
  assert.deepEqual(pipelineForTask(text), ["leonard", "sheldon", "bernadette", "penny"]);
});
