// lib/flood-relief/phone.ts
// เบอร์โทรผู้แจ้ง — ใช้ติดต่อกลับเท่านั้น ห้ามเปิดเผยสาธารณะ (หน้าสถานะเห็นแค่ 4 ตัวท้าย)

/** ตัดทุกอย่างที่ไม่ใช่ตัวเลข · +66 / 66 นำหน้า → 0 */
export function normalizePhone(input: unknown): string {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("66") && (d.length === 11 || d.length === 10)) d = "0" + d.slice(2);
  return d;
}

/** เบอร์ไทย 9 หลัก (บ้าน) หรือ 10 หลัก (มือถือ) ขึ้นต้นด้วย 0 */
export function isValidPhone(input: unknown): boolean {
  return /^0\d{8,9}$/.test(normalizePhone(input));
}

/** "0812344421" → "08x-xxx-4421" · สั้นผิดปกติ = "xxx" (ไม่เดาเผยตัวเลขเพิ่ม) */
export function maskPhone(input: unknown): string {
  const d = normalizePhone(input);
  if (d.length < 9) return "xxx";
  return `${d.slice(0, 2)}x-xxx-${d.slice(-4)}`;
}
