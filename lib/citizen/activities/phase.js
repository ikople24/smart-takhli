// lib/citizen/activities/phase.js
// ช่วงสถานะกิจกรรมจากวันเริ่ม-สิ้นสุด — เกณฑ์เดียวกับ getActivityStatus ใน
// pages/activities.tsx (หน้าเดิม): now < start = กำลังจะเริ่ม · now > end =
// สิ้นสุดแล้ว · ระหว่างนั้น = กำลังดำเนินการ · รับ now เป็นพารามิเตอร์เพื่อเทสต์ได้
export function activityPhase(activity, now = new Date()) {
  const start = new Date(activity.startDate);
  const end = new Date(activity.endDate);
  if (now < start) {
    return { key: "upcoming", label: "กำลังจะเริ่ม", chipBg: "#FEF6E0", chipText: "#C77E10", dot: "#F2A93B" };
  }
  if (now > end) {
    return { key: "ended", label: "สิ้นสุดแล้ว", chipBg: "#F1F0F5", chipText: "#6B6880", dot: "#9590A8" };
  }
  return { key: "active", label: "กำลังดำเนินการ", chipBg: "#E6F6EC", chipText: "#1B935A", dot: "#27AE60" };
}
