// lib/citizen/pm25Level.js
// ระดับ PM2.5 สำหรับการ์ดหน้าแรกโฉมใหม่ — เกณฑ์เดียวกับ getPm25LevelInfo
// ใน components/Pmdata.js (มาตรฐานกรมควบคุมมลพิษ) ห้ามแก้เกณฑ์ฝั่งเดียว
export function pm25Level(value) {
  const pm = parseFloat(value);
  if (!pm || Number.isNaN(pm) || pm <= 0) {
    return { key: "none", label: "ไม่มีข้อมูล", chipBg: "#F1F0F5", chipText: "#6B6880", dot: "#9590A8" };
  }
  if (pm <= 15) {
    return { key: "verygood", label: "ดีมาก", chipBg: "#E6F1FE", chipText: "#2563C9", dot: "#3B82F6" };
  }
  if (pm <= 25) {
    return { key: "good", label: "ดี", chipBg: "#E6F6EC", chipText: "#1B935A", dot: "#27AE60" };
  }
  if (pm <= 37.5) {
    return { key: "moderate", label: "ปานกลาง", chipBg: "#FEF6E0", chipText: "#C77E10", dot: "#F2A93B" };
  }
  if (pm <= 75) {
    return { key: "unhealthy", label: "มีผลต่อสุขภาพ", chipBg: "#FDEBE3", chipText: "#C2410C", dot: "#EA580C" };
  }
  return { key: "hazardous", label: "มีผลต่อสุขภาพมาก", chipBg: "#FDE5E7", chipText: "#B91C1C", dot: "#DC2626" };
}
