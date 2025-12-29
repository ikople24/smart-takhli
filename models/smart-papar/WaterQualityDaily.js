import mongoose from "mongoose";

// บันทึกคุณภาพน้ำรายวัน (จุดเดียว: โรงผลิต)
const WaterQualityDailySchema = new mongoose.Schema(
  {
    // YYYY-MM-DD (อ้างอิงตามวันในไทย) ใช้เป็นคีย์หลักของ "รายวัน"
    recordDate: { type: String, required: true, index: true },

    raw: {
      turbidityNtu: { type: Number, default: null }, // ความขุ่น NTU
      ph: { type: Number, default: null }, // 0-14
      tdsMgL: { type: Number, default: null }, // mg/L
    },

    tap: {
      turbidityNtu: { type: Number, default: null }, // NTU
      ph: { type: Number, default: null }, // 0-14
      tdsMgL: { type: Number, default: null }, // mg/L
      freeChlorineSourceMgL: { type: Number, default: null }, // mg/L (ต้นทาง)
      freeChlorineEndMgL: { type: Number, default: null }, // mg/L (ปลายทาง)
    },

    note: { type: String, default: "" },

    createdByClerkId: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    updatedByClerkId: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { collection: "smart_papar_water_quality_daily", timestamps: true }
);

// จุดเดียว + รายวัน → ห้ามซ้ำ
WaterQualityDailySchema.index({ recordDate: 1 }, { unique: true });

export default mongoose.models.WaterQualityDaily ||
  mongoose.model("WaterQualityDaily", WaterQualityDailySchema);


