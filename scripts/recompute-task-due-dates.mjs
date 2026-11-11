// คำนวณวันครบกำหนด (Assignment.dueDate) ของงานที่ยังเปิดอยู่ใหม่ ตาม SLA รายชนิดงาน (มติประชุม 10/11/69)
// ทำไมต้องมี: dueDate ถูกบันทึกตอนกดรับ (pages/api/complaints/assignments/create.js) — เปลี่ยนกติกา SLA แล้ว
// งานเก่าที่เปิดค้างจะยังใช้วันครบกำหนดแบบเดิม (7 วัน) จนกว่าจะรันสคริปต์นี้
//
// กติกา: dueDate ใหม่ = วันที่ประชาชนแจ้ง + SLA (ไม่มีวันแจ้ง → วันที่รับงาน + SLA) ผ่าน lib/tasks/derived.js#dueDateFor
// ตัวเดียวกับที่ API ใช้ · ค่าตั้งอ่านจาก task_settings (key 'default') ถ้ามี ไม่มี = DEFAULT_TASK_SETTINGS
// ครอบทั้งผู้รับผิดชอบหลัก (assignee) และผู้ประสานงาน (coordinator) · ข้ามงานที่เรื่องปิดแล้ว/เรื่องถูกลบ
// ช่วงพัก SLA (slaPausedAt/slaPausedMs) ไม่ต้องแตะ — derived.js บวกเพิ่มให้ตอนอ่านเอง
//
// วิธีรัน (ต้องมี MONGO_URI ใน .env.local):
//   node --env-file=.env.local --import tsx scripts/recompute-task-due-dates.mjs          (dry-run — แค่รายงาน)
//   node --env-file=.env.local --import tsx scripts/recompute-task-due-dates.mjs --yes    (เขียนจริง)
//   ... --only-extend          เขียน/นับเฉพาะรายการที่วันครบกำหนดใหม่ "เลื่อนออกไป" (ไม่ทำให้งานเดิมเกินกำหนดกะทันหัน)
//   ... --yes --only-extend    เขียนจริงเฉพาะรายการที่เลื่อนออก · ไม่มี --yes = ไม่เขียนอะไรเลยเสมอ
// รันซ้ำได้ — รอบถัดไปจะไม่พบรายการที่ต้องเปลี่ยน

import mongoose from "mongoose";
import { normalizeTaskSettings } from "../lib/tasks/settings.js";
import { dueDateFor } from "../lib/tasks/derived.js";
import { isClosedStatus } from "../lib/tasks/status.js";

const fmt = (d) => (d ? new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) : "(ไม่มี)");

