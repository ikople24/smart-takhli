// lib/smart-school/citizenId.js
// ตรวจเลขบัตรประชาชนไทย 13 หลักด้วย checksum mod 11
// หลัก 1-12 คูณน้ำหนัก 13..2 รวมกัน → check digit = (11 - sum % 11) % 10 ต้องเท่าหลักที่ 13

export function isValidCitizenId(id) {
  if (typeof id !== "string" || !/^\d{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}
