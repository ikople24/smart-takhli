// ออกรหัสสมาชิกเรียงลำดับ PS-0001, PS-0002, ... (PS = พระสังข์)
// ใช้ collection `counters` ร่วมกับระบบเดิม แต่คนละ _id
//
// ⚠️ รหัสนี้ถูกพิมพ์ลงบัตร QR — ห้ามเปลี่ยน prefix/รูปแบบหลังเริ่มแจกบัตร
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";

export const MEMBER_CODE_PREFIX = "PS-";
const COUNTER_ID = "recycle_member_code";

export function formatMemberCode(n) {
  return `${MEMBER_CODE_PREFIX}${String(n).padStart(4, "0")}`;
}

export function normalizeMemberCode(raw) {
  const s = String(raw || "").trim().toUpperCase();
  const m = s.match(/^(?:PS-?)?(\d{1,6})$/);
  return m ? formatMemberCode(Number(m[1])) : s;
}

export async function nextMemberCode() {
  await dbConnect();
  const counters = mongoose.connection.db.collection("counters");
  const result = await counters.findOneAndUpdate(
    { _id: COUNTER_ID },
    { $inc: { sequence_value: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  // mongodb driver v6 คืน document ตรง ๆ, v4/v5 คืน { value }
  const doc = result && "value" in result && result.value !== undefined ? result.value : result;
  const n = doc?.sequence_value;
  if (typeof n !== "number") throw new Error("ออกรหัสสมาชิกไม่สำเร็จ");
  return formatMemberCode(n);
}
