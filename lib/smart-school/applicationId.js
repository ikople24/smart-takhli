// lib/smart-school/applicationId.js
import mongoose from "mongoose";

// ออกเลขใบสมัครแบบ atomic ผ่าน collection school_counters
// (แก้ปัญหาเดิมที่ใช้ countDocuments()+1 แล้วเลขชนจนต้องมี endpoint reset)
// รูปแบบ: TKC<ปีงบ 2 หลักท้าย>-<เลขรัน 3 หลัก> เช่น TKC69-001
export async function nextApplicationId(surveyYearBE) {
  const res = await mongoose.connection.db
    .collection("school_counters")
    .findOneAndUpdate(
      { _id: `app-${surveyYearBE}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
  // mongo driver v4-5 คืน { value: doc }, v6 คืน doc ตรง ๆ — รองรับทั้งคู่
  const doc = res && res.value !== undefined ? res.value : res;
  return `TKC${String(surveyYearBE).slice(-2)}-${String(doc.seq).padStart(3, "0")}`;
}
