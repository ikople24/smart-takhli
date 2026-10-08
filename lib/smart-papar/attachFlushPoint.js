// ฝั่งเซิร์ฟเวอร์: ตรวจว่า flushPointId ที่ส่งมามีอยู่จริงในทะเบียนหัวโบล์ แล้วเติม flushPointCode (สำเนา)
// คืน { ok: true, value } หรือ { ok: false, errors } — ใช้ร่วมกันทุก API ที่สร้าง/แก้บันทึกโบตะกอน
import FlushPoint from "@/models/smart-papar/FlushPoint";

export async function attachFlushPoint(value) {
  if (!value.flushPointId) return { ok: true, value: { ...value, flushPointId: null, flushPointCode: "" } };
  const point = await FlushPoint.findOne({ _id: value.flushPointId, active: true }).select({ code: 1 }).lean();
  if (!point) return { ok: false, errors: { flushPointId: "ไม่พบหัวโบล์ที่เลือกในทะเบียน" } };
  return { ok: true, value: { ...value, flushPointCode: point.code } };
}
