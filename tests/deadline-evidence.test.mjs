import test from "node:test";
import assert from "node:assert/strict";
import { extractExplicitDeadlines, storedDeadlineDisagrees } from "../src/lib/research/deadline-evidence.ts";

test("finds multiple explicitly advertised offer opening deadlines", () => {
  const text = "Everyday Checking $400 offer ends November 9, 2026. " +
    "The $325 offer expires January 13, 2027. Open by January 13, 2027.";
  const dates = extractExplicitDeadlines(text);
  assert.deepEqual(dates.map((entry) => entry.date), ["2026-11-09", "2027-01-13"]);
  assert.match(dates[0].excerpt, /offer ends November 9/);
});

test("distinguishes valid time-zone-adjusted end dates from genuinely stale expiry", () => {
  const deadline = extractExplicitDeadlines("The offer expires November 9, 2026.");
  assert.equal(storedDeadlineDisagrees("2026-11-10T07:59:59.000Z", deadline), false);
  assert.equal(storedDeadlineDisagrees("2026-10-01T07:59:59.000Z", deadline), true);
  assert.equal(storedDeadlineDisagrees("2027-01-14T07:59:59.000Z", deadline), true);
  assert.equal(storedDeadlineDisagrees(null, deadline), false);
});

test("avoids inferring deadlines from generic dates or misleading months", () => {
  assert.deepEqual(extractExplicitDeadlines("Copyright 2026. An account opened October 3, 2026 has 90 days to qualify."), []);
  assert.deepEqual(extractExplicitDeadlines("Offer expires February 30, 2027."), []);
  assert.deepEqual(extractExplicitDeadlines("Offer ends in three months."), []);
});

test("multiple program deadlines cannot automatically be matched to a single stored offer", () => {
  const dates = extractExplicitDeadlines("Promotion ends November 9, 2026. Bonus expires January 13, 2027.");
  assert.equal(dates.length, 2);
  assert.equal(storedDeadlineDisagrees("2026-12-01", dates), false);
});
