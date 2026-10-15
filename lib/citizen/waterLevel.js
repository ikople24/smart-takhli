// lib/citizen/waterLevel.js
// ระดับความขุ่นน้ำประปา (NTU) สำหรับการ์ดหน้าแรกโฉมใหม่ — เกณฑ์และชุดสีเดียวกับ
// getNtuInfo ใน components/smart-papar/WaterQualityCard.js ห้ามแก้ฝั่งเดียว
// ระวัง: ชุดสีน้ำไม่เหมือน PM2.5 — เคส "ปกติ" เป็นน้ำเงิน (สื่อน้ำใส) ไม่ใช่เขียว
export function waterLevel(ntuValue) {
  // Number(null) = 0 — กันไว้ก่อน ไม่ให้ค่าว่างกลายเป็น "ปกติ"
  const ntu = ntuValue == null || ntuValue === "" ? NaN : Number(ntuValue);
  if (!Number.isFinite(ntu)) {
    return { key: "none", label: "ไม่มีข้อมูล", chipBg: "#F1F0F5", chipText: "#6B6880", dot: "#9590A8" };
  }
  if (ntu < 5) {
    return { key: "ok", label: "น้ำใส (ปกติ)", chipBg: "#E6F1FE", chipText: "#2563EB", dot: "#3B82F6" };
  }
  if (ntu <= 15) {
    return { key: "watch", label: "เฝ้าระวัง", chipBg: "#FEF6E0", chipText: "#C77E10", dot: "#F2A93B" };
  }
  if (ntu <= 20) {
    return { key: "sediment", label: "ตะกอนเล็กน้อย", chipBg: "#FDEBE3", chipText: "#C2410C", dot: "#EA580C" };
  }
  return { key: "turbid", label: "เริ่มขุ่น", chipBg: "#FDE5E7", chipText: "#B91C1C", dot: "#DC2626" };
}

// สี badge ค่า NTU ในตาราง (หน้า /papar) — ช่วงน้ำใส (< 5) ไล่ฟ้าอ่อน→เข้มตามค่า ให้เห็นความต่างแม้ทุกวันอยู่ในเกณฑ์
// ช่วงอื่นใช้สีเดียวกับ waterLevel เสมอ (อย่าแยกเกณฑ์ออกไปอีกชุด)
export function ntuShade(ntuValue) {
  const lv = waterLevel(ntuValue);
  if (lv.key !== "ok") return { key: lv.key, bg: lv.chipBg, text: lv.chipText };
  const t = Math.max(0, Math.min(1, Number(ntuValue) / 5));
  // #EFF6FF (ฟ้าจาง) → #BFDBFE (ฟ้าเข้ม) · ตัวอักษร #3B82F6 → #1D4ED8
  const mix = (a, b) => Math.round(a + (b - a) * t);
  const hex = (r, g, b) => `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  return {
    key: "ok",
    bg: hex(mix(0xef, 0xbf), mix(0xf6, 0xdb), mix(0xff, 0xfe)),
    text: hex(mix(0x3b, 0x1d), mix(0x82, 0x4e), mix(0xf6, 0xd8)),
  };
}
