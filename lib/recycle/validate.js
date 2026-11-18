// ตรวจ/แปลงข้อมูลก่อนบันทึก — ใช้ร่วมกันทั้ง API และหน้าเว็บ (pure functions)
import { WASTE_TYPE_IDS } from "./wasteTypes";

export const MAX_KG_PER_ITEM = 1000;

/** ปัดน้ำหนักเป็นทศนิยม 2 ตำแหน่ง (กันเลขทศนิยมลอย เช่น 0.1 + 0.2) */
export function roundKg(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** แปลงข้อความน้ำหนักเป็นตัวเลข — ว่าง/ไม่ใช่ตัวเลข/ติดลบ = null */
export function parseKg(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundKg(n);
}

/**
 * รับ items แบบ [{ type, kg }] หรือ object { [type]: kg }
 * คืน { items, totalKg, errors } — ตัดรายการที่ว่าง/0 ทิ้ง, รวมประเภทซ้ำ
 */
export function normalizeDepositItems(input) {
  const errors = [];
  const pairs = Array.isArray(input)
    ? input.map((it) => [it?.type, it?.kg])
    : Object.entries(input || {});

  const byType = new Map();
  for (const [type, rawKg] of pairs) {
    if (!WASTE_TYPE_IDS.includes(type)) {
      errors.push(`ไม่รู้จักประเภทขยะ: ${type}`);
      continue;
    }
    if (rawKg === "" || rawKg === null || rawKg === undefined) continue;
    const kg = parseKg(rawKg);
    if (kg === null) {
      if (Number(rawKg) !== 0) errors.push(`น้ำหนักไม่ถูกต้อง (${type})`);
      continue;
    }
    if (kg > MAX_KG_PER_ITEM) {
      errors.push(`น้ำหนักต่อประเภทต้องไม่เกิน ${MAX_KG_PER_ITEM} กก.`);
      continue;
    }
    byType.set(type, roundKg((byType.get(type) || 0) + kg));
  }

  const items = WASTE_TYPE_IDS.filter((t) => byType.has(t)).map((t) => ({ type: t, kg: byType.get(t) }));
  const totalKg = roundKg(items.reduce((s, it) => s + it.kg, 0));
  if (!errors.length && items.length === 0) errors.push("กรุณากรอกน้ำหนักอย่างน้อย 1 ประเภท");
  return { items, totalKg, errors };
}

/** ตรวจข้อมูลสมาชิก — คืน { data, errors } */
export function normalizeMemberInput(body) {
  const errors = [];
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const data = {
    fullName: str(body?.fullName),
    phone: str(body?.phone).replace(/[^\d]/g, ""),
    community: str(body?.community),
    groupName: str(body?.groupName),
    address: str(body?.address),
    note: str(body?.note),
  };
  if (!data.fullName) errors.push("กรุณากรอกชื่อ-สกุล");
  if (data.fullName.length > 120) errors.push("ชื่อ-สกุลยาวเกินไป");
  if (data.phone && !/^0\d{8,9}$/.test(data.phone)) errors.push("เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)");
  return { data, errors };
}
