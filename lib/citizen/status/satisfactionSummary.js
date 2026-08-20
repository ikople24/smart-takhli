// lib/citizen/status/satisfactionSummary.js
// สรุปผลประเมินความพึงพอใจของเรื่องหนึ่ง — เกณฑ์ %/ป้ายข้อความยกมาจาก
// components/SatisfactionChart.js (การ์ดเดิม) ให้ตัวเลขฝั่งประชาชนตรงกันทุกจอ
// ดาว 1–5 → เปอร์เซ็นต์ = ค่าเฉลี่ย × 20 (ปัดเป็นจำนวนเต็ม)

export const MAX_RATINGS = 4; // 1 เรื่องให้คะแนนได้ 4 ครั้ง (กติกาเดิม)

// ป้ายข้อความ/โทนสีตามเปอร์เซ็นต์ — ขอบเขตเดียวกับการ์ดเดิม
export function satisfactionLabel(percent) {
  if (percent >= 80) return { text: "พอใจมาก", tone: "great" };
  if (percent >= 60) return { text: "พอใจ", tone: "good" };
  if (percent >= 40) return { text: "ปานกลาง", tone: "fair" };
  return { text: "ควรปรับปรุง", tone: "poor" };
}

export function summarizeSatisfaction(rows) {
  // ระวัง Number(null) = 0 (finite) — ต้องกัน null/undefined/ค่าว่างก่อน
  // ไม่งั้นแถวที่ไม่มีคะแนนจะถูกนับเป็น 0 ดาวแล้วดึงค่าเฉลี่ยตกโดยไม่ควร
  const list = (Array.isArray(rows) ? rows : []).filter(
    (r) => r && r.rating != null && r.rating !== "" && Number.isFinite(Number(r.rating))
  );
  if (list.length === 0) {
    return { count: 0, average: 0, percent: 0, label: null, comments: [] };
  }
  const ratings = list.map((r) => Number(r.rating));
  const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const percent = Math.round(average * 20);
  return {
    count: list.length,
    average,
    percent,
    label: satisfactionLabel(percent),
    // เฉพาะรายการที่พิมพ์ความเห็นมาจริง (ตัดช่องว่างล้วนทิ้ง) เรียงใหม่ก่อน
    comments: list.filter((r) => String(r.comment ?? "").trim().length > 0),
  };
}
