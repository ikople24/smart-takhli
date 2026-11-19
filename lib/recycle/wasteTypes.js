// ประเภทขยะรีไซเคิลที่รับฝาก — โครงการพระสังข์หอบทอง
// บันทึกเป็นน้ำหนัก (กก.) อย่างเดียว ไม่คิดเงิน/แต้ม
//
// ⚠️ `id` ถูกเก็บลง recycle_deposits.items[].type — ห้ามเปลี่ยน id ที่ใช้งานแล้ว
// (เปลี่ยนได้เฉพาะ label) ถ้าเลิกรับประเภทไหนให้ตั้ง active: false แทนการลบ

export const WASTE_GROUPS = [
  { id: "plastic", label: "พลาสติก", chipClass: "bg-blue-50 text-blue-700" },
  { id: "paper", label: "กระดาษ", chipClass: "bg-amber-50 text-amber-800" },
  { id: "metal", label: "โลหะ", chipClass: "bg-slate-100 text-slate-700" },
  { id: "glass", label: "แก้ว", chipClass: "bg-teal-50 text-teal-700" },
];

export const WASTE_TYPES = [
  { id: "plastic_pet", group: "plastic", label: "ขวดพลาสติกใส (PET)", active: true },
  { id: "plastic_hdpe", group: "plastic", label: "พลาสติกขุ่น / สี", active: true },
  { id: "paper_box", group: "paper", label: "กระดาษลัง", active: true },
  { id: "paper_office", group: "paper", label: "กระดาษขาว-ดำ", active: true },
  { id: "metal_can", group: "metal", label: "กระป๋องอลูมิเนียม", active: true },
  { id: "metal_iron", group: "metal", label: "เหล็ก / โลหะอื่น", active: true },
  { id: "glass_bottle", group: "glass", label: "ขวดแก้ว", active: true },
];

export const WASTE_TYPE_IDS = WASTE_TYPES.map((t) => t.id);

export function getWasteTypeLabel(id) {
  return WASTE_TYPES.find((t) => t.id === id)?.label || id;
}

export function getActiveTypesByGroup() {
  return WASTE_GROUPS.map((g) => ({
    ...g,
    types: WASTE_TYPES.filter((t) => t.group === g.id && t.active),
  })).filter((g) => g.types.length > 0);
}
