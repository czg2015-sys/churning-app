import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSourceCoverage } from "../src/lib/research/scan-coverage.ts";

test("a fully readable monitoring scan is completed", () => {
  const result = summarizeSourceCoverage(["baseline", "unchanged", "changed"]);
  assert.equal(result.status, "completed");
  assert.equal(result.readable, 3);
  assert.equal(result.unreachable, 0);
  assert.equal(result.message, null);
});

test("blocked or unreachable official sources make the scan partial", () => {
  const result = summarizeSourceCoverage(["baseline", "unreachable", "unreachable"]);
  assert.equal(result.status, "partial");
  assert.equal(result.total, 3);
  assert.equal(result.readable, 1);
  assert.equal(result.unreachable, 2);
  assert.match(result.message || "", /2 unreachable or blocked/);
});

test("no readable source never looks like fully researched coverage", () => {
  const result = summarizeSourceCoverage(["unreachable", "unreachable"]);
  assert.equal(result.status, "partial");
  assert.equal(result.readable, 0);
  assert.equal(result.unreachable, 2);
});
