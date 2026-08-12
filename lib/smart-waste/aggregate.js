// สูตรรวมยอดของบันทึกรายวัน — แหล่งความจริงเดียวของทั้งโมดูล
// ใช้ร่วมกัน 3 จุด: API บันทึกรายวัน / การนำเข้าไฟล์ xlsx / การสร้างไฟล์ export
// แก้สูตรที่ไฟล์นี้ที่เดียว มีผลทุกที่ — ห้ามคำนวณยอดเองที่อื่น

import { WASTE_GROUP_KEYS } from './wasteGroups';

// ปัดทศนิยม 2 ตำแหน่ง — กัน 0.1 + 0.2 = 0.30000000000000004 สะสมเข้าไปในยอดรวมปี
// (น้ำหนักเป็นบวกเสมอ จึงไม่ต้องรับมือเคสติดลบ)
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function emptyGroupTotals() {
  const totals = {};
  for (const key of WASTE_GROUP_KEYS) totals[key] = 0;
  return totals;
}

// entries: [{ typeKey, group, kg }] → { groupTotals, totalKg }
export function computeTotals(entries) {
  const groupTotals = emptyGroupTotals();

  for (const entry of entries || []) {
    const kg = Number(entry?.kg);
    if (!Number.isFinite(kg) || kg <= 0) continue;
    // ใช้ Object.hasOwn ไม่ใช่ `in` — `in` เดินตาม prototype chain ทำให้กลุ่มชื่อ
    // 'toString' / 'constructor' / '__proto__' หลุดการตรวจ แล้วน้ำหนักไปโผล่เป็น
    // กลุ่มที่ 9 แบบเงียบ ๆ
    if (!Object.hasOwn(groupTotals, entry.group)) {
      throw new Error(
        `computeTotals: ไม่รู้จักกลุ่มขยะ "${entry.group}" (typeKey=${entry.typeKey})`
      );
    }
    groupTotals[entry.group] += kg;
  }

  // บวกยอดรวมจาก "ยอดกลุ่มที่ปัดแล้ว" ไม่ใช่จากผลดิบคู่ขนาน — ยอดรวมจึงเท่ากับ
  // ผลบวกของทุกกลุ่มเสมอโดยโครงสร้าง ไม่ว่าค่านำเข้าจะมีทศนิยมกี่ตำแหน่ง
  let totalKg = 0;
  for (const key of WASTE_GROUP_KEYS) {
    groupTotals[key] = round2(groupTotals[key]);
    totalKg += groupTotals[key];
  }

  return { groupTotals, totalKg: round2(totalKg) };
}

// input ดิบจากฟอร์ม/ไฟล์ → entries ที่พร้อมบันทึก
// - ตัดช่องว่าง/0/ติดลบทิ้ง (ไม่เก็บลง Mongo — เอกสารจะได้เล็ก)
// - เติม group จาก master (snapshot ไว้ในเอกสาร รายงานย้อนหลังจะได้ไม่เปลี่ยนตาม master)
// - รวมค่าถ้ามี typeKey ซ้ำ
// - เรียงตาม order ของประเภท เพื่อให้ลำดับใน Mongo คงที่ ดู diff ง่าย
// typeByKey: Map<typeKey, { group, order }>
export function normalizeEntries(rawEntries, typeByKey) {
  const merged = new Map();

  for (const raw of rawEntries || []) {
    const typeKey = raw?.typeKey;
    const kg = Number(raw?.kg);
    if (!Number.isFinite(kg) || kg <= 0) continue;

    const type = typeByKey.get(typeKey);
    if (!type) {
      throw new Error(`normalizeEntries: ไม่รู้จักประเภทขยะ "${typeKey}"`);
    }

    const existing = merged.get(typeKey);
    if (existing) {
      existing.kg = round2(existing.kg + kg);
    } else {
      merged.set(typeKey, {
        typeKey,
        group: type.group,
        kg: round2(kg),
        order: Number(type.order) || 0,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ typeKey, group, kg }) => ({ typeKey, group, kg }));
}

// เกณฑ์เตือน "ตัวเลขสูงผิดปกติ" — ไม่บล็อกการบันทึก แค่ให้ UI ถามยืนยัน
// ค่าสูงสุดที่เคยบันทึกจริงในข้อมูล 2 ปีคือ 415 กก./ประเภท/วัน
// เกณฑ์ 1,000 จึงจับการพิมพ์เกินหลักได้โดยไม่ขวางงานจริง
// อยู่ที่นี่ที่เดียวเพื่อให้ฝั่ง API และฝั่ง UI ใช้ค่าเดียวกัน
export const HIGH_KG_WARNING_THRESHOLD = 1000;

export function findHighValueEntries(entries) {
  return (entries || [])
    .filter((entry) => Number(entry?.kg) > HIGH_KG_WARNING_THRESHOLD)
    .map((entry) => ({ typeKey: entry.typeKey, kg: entry.kg }));
}
