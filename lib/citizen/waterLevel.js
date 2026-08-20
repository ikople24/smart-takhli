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
