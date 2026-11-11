// lib/tasks/siteIssue.js
// "พบปัญหาหน้างาน" (มติประชุม 2026-11): รับงาน → ลงพื้นที่ → พบว่าเทศบาลทำไม่ได้/ทำยังไม่ได้
// (เช่น แจ้งว่ากิ่งมะม่วงพาดเสาไฟ แต่ต้นอยู่ในบ้านผู้แจ้งเอง) → เจ้าหน้าที่แจ้งในระบบ → พัก SLA + แจ้งหัวหน้ากอง/superadmin
// หัวหน้า/superadmin ตัดสินใจต่อ: "ดำเนินการต่อ" (เลิกพัก) หรือให้เจ้าของงาน/superadmin ปิดเรื่อง — logic ล้วน
// เก็บบน assignment.blocked (kind: 'site_issue') ใช้กลไกพัก SLA ชุดเดียวกับ "รอวัสดุ" (timeline.js#siteIssueUpdate)

/** เหตุผลมาตรฐาน — code เก็บลง assignment.blocked.siteIssueCode (ห้ามเปลี่ยน code เดิม เพิ่มใหม่ต่อท้ายได้) */
export const SITE_ISSUE_REASONS = Object.freeze([
  Object.freeze({ code: "private_property", label: "อยู่ในพื้นที่ส่วนบุคคล" }),
  Object.freeze({ code: "not_our_duty", label: "ไม่อยู่ในอำนาจหน้าที่เทศบาล" }),
  Object.freeze({ code: "wrong_location", label: "ตำแหน่ง/ข้อมูลไม่ตรงกับที่แจ้ง" }),
  Object.freeze({ code: "need_owner_consent", label: "ต้องได้รับความยินยอมจากเจ้าของพื้นที่" }),
  Object.freeze({ code: "other", label: "อื่น ๆ" }),
]);

export const SITE_ISSUE_NOTE_MAX = 500;
export const SITE_ISSUE_MAX_IMAGES = 5;

/** label ของ code — ไม่รู้จัก → null */
export function siteIssueLabelOf(code) {
  const key = String(code ?? "").trim();
  return SITE_ISSUE_REASONS.find((r) => r.code === key)?.label ?? null;
}

/**
 * ตรวจข้อมูลที่เจ้าหน้าที่ส่งมา (ใช้ทั้งฝั่ง API — กันยิงข้าม UI)
 * - reasonCode ต้องอยู่ใน SITE_ISSUE_REASONS
 * - note: trim แล้วตัดที่ 500 ตัวอักษร · บังคับเมื่อเลือก "อื่น ๆ"
 * - images: เฉพาะ https:// (Cloudinary) ไม่ซ้ำ สูงสุด 5 รูป
 * @returns {{ ok: true, reasonCode: string, label: string, note: string, images: string[] } | { ok: false, reason: string }}
 */
export function validateSiteIssue({ reasonCode, note, images } = {}) {
  const code = String(reasonCode ?? "").trim();
  const label = siteIssueLabelOf(code);
  if (!label) return { ok: false, reason: "กรุณาเลือกเหตุผลที่พบหน้างาน" };
  const cleanNote = String(note ?? "").trim().slice(0, SITE_ISSUE_NOTE_MAX);
  if (code === "other" && !cleanNote) return { ok: false, reason: "เลือก \"อื่น ๆ\" ต้องอธิบายปัญหาที่พบ" };
  const list = Array.isArray(images) ? images : [];
  const cleanImages = [
    ...new Set(list.filter((u) => typeof u === "string").map((u) => u.trim()).filter((u) => u.startsWith("https://"))),
  ].slice(0, SITE_ISSUE_MAX_IMAGES);
  return { ok: true, reasonCode: code, label, note: cleanNote, images: cleanImages };
}

/** ข้อความสรุปหนึ่งบรรทัด "label — note" (note ว่าง = label อย่างเดียว) */
export function siteIssueSummary(label, note) {
  const l = String(label ?? "").trim();
  const n = String(note ?? "").trim();
  return n ? `${l} — ${n}` : l;
}
