// ประเภทขยะตั้งต้น 24 รายการ — ถอดจากหัวคอลัมน์ของชีตรายเดือนในไฟล์ Excel เดิม
// ใช้เป็น seed ครั้งแรกของ collection smart_waste_types เท่านั้น
// หลังจากนั้นแอดมินแก้/เพิ่ม/ปิดประเภทผ่านหน้าจัดการได้เอง — ไฟล์นี้จะไม่เขียนทับของเดิม
//
// order = ลำดับคอลัมน์ในไฟล์เดิม ใช้คุม layout ตอน export ให้ตรงต้นฉบับ
// isCommon = ประเภทที่กรอกแทบทุกวัน → เด้งขึ้นหน้าแรกของฟอร์มมือถือ
//            (คัดจากข้อมูลจริง 2 ปี: แต่ละวันกรอกจริงแค่ 5–10 ช่องจาก 24)
// isHighlighted = ประเภทที่เจ้าหน้าที่สนใจเป็นพิเศษ → StatCard ของตัวเองบน dashboard
//            + แถว "เฉพาะ<label>" ในชีต "รวม" ตอน export

export const WASTE_TYPES_SEED = [
  { key: 'paper_mixed', label: 'กระดาษรวม', group: 'paper', order: 1 },
  { key: 'paper_carton', label: 'กระดาษลัง', group: 'paper', order: 2 },
  { key: 'paper_white_black', label: 'กระดาษขาวดำ', group: 'paper', order: 3 },
  { key: 'plastic_rigid', label: 'พลาสติกกรอบ', group: 'plastic', order: 4 },
  { key: 'plastic_mixed', label: 'พลาสติกรวม', group: 'plastic', order: 5, isCommon: true },
  { key: 'plastic_pet', label: 'ขวดพลาสติก PET', group: 'plastic', order: 6, isCommon: true },
  { key: 'plastic_bottle_clear', label: 'ขวดพลาสติกใส', group: 'plastic', order: 7 },
  { key: 'plastic_bottle_hdpe', label: 'ขวดพลาสติกขุ่น', group: 'plastic', order: 8 },
  { key: 'plastic_hose', label: 'สายยาง', group: 'plastic', order: 9 },
  { key: 'plastic_strap', label: 'สายรัดของ', group: 'plastic', order: 10 },
  { key: 'plastic_linoleum', label: 'เสื่อน้ำมัน', group: 'plastic', order: 11 },
  { key: 'plastic_pvc_pipe', label: 'ท่อ PVC', group: 'plastic', order: 12 },
  { key: 'plastic_boots', label: 'รองเท้าบู้ท', group: 'plastic', order: 13 },
  // ไฟล์เดิมเขียนหัวคอลัมน์ว่า "สายไฟ" แต่สูตร รวม!พลาสติก = SUM(รวมละเอียด!B5:B15, B24)
  // นับคอลัมน์นี้เป็นพลาสติก → ของจริงคือ "เปลือกสายไฟ" (ฉนวนหุ้ม) ไม่ใช่ทองแดง
  { key: 'plastic_wire_sheath', label: 'เปลือกสายไฟ', group: 'plastic', order: 14 },
  { key: 'glass_clear', label: 'ขวดแก้วใส', group: 'glass', order: 15, isCommon: true },
  { key: 'glass_amber', label: 'ขวดแก้วแดง', group: 'glass', order: 16, isCommon: true },
  { key: 'glass_green', label: 'ขวดแก้วเขียว', group: 'glass', order: 17 },
  { key: 'metal_tin_can', label: 'กระป๋องสังกะสี', group: 'mixedMetal', order: 18, isCommon: true },
  { key: 'aluminum_can', label: 'กระป๋องอลูมิเนียม', group: 'aluminum', order: 19 },
  { key: 'aluminum_scrap', label: 'เศษอลูมิเนียม', group: 'aluminum', order: 20 },
  { key: 'steel_scrap', label: 'เหล็ก', group: 'steel', order: 21 },
  // หัวคอลัมน์ในไฟล์เดิมคือ "ปุ๋ย" แต่ชีต "รวม" นับเป็นกลุ่ม "เศษอาหาร"
  { key: 'food_waste_compost', label: 'ปุ๋ย', group: 'foodWaste', order: 22, isCommon: true },
  {
    key: 'plastic_soft_bag',
    label: 'ถุงอ่อน',
    group: 'plastic',
    order: 23,
    isCommon: true,
    isHighlighted: true,
  },
  { key: 'kapok', label: 'นุ่น', group: 'kapok', order: 24 },
];

// หัวคอลัมน์ที่เขียนไม่ตรงกับ label ในไฟล์ Excel เก่า → typeKey
// เก็บไว้ที่นี่เพราะเป็นเรื่องของไฟล์เก่าโดยเฉพาะ ไม่ใช่ข้อมูลของระบบ
// (ไม่เก็บใน WasteType เพราะไม่อยากให้แอดมินเห็น/แก้ได้)
export const LEGACY_HEADER_ALIASES = {
  สายไฟ: 'plastic_wire_sheath',
};
