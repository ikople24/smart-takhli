// lib/citizen/maskName.js
// ปิดนามสกุลเจ้าหน้าที่ก่อนแสดงฝั่งประชาชน (เจ้าของสั่ง 2026-08-20 — ตามแคนวาส
// "นายวิชัย xxxxxx"): เก็บคำแรกไว้ ส่วนที่เหลือแทนด้วย xxxxxx เดียว
export function maskOfficerName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  const [first, ...rest] = trimmed.split(/\s+/);
  return rest.length > 0 ? `${first} xxxxxx` : first;
}
