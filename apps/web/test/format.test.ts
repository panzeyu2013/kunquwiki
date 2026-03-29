import assert from "node:assert/strict";
import test from "node:test";
import { countdownLabel, formatDateTime } from "../lib/format";

test("countdownLabel uses supplied current time instead of a hardcoded date", () => {
  const label = countdownLabel("2026-03-29T00:00:00.000Z", new Date("2026-03-27T00:00:00.000Z"));
  assert.equal(label, "2 天 0 小时后开始");
});

test("formatDateTime renders using Asia/Shanghai timezone", () => {
  const label = formatDateTime("2026-03-27T12:00:00.000Z");
  assert.match(label, /20:00|20:00:00|20:00/);
});
