import mongoose from "mongoose";

const SatisfactionSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Complaint",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    default: "",
  },
  // 'public' = ใครก็ได้ที่เปิดการ์ดเรื่องในหน้า /status แล้วกดให้คะแนน (สูงสุด 4 ครั้ง/เรื่อง)
  // 'line'   = คนที่ผูก LINE ไว้กับเรื่องนี้ กดจากการ์ดในแชท (1 ครั้ง/เรื่อง แก้ได้)
  //            ⚠️ การผูก lineUserId เป็นแบบ first-come จากการพิมพ์เลขเรื่องที่ไล่เดาได้
  //            'line' จึงแปลว่า "คนที่ผูก LINE กับเรื่องนี้" ไม่ใช่ "ยืนยันตัวตนแล้ว"
  source: {
    type: String,
    enum: ["public", "line"],
    default: "public",
    index: true,
  },
  lineUserId: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 1 LINE user ให้คะแนนได้ 1 ครั้งต่อเรื่อง — กดซ้ำต้องอัปเดตแถวเดิม ไม่ใช่เพิ่มแถว
// partial: แถวฝั่งเว็บที่ lineUserId เป็น null ไม่เข้า index จึงยังซ้ำได้ตามโควตาเดิม
SatisfactionSchema.index(
  { complaintId: 1, lineUserId: 1 },
  { unique: true, partialFilterExpression: { lineUserId: { $type: "string" } } }
);

export default mongoose.models.Satisfaction || mongoose.model("Satisfaction", SatisfactionSchema);