// ค่าคงที่โมดูลเสาไฟสาธารณะ (smart-light) — enum + label/สี ใช้ร่วมกัน UI และ API

// สถานะเสา: เก็บใน DB เป็นอังกฤษ แสดงผลไทย + สีหมุดบนแผนที่
export const POLE_STATUS = {
  normal: { label: "ปกติ", color: "#16A34A" },
  damaged: { label: "ชำรุด", color: "#F59E0B" },
  off: { label: "ดับ", color: "#DC2626" },
  unknown: { label: "ยังไม่สำรวจ", color: "#9CA3AF" },
};
export const POLE_STATUS_VALUES = Object.keys(POLE_STATUS);
// สถานะที่บันทึกจากการสำรวจได้ (ไม่รวม unknown ซึ่งเป็นค่าตั้งต้นเท่านั้น)
export const SURVEY_STATUS_VALUES = ["normal", "damaged", "off"];

export const LAMP_TYPE = {
  led: { label: "LED" },
  other: { label: "หลอดอื่น" },
  unknown: { label: "ไม่ระบุ" },
};
export const LAMP_TYPE_VALUES = Object.keys(LAMP_TYPE);

// รหัสเสา TK-LED-ปปดด##### (ปี พ.ศ. 2 หลัก + เดือน 2 หลัก + เลขต้น 5 หลักวิ่งต่อเนื่อง)
export const POLE_CODE_PREFIX = "TK-LED";

// เรนเดอร์ตามสเกลซูม: zoom >= ค่านี้วาดหมุดรายต้น, ต่ำกว่าวาด bubble รายกลุ่ม
export const POLE_ZOOM_THRESHOLD = 15;

// ศูนย์กลางเริ่มต้น (เทศบาลเมืองตาคลี — ค่าเดียวกับ MapPoints ของ smart-school)
export const DEFAULT_MAP_CENTER = [15.259, 100.349];
export const DEFAULT_MAP_ZOOM = 13;
