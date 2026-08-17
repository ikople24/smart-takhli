// กลุ่มใหญ่ของขยะ — 8 กลุ่มแรกลำดับตรงกับลำดับแถวในชีต "รวม" ของไฟล์ Excel ต้นฉบับ
// กลุ่มที่เพิ่มภายหลัง (electronic, 2026-08) ต้องต่อ "ท้ายสุด" เสมอ — ห้ามแทรกกลาง
// ไม่งั้นแถวรายงาน 8 กลุ่มเดิมขยับ แล้วไฟล์ export เทียบกับรายงานปีเก่าไม่ได้
//
// กลุ่มเป็น fixed ในโค้ด (ไม่ใช่ master data ที่แอดมินแก้ได้) เพราะเป็นหัวข้อรายงาน
// ที่ส่งหน่วยงานภายนอก — เปลี่ยนเมื่อไรรายงานย้อนหลังเทียบกันไม่ได้
//
// key ใช้ camelCase เพราะถูกใช้เป็น field name ของ WasteDaily.groupTotals ใน MongoDB
// โดยตรง (จะได้ไม่ต้องแปลงกลับไปกลับมาระหว่าง snake_case กับ camelCase)

export const WASTE_GROUPS = [
  { key: 'paper', label: 'กระดาษ' },
  { key: 'plastic', label: 'พลาสติก' },
  { key: 'aluminum', label: 'อะลูมิเนียม' },
  { key: 'steel', label: 'เหล็ก' },
  { key: 'mixedMetal', label: 'โลหะผสม' },
  { key: 'glass', label: 'แก้ว' },
  { key: 'foodWaste', label: 'เศษอาหาร' },
  { key: 'kapok', label: 'นุ่น' },
  { key: 'electronic', label: 'ขยะอิเล็กทรอนิกส์' },
];

export const WASTE_GROUP_KEYS = WASTE_GROUPS.map((group) => group.key);

export function isWasteGroupKey(key) {
  return WASTE_GROUP_KEYS.includes(key);
}

export function wasteGroupLabel(key) {
  const group = WASTE_GROUPS.find((item) => item.key === key);
  return group ? group.label : key;
}
