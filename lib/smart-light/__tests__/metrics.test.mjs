import assert from "node:assert/strict";
import { daysSince, healthSummary, overduePoles, groupHeat } from "../metrics.js";

const NOW = new Date("2026-07-11T00:00:00Z").getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

// daysSince
assert.equal(daysSince(null, NOW), null, "null date → null");
assert.equal(daysSince("not-a-date", NOW), null, "bad date → null");
assert.equal(daysSince(daysAgo(5), NOW), 5, "5 days ago → 5");
assert.equal(daysSince(new Date(NOW + 86400000).toISOString(), NOW), 0, "future → 0");

// healthSummary
const groups = [
  { group: "A", total: 10, byStatus: { normal: 6, damaged: 2, off: 1, unknown: 1 }, centroid: { lat: 1, lng: 1 } },
  { group: "B", total: 5, byStatus: { normal: 5, damaged: 0, off: 0, unknown: 0 }, centroid: { lat: 2, lng: 2 } },
];
let hs = healthSummary(groups);
assert.equal(hs.total, 15);
assert.equal(hs.normal, 11);
assert.equal(hs.problem, 3, "problem = damaged+off");
assert.equal(hs.unknown, 1);
assert.equal(hs.pct, 73, "round(11/15*100)");
assert.deepEqual(healthSummary([]), { total: 0, normal: 0, problem: 0, unknown: 0, pct: 0 }, "empty → zeros, pct 0");

// overduePoles: never-surveyed first, then oldest first
const poles = [
  { _id: "1", code: "c1", lastSurveyedAt: daysAgo(3) },
  { _id: "2", code: "c2", lastSurveyedAt: null },
  { _id: "3", code: "c3", lastSurveyedAt: daysAgo(30) },
];
const od = overduePoles(poles, 2, NOW);
assert.equal(od.length, 2, "top 2");
assert.equal(od[0]._id, "2", "never-surveyed on top");
assert.equal(od[0].daysLabel, "ยังไม่เคยสำรวจ");
assert.equal(od[1]._id, "3", "then oldest");
assert.equal(od[1].daysLabel, "30 วันก่อน");

// groupHeat: sorted by problem ratio desc
const gh = groupHeat(groups);
assert.equal(gh[0].name, "A", "A has higher problem ratio");
assert.equal(gh[0].problem, 3);
assert.ok(Math.abs(gh[0].ratio - 0.3) < 1e-9);
assert.equal(gh[1].ratio, 0);

console.log("metrics.test.mjs: all assertions passed");
