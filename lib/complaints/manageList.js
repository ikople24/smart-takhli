// lib/complaints/manageList.js
// logic ล้วนของหน้า /admin/manage-complaints (ไม่มี React) — ค้นหา/กรอง/เรียง/สถานะแถว/ความค้าง

export const STATUS_IN_PROGRESS = "อยู่ระหว่างดำเนินการ";
export const STATUS_DONE = "ดำเนินการเสร็จสิ้น";
export const STATUS_PENDING_FILTER = "รอการมอบหมาย"; // ค่า filter แท็บ "รอมอบหมาย" (= ยังไม่มี assignment)

// ค้นหา: เลขคำร้อง (พิมพ์ "700036" หรือ "tkc-700036" ก็เจอ), รายละเอียด, หมวด, ประเภทย่อย, ชุมชน, ชื่อผู้แจ้ง
export function matchesComplaintSearch(complaint, rawQuery) {
  const q = (rawQuery || "").trim().toLowerCase();
  if (!q) return true;
  const id = (complaint.complaintId || "").toLowerCase();
  if (id && id.includes(q)) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3 && /^(tkc)?[-\s]*\d+$/.test(q) && id.replace(/\D/g, "").includes(digits)) return true;
  const fields = [
    complaint.detail,
    complaint.category,
    complaint.community,
    complaint.fullName,
    ...(Array.isArray(complaint.problems) ? complaint.problems : []),
  ];
  return fields.some((f) => typeof f === "string" && f.toLowerCase().includes(q));
}

/** สถานะที่ใช้เลือกปุ่มหลักของแถว: 'pending' | 'progress' | 'done' */
export function rowState(complaint, isAssigned) {
  if (complaint?.status === STATUS_DONE) return "done";
  return isAssigned ? "progress" : "pending";
}

/** Map<complaintId(string), assignment> — ตัวแรกที่เจอชนะ (เหมือน assignments.find เดิม) */
export function buildAssignmentIndex(assignments) {
  const map = new Map();
  for (const a of Array.isArray(assignments) ? assignments : []) {
    const key = String(a?.complaintId ?? "");
    if (key && !map.has(key)) map.set(key, a);
  }
  return map;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// เกณฑ์เดียวกับ components/complaints/OverdueComplaintsAlert.js — แก้ต้องแก้ทั้งสองที่
export const STALE_DAYS = Object.freeze({ progress: 3, pending: 7 });

function timeOf(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return new Date(value).getTime();
}

/** { isStale, days } — days = จำนวนวันเต็มนับจาก updatedAt (null ถ้าวันที่ใช้ไม่ได้) */
export function staleInfo(complaint, isAssigned, now = new Date()) {
  const t = timeOf(complaint?.updatedAt);
  if (!Number.isFinite(t)) return { isStale: false, days: null };
  const elapsed = Math.max(0, now.getTime() - t);
  const days = Math.floor(elapsed / DAY_MS);
  const state = rowState(complaint, isAssigned);
  if (state === "done") return { isStale: false, days };
  return { isStale: elapsed > STALE_DAYS[state] * DAY_MS, days };
}

/** ข้อความอายุเรื่องบนการ์ด/ตาราง */
export function ageLabel(complaint, isAssigned, now = new Date()) {
  const { isStale, days } = staleInfo(complaint, isAssigned, now);
  if (days === null) return "—";
  if (isStale) return `ไม่อัปเดต ${days} วัน`;
  if (days === 0) return "อัปเดตวันนี้";
  if (days === 1) return "อัปเดตเมื่อวาน";
  return `อัปเดต ${days} วันที่แล้ว`;
}

export const SORT_OPTIONS = Object.freeze([
  { value: "updatedAt-desc", label: "อัปเดตล่าสุด" },
  { value: "updatedAt-asc", label: "ค้างนานที่สุดก่อน" },
  { value: "createdAt-desc", label: "แจ้งล่าสุด" },
  { value: "category-asc", label: "หมวดหมู่ ก-ฮ" },
]);
export const DEFAULT_SORT = "updatedAt-desc";

/**
 * กรองรายการ — status: 'all' | 'carryover' | STATUS_PENDING_FILTER | ค่า complaint.status
 * ('carryover' เลือก source ที่ฝั่งหน้าแล้ว ที่นี่ไม่กรองสถานะเพิ่ม)
 */
export function filterComplaints(source, {
  search = "",
  status = "all",
  category = "all",
  mineOnly = false,
  staleOnly = false,
  userId = null,
  assignmentByComplaintId = new Map(),
  now = new Date(),
} = {}) {
  return (Array.isArray(source) ? source : []).filter((c) => {
    const assignment = assignmentByComplaintId.get(String(c._id));
    const isAssigned = !!assignment;
    if (!matchesComplaintSearch(c, search)) return false;
    if (status === STATUS_PENDING_FILTER) {
      if (isAssigned) return false;
    } else if (status !== "all" && status !== "carryover" && c.status !== status) {
      return false;
    }
    if (category !== "all" && c.category !== category) return false;
    if (mineOnly && (!assignment || !userId || String(assignment.userId) !== String(userId))) return false;
    if (staleOnly && !staleInfo(c, isAssigned, now).isStale) return false;
    return true;
  });
}

function sortTime(value) {
  const t = timeOf(value);
  return Number.isFinite(t) ? t : 0;
}

/** sortValue = '<field>-<asc|desc>' จาก SORT_OPTIONS — คืน array ใหม่ */
export function sortComplaints(list, sortValue = DEFAULT_SORT) {
  const [field, order] = String(sortValue).split("-");
  const dir = order === "asc" ? 1 : -1;
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    if (field === "category") return dir * (a.category || "").localeCompare(b.category || "", "th");
    if (field === "updatedAt" || field === "createdAt") return dir * (sortTime(a[field]) - sortTime(b[field]));
    return 0;
  });
}

/** จำนวนตัวกรองรองที่ไม่ใช่ค่า default — ใช้เป็นตัวเลขบนปุ่มตัวกรอง */
export function countActiveFilters({ fiscalYear, defaultFiscalYear, category, sort, mineOnly, staleOnly }) {
  return [
    String(fiscalYear) !== String(defaultFiscalYear),
    category !== "all",
    sort !== DEFAULT_SORT,
    !!mineOnly,
    !!staleOnly,
  ].filter(Boolean).length;
}
