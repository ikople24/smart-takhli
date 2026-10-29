// รายงานผู้บริหาร + คิวงานโบตะกอนประจำ — logic ล้วน (เทสต์: __tests__/flushingSchedule.test.js)
// รอบถัดไปนับจากวันโบครั้งล่าสุดของหัวนั้น (วันไทย, นับวันปฏิทินรวมเสาร์อาทิตย์): ใสแล้ว +15 วัน · ยังขุ่น +5 วัน
// คิวจ่ายให้ "ทีมของคนที่โบหัวนั้นครั้งล่าสุด" — ทีมหาจาก createdByName ตอนอ่าน (ไม่ประทับลง log)
// แก้สมาชิกทีมแล้วรายงาน/คิวย้อนหลังเปลี่ยนตามทันที
import { bangkokYmd, isNoFlush } from "./flushing";
import { latestByPoint, pointKeyOf } from "./communityStatus";

export const CYCLE_DAYS = { clear: 15, still_turbid: 5 };
export const UPCOMING_DAYS = 7;

// ทีมหลัก 2 ทีม — เพิ่มทีมใหม่ต่อท้ายเท่านั้น (key ใช้อ้างอิงใน DB)
export const DEFAULT_TEAMS = [
  { key: "water", label: "กองการประปา", order: 1 },
  { key: "prevention", label: "ทีมงานป้องกัน", order: 2 },
];
export const NO_TEAM = { key: "", label: "ยังไม่จัดทีม" };
export const MAX_MEMBER_NAME = 80;

