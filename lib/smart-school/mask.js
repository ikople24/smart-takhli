// lib/smart-school/mask.js
// มาสก์ชื่อสำหรับผลค้นหาสาธารณะ (PDPA): คงชื่อแรก นามสกุลเหลือ 2 ตัวแรก + xxx
// เช่น "พงศกรณ์ ผ่องใส" → "พงศกรณ์ ผ่xxx"
// ชื่อท่อนเดียว: เหลือ 3 ตัวแรก + xxx

export function maskName(fullName = "") {
  if (fullName == null) return "";
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 3) + "xxx";
  const [first, ...rest] = parts;
  return `${first} ${rest.map((p) => p.slice(0, 2) + "xxx").join(" ")}`;
}

// ใบ้เบอร์โทรให้รายเก่าจำได้ — โชว์ 6 หลักแรก ปิด 4 ตัวท้ายเสมอ (4 ตัวท้าย = ด่านยืนยัน ห้ามเผย)
// เช่น "0812344521" → "081-234-••••"; เบอร์สั้นกว่า 6 หลัก คืน "" (ไม่ใบ้)
export function maskPhoneHint(phone = "") {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length < 6) return "";
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-••••`;
}
