// lib/flood-relief/ticket.ts
// เลขที่คำขอแบบสั้น FL-<ลำดับ 4 หลัก> เช่น FL-0142 — ผู้ประสบภัยต้องอ่าน/บอกทางโทรศัพท์ได้เร็ว (logic ล้วน)
// ลำดับวิ่งต่อเนื่องไม่รีเซ็ตรายปี เพราะ ticket เป็น unique — รีเซ็ตแล้วปีถัดไปจะชนเลขเดิม
// counter เก็บใน collection flood_counters (_id = TICKET_COUNTER_ID) — ส่วนที่แตะ DB อยู่ฝั่ง API

export const TICKET_COUNTER_ID = "flood-ticket";

/** เกิน 9999 ไม่ตัดทิ้ง กลายเป็น 5 หลัก */
export function formatTicket(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) throw new Error("ลำดับเลขที่คำขอต้องเป็นจำนวนเต็มบวก");
  return `FL-${String(seq).padStart(4, "0")}`;
}

const TICKET_RE = /^FL-(\d{4,})$/;

/** รับค่าที่ผู้ใช้พิมพ์/มาจาก URL — ตัดช่องว่าง ไม่สนตัวพิมพ์ · ผิดรูปแบบ = null */
export function parseTicket(input: unknown): { seq: number; ticket: string } | null {
  const t = String(input ?? "").trim().toUpperCase();
  const m = TICKET_RE.exec(t);
  if (!m) return null;
  const seq = Number(m[1]);
  if (seq < 1) return null;
  return { seq, ticket: formatTicket(seq) };
}
