/** คำอธิบายกลุ่มข้อมูลบุคคล — ให้ตรงกับ PersonDataTable (DATA_GROUPS) */
const LABEL_BY_VALUE = {
  elderly_social: "ติดสังคม",
  elderly_home: "ติดบ้าน",
  elderly_bed: "ติดเตียง (สูงอายุ)",
  elderly_98: "อายุ 98 ปีขึ้นไป",
  disabled: "ผู้พิการ (ทั่วไป)",
  disabled_move: "พิการทางการเคลื่อนไหว",
  disabled_vision: "พิการทางการมองเห็น",
  disabled_hearing: "พิการทางการได้ยิน",
  disabled_mental: "พิการทางจิตใจ",
  disabled_intellect: "พิการทางสติปัญญา",
  chronic: "โรคเรื้อรัง",
  bedridden: "ผู้ป่วยติดเตียง",
  palliative: "ผู้ป่วยระยะสุดท้าย",
  alone: "อยู่คนเดียว",
  poor: "ผู้ยากไร้",
  general: "ทั่วไป",
};

export function getPersonDataGroupLabel(dataGroup) {
  if (dataGroup == null || dataGroup === "") return "ไม่ระบุกลุ่ม";
  const key = String(dataGroup).trim();
  return LABEL_BY_VALUE[key] || key;
}