export const QUEUE_BUCKETS = ["overdue", "today", "upcoming", "later", "blocked", "never"];
export const QUEUE_BUCKET_LABELS = {
  overdue: "เลยกำหนด",
  today: "ครบกำหนดวันนี้",
  upcoming: `${UPCOMING_DAYS} วันข้างหน้า`,
  later: "ภายหลัง",
  blocked: "รอแก้ไขก่อน (สิ่งกีดขวาง/หัวชำรุด)",
  never: "ยังไม่เคยโบ",
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const ymdMs = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function addDaysYmd(ymd, n) {
  return new Date(ymdMs(ymd) + n * 86400000).toISOString().slice(0, 10);
}

export function daysBetweenYmd(a, b) {
  return Math.round((ymdMs(b) - ymdMs(a)) / 86400000);
}

// "YYYY-MM" → { from, to } วันแรก/วันสุดท้าย · รูปแบบผิด = null
export function monthRange(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${String(last).padStart(2, "0")}` };
}

const normName = (s) => String(s ?? "").trim();

export function teamResolver(teams) {
  const map = new Map();
  for (const t of teams || []) for (const name of t.members || []) map.set(normName(name), t.key);
  return (name) => map.get(normName(name)) || "";
}

const bucketOf = (daysLeft) =>
  daysLeft < 0 ? "overdue" : daysLeft === 0 ? "today" : daysLeft <= UPCOMING_DAYS ? "upcoming" : "later";

// points = หัวที่ใช้งาน · logs = บันทึก (ใช้เฉพาะที่ผูกหัว) · today = "YYYY-MM-DD" วันไทย
// คืนรายการต่อหัว เรียงตาม QUEUE_BUCKETS → วันครบกำหนด → รหัสหัว
export function buildQueue({ points, logs, teams, today }) {
  const teamOf = teamResolver(teams);
  const latest = new Map(
    latestByPoint((logs || []).filter((l) => l.flushPointId)).map(({ log, times }) => [
      String(log.flushPointId),
      { log, times },
    ])
  );
  const items = (points || []).map((point) => {
    const hit = latest.get(String(point._id));
    if (!hit) {
      return { point, lastLog: null, times: 0, teamKey: "", lastYmd: null, dueYmd: null, daysLeft: null, bucket: "never" };
    }
    const { log, times } = hit;
    const base = { point, lastLog: log, times, teamKey: teamOf(log.createdByName), lastYmd: bangkokYmd(log.flushedAt) };
    // เปิดน้ำไม่ได้ (สิ่งกีดขวาง/หัวชำรุด) — ส่งคิว 5 วันไปก็ยังโบไม่ได้ ต้องแก้ปัญหาก่อน
    if (isNoFlush(log.result, log.turbidCause)) return { ...base, dueYmd: null, daysLeft: null, bucket: "blocked" };
    const dueYmd = addDaysYmd(base.lastYmd, CYCLE_DAYS[log.result] ?? CYCLE_DAYS.still_turbid);
    const daysLeft = daysBetweenYmd(today, dueYmd);
    return { ...base, dueYmd, daysLeft, bucket: bucketOf(daysLeft) };
  });
  const order = Object.fromEntries(QUEUE_BUCKETS.map((b, i) => [b, i]));
  return items.sort(
    (a, b) =>
      order[a.bucket] - order[b.bucket] ||
      String(a.dueYmd ?? a.lastYmd ?? "").localeCompare(String(b.dueYmd ?? b.lastYmd ?? "")) ||
      String(a.point.code).localeCompare(String(b.point.code))
  );
}

export function queueCounts(items) {
  const byBucket = Object.fromEntries(QUEUE_BUCKETS.map((b) => [b, 0]));
  const byTeam = {};
  for (const i of items || []) {
    byBucket[i.bucket] += 1;
    byTeam[i.teamKey] = (byTeam[i.teamKey] || 0) + 1;
  }
  return { byBucket, byTeam };
}

const teamRows = (teams) => [...(teams || []).map((t) => ({ key: t.key, label: t.label })), NO_TEAM];

// สรุปในช่วงที่ส่งมา (logs กรองช่วงมาแล้ว) แยกทีม
// flushCount = จำนวนครั้ง (รวมบันทึกที่ไม่ผูกหัว) · points = หัวในทะเบียนไม่ซ้ำ นับในทีมของบันทึกล่าสุดของหัวนั้น
// clearPoints / turbidPoints = ตามผลล่าสุดของจุดนั้นในช่วง
export function summarizeByTeam({ logs, teams }) {
  const teamOf = teamResolver(teams);
  const rows = teamRows(teams).map((t) => ({ ...t, flushCount: 0, points: 0, clearPoints: 0, turbidPoints: 0 }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const l of logs || []) byKey.get(teamOf(l.createdByName)).flushCount += 1;
  for (const { log } of latestByPoint((logs || []).filter((l) => l.flushPointId))) {
    const r = byKey.get(teamOf(log.createdByName));
    r.points += 1;
    if (log.result === "clear") r.clearPoints += 1;
    else r.turbidPoints += 1;
  }
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return {
    rows,
    total: { flushCount: sum("flushCount"), points: sum("points"), clearPoints: sum("clearPoints"), turbidPoints: sum("turbidPoints") },
  };
}

// รายวันในเดือน "YYYY-MM": [{ ymd, byTeam: { [key]: { flushCount, points } }, total }]
// points รายวัน = หัวในทะเบียนไม่ซ้ำ (บันทึกไม่ผูกหัวนับแค่ครั้ง)
export function dailyBreakdown({ logs, teams, month }) {
  const range = monthRange(month);
  if (!range) return [];
  const teamOf = teamResolver(teams);
  const keys = teamRows(teams).map((t) => t.key);
  const days = new Map();
  for (let ymd = range.from; ymd <= range.to; ymd = addDaysYmd(ymd, 1)) {
    days.set(ymd, { flush: new Map(keys.map((k) => [k, 0])), pts: new Map(keys.map((k) => [k, new Set()])), all: new Set() });
  }
  for (const l of logs || []) {
    const d = days.get(bangkokYmd(l.flushedAt));
    if (!d) continue;
    const k = teamOf(l.createdByName);
    d.flush.set(k, d.flush.get(k) + 1);
    if (l.flushPointId) {
      d.pts.get(k).add(pointKeyOf(l));
      d.all.add(pointKeyOf(l));
    }
  }
  return [...days.entries()].map(([ymd, d]) => {
    const byTeam = {};
    let flushCount = 0;
    for (const k of keys) {
      const f = d.flush.get(k);
      const p = d.pts.get(k).size;
      flushCount += f;
      if (f > 0) byTeam[k] = { flushCount: f, points: p };
    }
    return { ymd, byTeam, total: { flushCount, points: d.all.size } };
  });
}

// PUT /teams body { teams: [{ key, members: [ชื่อ] }] } → { ok, value } | { ok: false, message }
// ชื่อหนึ่งอยู่ได้ทีมเดียว — ฝั่ง UI ย้ายชื่อแล้วต้องถอดออกจากทีมเดิมเอง
export function validateTeamsInput(body) {
  const list = body?.teams;
  if (!Array.isArray(list)) return { ok: false, message: "ข้อมูลทีมไม่ถูกต้อง" };
  const known = new Set(DEFAULT_TEAMS.map((t) => t.key));
  const owner = new Map();
  const value = [];
  for (const t of list) {
    if (!known.has(t?.key)) return { ok: false, message: "ไม่รู้จักทีมนี้" };
    if (!Array.isArray(t.members)) return { ok: false, message: "รายชื่อสมาชิกไม่ถูกต้อง" };
    const members = [];
    for (const raw of t.members) {
      if (typeof raw !== "string") return { ok: false, message: "รายชื่อสมาชิกไม่ถูกต้อง" };
      const name = raw.trim();
      if (!name || members.includes(name)) continue;
      if (name.length > MAX_MEMBER_NAME) return { ok: false, message: `ชื่อยาวเกิน ${MAX_MEMBER_NAME} ตัวอักษร` };
      if (owner.has(name) && owner.get(name) !== t.key) return { ok: false, message: `"${name}" อยู่มากกว่า 1 ทีม` };
      owner.set(name, t.key);
      members.push(name);
    }
    value.push({ key: t.key, members });
  }
  return { ok: true, value };
}
