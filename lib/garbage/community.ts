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

/**
 * เลือกชุมชนจาก polygon ที่จุดตกอยู่
 * พื้นที่ทับซ้อนต้องได้คำตอบเดิมทุกครั้ง จึงเรียงชื่อแล้วเอาตัวแรก ไม่ใช่เชื่อลำดับที่ DB คืนมา
 */
export function pickCommunity(matches: Array<{ name: string }>): string | null {
  if (matches.length === 0) return null;
  return [...matches].map((m) => m.name).sort((a, b) => a.localeCompare(b, "th"))[0];
}
