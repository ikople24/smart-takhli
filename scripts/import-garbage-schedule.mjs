#!/usr/bin/env node
/**
 * นำเข้าตารางเดินรถขยะฉบับจริงจาก data/garbage/schedule-2569.json
 *
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs           (dry-run)
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs --yes     (เขียนจริง)
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs --yes --force
 *
 * นี่คือการ re-baseline ทับข้อมูลเดิม ไม่ใช่ upsert เงียบ ๆ
 * ถ้าพบงานที่เคยถูกแก้จากหน้าแอดมิน (updatedAt ห่างจาก createdAt เกิน 1 วินาที)
 * จะไม่เขียนทับจนกว่าจะใส่ --force
 */
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const FILE = new URL("../data/garbage/schedule-2569.json", import.meta.url);
const LOCAL = new URL("../data/garbage/trucks.local.json", import.meta.url);
const BASELINE_EFFECTIVE_FROM = new Date("2026-01-01T00:00:00+07:00"); // ตรงกับ lib/garbage/constants.ts
const TRUCK_COLORS = { 1: "yellow", 6: "yellow" }; // ที่เหลือเขียว ตามข้อมูลเดิม

const confirmed = process.argv.includes("--yes");
const force = process.argv.includes("--force");
const uri = process.env.MONGO_URI;

const data = JSON.parse(readFileSync(FILE, "utf8"));
let registry = [];
try {
  registry = JSON.parse(readFileSync(LOCAL, "utf8")).trucks ?? [];
} catch {
  console.log("ไม่พบ trucks.local.json — ข้ามทะเบียนรถ/คนขับ (ปกติบนเครื่อง deploy)");
}

/** แปลงข้อมูลไฟล์เป็นเอกสาร routes/assignments/trucks */
function build() {
  const routes = [];
  const assignments = [];
  const truckNumbers = new Set();

  for (const t of data.trucks) {
    truckNumbers.add(t.number);
    routes.push({
      code: `R${t.number}`,
      name: `สาย R${t.number}`,
      defaultTruckNumber: t.number,
      stops: t.stops.map((s) => ({ seq: s.seq, name: s.name, mode: s.mode, roadId: null })),
      communityNames: [],
      source: data.$source,
      needsVerification: false,
      active: true,
    });

    for (let wd = 0; wd < 7; wd++) {
      const key = String(wd);
      const own = t.stops.filter((s) => key in s.times && !/เก็บแทนเบอร์/u.test(s.note ?? ""));
      const sub = t.stops.filter((s) => key in s.times && /เก็บแทนเบอร์/u.test(s.note ?? ""));

      if (own.length === 0 && sub.length === 0) {
        assignments.push({
          weekday: wd, shiftNo: 1, truckNumber: t.number, routeCode: null,
          kind: "day_off", coverForRouteCode: null, startMin: null, endMin: null,
          stopTimes: [], communityWindows: [], label: "วันหยุด",
        });
        continue;
      }
      if (own.length > 0) {
        const times = own.map((s) => s.times[key]);
        assignments.push({
          weekday: wd, shiftNo: 1, truckNumber: t.number, routeCode: `R${t.number}`,
          kind: "normal", coverForRouteCode: null,
          startMin: Math.min(...times), endMin: Math.max(...times),
          stopTimes: own.map((s) => ({ seq: s.seq, atMin: s.times[key] })).sort((a, b) => a.seq - b.seq),
          communityWindows: [], label: null,
        });
      }
      if (sub.length > 0) {
        const covered = (sub[0].note.match(/เก็บแทนเบอร์\s*(\d+)/u) ?? [])[1];
        const times = sub.map((s) => s.times[key]);
        assignments.push({
          weekday: wd, shiftNo: own.length > 0 ? 2 : 1, truckNumber: t.number,
          routeCode: `R${t.number}`, kind: "substitute",
          coverForRouteCode: covered ? `R${covered}` : null,
          startMin: Math.min(...times), endMin: Math.max(...times),
          stopTimes: sub.map((s) => ({ seq: s.seq, atMin: s.times[key] })).sort((a, b) => a.seq - b.seq),
          communityWindows: [], label: covered ? `เก็บแทนเบอร์ ${covered}` : null,
        });
      }
    }
  }

  // รถ 13 — มีแต่ว่าวันไหนเก็บ ยังไม่ระบุเวลา จึงเป็น special และ atMin เป็น null ทั้งหมด
  if (data.truck13?.stops?.length) {
    truckNumbers.add(13);
    routes.push({
      code: "R13", name: "สาย R13 (รถยกภาชนะรองรับ)", defaultTruckNumber: 13,
      stops: data.truck13.stops.map((s) => ({ seq: s.seq, name: s.name, mode: "truck", roadId: null })),
      communityNames: [], source: data.$source, needsVerification: false, active: true,
    });
    for (let wd = 0; wd < 7; wd++) {
      const served = data.truck13.stops.filter((s) => s.weekdays.includes(wd));
      assignments.push(
        served.length === 0
          ? { weekday: wd, shiftNo: 1, truckNumber: 13, routeCode: null, kind: "day_off",
              coverForRouteCode: null, startMin: null, endMin: null, stopTimes: [],
              communityWindows: [], label: "วันหยุด" }
          : { weekday: wd, shiftNo: 1, truckNumber: 13, routeCode: "R13", kind: "special",
              coverForRouteCode: null, startMin: null, endMin: null,
              stopTimes: served.map((s) => ({ seq: s.seq, atMin: null })),
              communityWindows: [], label: "รถยกภาชนะรองรับ · ยังไม่ระบุเวลา" }
      );
    }
  }

  const byNumber = new Map(registry.map((r) => [r.number, r]));
  const trucks = [...truckNumbers].sort((a, b) => a - b).map((n) => ({
    number: n,
    color: TRUCK_COLORS[n] ?? "green",
    status: "active",
    plate: byNumber.get(n)?.plate ?? null,
    driverName: byNumber.get(n)?.driverName ?? null,
    truckType: byNumber.get(n)?.truckType ?? null,
  }));

  return { routes, assignments, trucks };
}

