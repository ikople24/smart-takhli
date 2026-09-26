/** คำนำหน้าที่ตัดทิ้งตอนจับคู่ชื่อ — ต้องตรงกับที่หน้าค้นหาใช้ ไม่งั้นจับคู่คนละแบบกับที่ผู้ใช้เจอ */
const PREFIX_RE = /^(ถนน|ถ\.\s*|ซอย|ซ\.\s*|ชุมชน)\s*/u;

/**
 * ทำให้ชื่อสถานที่เทียบกันได้ — ตัดคำนำหน้า (ชั้นเดียว) ตัดช่องว่าง แปลงเป็นตัวพิมพ์เล็ก
 * ใช้ทั้งตอนค้นหาและตอนจับคู่จุดเก็บกับถนน
 */
export function normalizePlaceName(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFC")
    .trim()
    .replace(PREFIX_RE, "")
    .replace(/\s/gu, "")
    .toLowerCase();
}

// ย้ายไปเป็นไฟล์กลาง lib/geo/community.ts (แชร์กับโมดูล flood-relief) — re-export ให้ import เดิมใช้ได้
export { pickCommunity } from "@/lib/geo/community";