async function main() {
  const apply = process.argv.includes("--yes");
  const onlyExtend = process.argv.includes("--only-extend");
  const now = new Date();
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not set — รันด้วย node --env-file=.env.local");
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const settingsDoc = await db.collection("task_settings").findOne({ key: "default" });
  const settings = normalizeTaskSettings(settingsDoc);
  console.log(`ค่าตั้ง: ${settingsDoc ? "จาก task_settings (key 'default')" : "ค่าเริ่มต้น DEFAULT_TASK_SETTINGS (ไม่มีเอกสาร task_settings)"}`);
  console.log(
    `  defaultSlaDays (งานทั่วไป) = ${settings.defaultSlaDays} วัน · unclaimedAlertHours = ${settings.unclaimedAlertHours} ชม.` +
      ` · slaByWorkType ${settings.slaByWorkType.length} แถว · slaByCategory ${settings.slaByCategory.length} แถว`
  );
  if (onlyExtend) console.log("  โหมด --only-extend: เฉพาะรายการที่วันครบกำหนดเลื่อนออก");

  const open = await db
    .collection("assignments")
    .find({ completedAt: null })
    .project({ complaintId: 1, role: 1, assignedAt: 1, dueDate: 1 })
    .toArray();
  const complaintIds = [...new Set(open.map((a) => a.complaintId).filter(Boolean))];
  // Assignment.complaintId ชี้ collection submittedreports (models/Complaint.js / SubmittedReport.js)
  const complaints = await db
    .collection("submittedreports")
    .find({ _id: { $in: complaintIds } })
    .project({ complaintId: 1, createdAt: 1, category: 1, problems: 1, detail: 1, workType: 1, status: 1 })
    .toArray();
  const byId = new Map(complaints.map((c) => [String(c._id), c]));

  const changes = [];
  const skipped = { orphan: 0, closed: 0, noDate: 0 };
  let unchanged = 0;
  const stats = { shorten: 0, extend: 0, filteredOut: 0, overdueNow: 0, newlyOverdue: 0 };
  const byWorkType = {};
  for (const a of open) {
    const c = a.complaintId ? byId.get(String(a.complaintId)) : null;
    if (!c) { skipped.orphan += 1; continue; }
    if (isClosedStatus(c.status)) { skipped.closed += 1; continue; }
    const { dueDate, workType } = dueDateFor({ complaintCreatedAt: c.createdAt, assignedAt: a.assignedAt, complaint: c, settings });
    if (!dueDate) { skipped.noDate += 1; continue; }
    const old = a.dueDate ? new Date(a.dueDate) : null;
    if (old && old.getTime() === dueDate.getTime()) { unchanged += 1; continue; }
    // ไม่มีค่าเดิม = นับเป็น "เลื่อนออก" (เดิมคำนวณสดจากกติกาเก่า ไม่ได้บันทึก)
    const direction = !old || dueDate.getTime() > old.getTime() ? "extend" : "shorten";
    if (direction === "shorten") stats.shorten += 1;
    else stats.extend += 1;
    if (onlyExtend && direction !== "extend") { stats.filteredOut += 1; continue; }
    const becomesOverdue = dueDate.getTime() < now.getTime();
    if (becomesOverdue) stats.overdueNow += 1;
    if (becomesOverdue && !(old && old.getTime() < now.getTime())) stats.newlyOverdue += 1;
    byWorkType[workType] = (byWorkType[workType] ?? 0) + 1;
    changes.push({ _id: a._id, code: c.complaintId || String(c._id).slice(-6), role: a.role || "assignee", workType, old, next: dueDate, direction, becomesOverdue });
  }

  for (const ch of changes) {
    const tags = [ch.direction === "shorten" ? "สั้นลง" : "เลื่อนออก", ch.becomesOverdue ? "เกินกำหนดแล้ว" : null, ch.role === "coordinator" ? "ผู้ประสาน" : null];
    console.log(`${ch.code.padEnd(12)}  ${ch.workType.padEnd(16)}  ${fmt(ch.old)} → ${fmt(ch.next)}  (${tags.filter(Boolean).join(" · ")})`);
  }
  console.log("");
  console.log(`งานเปิด ${open.length} · ต้องเปลี่ยน ${changes.length} · เท่าเดิม ${unchanged} · ข้าม: เรื่องถูกลบ ${skipped.orphan} / เรื่องปิดแล้ว ${skipped.closed} / ไม่มีวันอ้างอิง ${skipped.noDate}`);
  console.log(`ทิศทาง (ทุกรายการที่ต่างจากเดิม): สั้นลง ${stats.shorten} · เลื่อนออก ${stats.extend}${onlyExtend ? ` · ตัดออกเพราะ --only-extend ${stats.filteredOut}` : ""}`);
  console.log(`ในรายการที่จะเขียน: เกินกำหนดทันที (วันใหม่ < ตอนนี้) ${stats.overdueNow} · ในจำนวนนี้เดิมยังไม่เกิน ${stats.newlyOverdue}`);
  console.log(`ต้องเปลี่ยนแยกตามชนิดงาน: ${JSON.stringify(byWorkType)}`);

  if (!apply) {
    console.log(`dry-run: ยังไม่เขียน — ใส่ --yes เพื่อบันทึกจริง${onlyExtend ? " (คู่กับ --only-extend)" : ""}`);
  } else if (changes.length) {
    const res = await db.collection("assignments").bulkWrite(
      changes.map((ch) => ({ updateOne: { filter: { _id: ch._id, completedAt: null }, update: { $set: { dueDate: ch.next } } } }))
    );
    console.log(`บันทึกแล้ว ${res.modifiedCount} รายการ`);
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
