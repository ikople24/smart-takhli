#!/usr/bin/env node
/**
 * นำเข้าตารางเดินรถขยะฉบับจริงจาก data/garbage/schedule-2569.json
 *
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs           (dry-run)
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs --yes     (เขียนจริง)
 *   node --env-file=.env.local scripts/import-garbage-schedule.mjs --yes --force
 *
 * นี่คือการ re-baseline ทับข้อมูลเดิม ไม่ใช่ upsert เงียบ ๆ
 * ถ้าพบร่องรอยว่ามีคนแก้งานจากหน้าแอดมิน (audit log ของงานมอบหมาย หรือ updatedAt หลายชุด)
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

    // หนึ่งรถ หนึ่งวัน = หนึ่งงาน — รถออกทริปเดียว เก็บจุดของสายตัวเอง "สลับกับ" จุดที่ไปเก็บแทน
    // การแยกเป็นสองงาน (ของตัวเอง / ที่เก็บแทน) แล้วคิดช่วงเวลาจาก min–max ของแต่ละกลุ่ม
    // จะสร้างช่วงเวลาที่คาบเกี่ยวกันเองแบบปลอม ๆ แล้วไปชนกฎห้ามเวลาทับใน lib/garbage/overlap.ts
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

      // สายที่ไปเก็บแทนในวันนั้น — ข้อมูลจริงมีได้ไม่เกินหนึ่งสายต่อวัน
      // ถ้าวันไหนมีมากกว่านั้นแปลว่า model นี้ไม่พอ ต้องหยุดให้คนมาดู ไม่ใช่หยิบตัวแรกเงียบ ๆ
      const coveredNums = [...new Set(sub.map((s) => (s.note.match(/เก็บแทนเบอร์\s*(\d+)/u) ?? [])[1]).filter(Boolean))];
      if (coveredNums.length > 1) {
        throw new Error(
          `รถ ${t.number} วัน ${wd} เก็บแทนหลายสายในวันเดียว (${coveredNums.join(", ")}) — ` +
          `โครงสร้าง "หนึ่งงานต่อรถต่อวัน" รองรับได้สายเดียว ต้องทบทวนก่อนนำเข้า`
        );
      }
      const covered = coveredNums[0];

      const all = [...own, ...sub].sort((a, b) => a.seq - b.seq);
      const times = all.map((s) => s.times[key]);
      assignments.push({
        weekday: wd, shiftNo: 1, truckNumber: t.number, routeCode: `R${t.number}`,
        // เป็น substitute เฉพาะวันที่ไม่มีจุดของตัวเองเลย (เช่นรถ 6 วันอังคาร เก็บแทนเบอร์ 2 ล้วน)
        // วันที่มีทั้งสองอย่างคืองานปกติที่พ่วง coverForRouteCode ไว้
        kind: own.length === 0 ? "substitute" : "normal",
        coverForRouteCode: covered ? `R${covered}` : null,
        startMin: Math.min(...times), endMin: Math.max(...times),
        stopTimes: all.map((s) => ({ seq: s.seq, atMin: s.times[key] })),
        communityWindows: [], label: covered ? `เก็บแทนเบอร์ ${covered}` : null,
      });
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

// --json = พ่นเอกสารที่จะเขียนออกมาเป็น JSON เพื่อเอาไปตรวจกับ assignmentSchema / findOverlap
// ก่อนเขียนจริง (ตรวจของจริงที่จะเขียน ไม่ใช่ logic ที่ลอกไปไว้อีกที่แล้ว drift)
// **ไม่รวม trucks** เพราะมี driverName — ห้ามพ่นชื่อพนักงานออก stdout/ไฟล์ชั่วคราว
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ routes, assignments }));
  process.exit(0);
}

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

/**
 * กันทับงานที่เจ้าหน้าที่แก้จากหน้าแอดมินไปแล้ว
 *
 * เดิมใช้เกณฑ์ "updatedAt ห่างจาก createdAt เกิน 1 วินาที" ซึ่ง **หลอกได้ง่าย**:
 * การเขียน bulk ครั้งเดียว (เช่น backfill ฟิลด์ใหม่ทั้ง collection) ก็ทำให้ช่องว่างนั้นเกิด
 * ทั้งที่ไม่มีใครแตะจากหน้าจอเลย — เกิดขึ้นจริงมาแล้วกับชุด seed ที่ถูกตีว่า "แก้แล้ว" ทั้ง 17 รายการ
 * จึงเปลี่ยนมาดูสัญญาณที่เป็นหลักฐานของการแก้จริงแทน สองทาง:
 *
 *   1. audit log — ทุก mutation จากหน้าแอดมินเรียก logAuditEvent เสมอ (action ขึ้นต้น
 *      ด้วย garbage_assignment_) ถ้ามีแม้แต่รายการเดียวแปลว่ามีคนแก้จริง
 *   2. จำนวนชุดของ updatedAt — การแก้ทีละงานจากหน้าจอทำให้ updatedAt ต่างกันไปเรื่อย ๆ
 *      ถ้าทั้ง collection มี updatedAt ชุดเดียวแปลว่ามาจากการเขียนครั้งเดียว ไม่ใช่การแก้ทีละตัว
 */
const auditEdits = await db.collection("auditlogs").countDocuments({
  action: { $regex: "^garbage_assignment_" },
});
const updatedStamps = await db.collection("garbage_assignments").distinct("updatedAt");
const looksEdited = auditEdits > 0 || updatedStamps.length > 1;

if (looksEdited && !force) {
  console.error("\nพบสัญญาณว่างานเคยถูกแก้จากหน้าแอดมิน — ยกเลิก");
  console.error(`  · audit log ของงานมอบหมาย: ${auditEdits} รายการ (มากกว่า 0 = มีคนแก้จริง)`);
  console.error(`  · ชุดเวลา updatedAt ที่ไม่ซ้ำกัน: ${updatedStamps.length} ชุด (มากกว่า 1 = แก้ทีละงาน)`);
  console.error("ถ้าตั้งใจจะทับข้อมูลเหล่านั้นจริง ให้รันซ้ำด้วย --force");
  await client.close();
  process.exit(1);
}
console.log(
  `\nตรวจร่องรอยการแก้จากหน้าแอดมิน: audit ${auditEdits} รายการ · updatedAt ${updatedStamps.length} ชุด — ผ่าน`
);

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
