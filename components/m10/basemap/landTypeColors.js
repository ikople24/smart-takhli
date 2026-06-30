// สีรูปแปลงตามประเภทเอกสารสิทธิ์ (landType ของ basemap) — โฉนด = แดง, ประเภทอื่นแยกกลุ่มสี
export const LAND_TYPE_COLORS = [
  { type: "โฉนด", color: "#dc2626" },      // แดง — ตามที่ผู้ใช้ขอ
  { type: "น.ส.3ก", color: "#ea580c" },    // ส้ม (กลุ่ม น.ส.3)
  { type: "น.ส.3", color: "#d97706" },     // อำพัน (กลุ่ม น.ส.3)
  { type: "ส.ค.1", color: "#9333ea" },     // ม่วง
  { type: "ที่ราชพัสดุ", color: "#2563eb" }, // น้ำเงิน — ที่รัฐ
  { type: "ที่การรถไฟ", color: "#0d9488" }, // เขียวอมฟ้า — ที่รัฐ (รถไฟ)
];

export const OTHER_COLOR = "#6b7280"; // เทา — null / ไม่ทราบ / ประเภทอื่น

const COLOR_MAP = Object.fromEntries(LAND_TYPE_COLORS.map((x) => [x.type, x.color]));

// landType → สี (โฉนด=แดง, อื่น ๆ ตามกลุ่ม, ไม่รู้จัก=เทา)
export function parcelColor(landType) {
  return COLOR_MAP[landType] || OTHER_COLOR;
}
