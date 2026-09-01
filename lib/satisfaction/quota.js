// lib/satisfaction/quota.js
// โควตาให้คะแนนช่องทางเว็บสาธารณะ (source: public) — logic ล้วน ห้ามมี I/O
// ค่านี้ใช้ทั้งฝั่ง server (record.js) และ client (หน้า /status, CardOfficail) — แก้ที่เดียว
// ช่องทาง LINE ไม่ใช้โควตานี้ (1 คน 1 คะแนน/เรื่อง ด้วย unique index ใน models/Satisfaction.js)

export const MAX_PUBLIC_RATINGS_PER_COMPLAINT = 4;

/** ครบโควตาแล้วหรือยัง — count คือจำนวนคะแนนที่ไม่ใช่ LINE ของเรื่องนั้น */
export function isPublicQuotaFull(count) {
  return Number(count) >= MAX_PUBLIC_RATINGS_PER_COMPLAINT;
}

/** ข้อความตอบประชาชนเมื่อครบโควตา (ใช้ใน API 429 และ Swal ฝั่งฟอร์ม) */
export function publicQuotaFullMessage() {
  return `เรื่องนี้ได้รับการประเมินครบ ${MAX_PUBLIC_RATINGS_PER_COMPLAINT} ครั้งแล้ว`;
}
