// lib/smart-school/citizenId.js
// helper กลางเลขบัตรประชาชน 13 หลัก — pure function ใช้ได้ทั้ง server และ client
// (ห้าม import mongoose/model ในไฟล์นี้ — client component ใช้ตรวจ checksum ด้วย)

// ตัดขีด/ช่องว่าง เหลือ digits-only
export function normalizeCitizenId(input = "") {
  return String(input || "").replace(/\D/g, "");
}

// 13 หลัก + checksum mod-11: หลักที่ 13 = (11 - (Σ หลักที่ i × (13-i)) mod 11) mod 10
export function isValidThaiCitizenId(input = "") {
  const d = normalizeCitizenId(input);
  if (!/^\d{13}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

// มาสก์ตามฟอร์แมตบัตร 1-2345-67890-12-3 → เห็นหลัก 1–5 กับหลักสุดท้าย: "1-2345-xxxxx-xx-3"
export function maskCitizenId(input = "") {
  const d = normalizeCitizenId(input);
  if (d.length !== 13) return "";
  return `${d[0]}-${d.slice(1, 5)}-xxxxx-xx-${d[12]}`;
}
