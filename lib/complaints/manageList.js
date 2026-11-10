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