const { routes, assignments, trucks } = build();

console.log(`จะนำเข้า: สาย ${routes.length} · งาน ${assignments.length} · รถ ${trucks.length}`);
for (const r of routes) console.log(`  ${r.code}: ${r.stops.length} จุด`);
const byKind = assignments.reduce((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {});
console.log("  ชนิดงาน:", JSON.stringify(byKind));

if (!confirmed) {
  console.log("\ndry-run: ยังไม่เขียนฐานข้อมูล (ใส่ --yes เพื่อเขียนจริง)");
  process.exit(0);
}
if (!uri) {
  console.error("ต้องตั้งค่า MONGO_URI (รันด้วย node --env-file=.env.local)");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODB_DB || undefined);

// กันทับงานที่เจ้าหน้าที่แก้จากหน้าแอดมินไปแล้ว
const edited = await db.collection("garbage_assignments").countDocuments({
  $expr: { $gt: [{ $subtract: ["$updatedAt", "$createdAt"] }, 1000] },
});
if (edited > 0 && !force) {
  console.error(`\nพบงาน ${edited} รายการที่เคยถูกแก้จากหน้าแอดมิน — ยกเลิก`);
  console.error("ถ้าตั้งใจจะทับข้อมูลเหล่านั้นจริง ให้รันซ้ำด้วย --force");
  await client.close();
  process.exit(1);
}

const now = new Date();
await db.collection("garbage_assignments").deleteMany({});
await db.collection("garbage_assignments").insertMany(
  assignments.map((a) => ({ ...a, effectiveFrom: BASELINE_EFFECTIVE_FROM, effectiveTo: null, createdAt: now, updatedAt: now }))
);
for (const r of routes) {
  await db.collection("garbage_routes").updateOne(
    { code: r.code },
    { $set: { ...r, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}
for (const t of trucks) {
  await db.collection("garbage_trucks").updateOne(
    { number: t.number },
    { $set: { ...t, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}

// บันทึกร่องรอยไว้ในหน้า /admin/superadmin/audit-log — การ re-baseline ลบงานเดิมทิ้งทั้งหมด
// ต้องตามได้ว่าใครสั่งเมื่อไร · เขียนตรงเข้า collection ของ mongoose (ชื่อ default ของโมเดล AuditLog)
// เพราะสคริปต์ .mjs ใช้ไดรเวอร์ดิบ ไม่ได้ผ่าน lib/auditLogger.ts
// **ห้ามใส่ driverName ลง after/meta** — audit log อ่านได้จากหน้าแอดมิน แต่ไม่ใช่ที่เก็บข้อมูลพนักงาน
await db.collection("auditlogs").insertOne({
  actorClerkId: "script:import-garbage-schedule",
  actorName: process.env.USER || "cli",
  action: "garbage_schedule_imported",
  resourceType: "system",
  resourceId: "garbage_schedule",
  description:
    `นำเข้าตารางเดินรถขยะจาก ${data.$source}` +
    ` (สาย ${routes.length} · งาน ${assignments.length} · รถ ${trucks.length})` +
    (force ? " [--force ทับงานที่เคยแก้จากหน้าแอดมิน]" : ""),
  meta: { source: data.$source, routes: routes.length, assignments: assignments.length, trucks: trucks.length, force },
  createdAt: now,
});

console.log(`\nเขียนแล้ว: งาน ${assignments.length} · สาย ${routes.length} · รถ ${trucks.length}`);
await client.close();
