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

    // เก็บรายละเอียดการวัดหลายครั้งต่อวัน (เช้า/เย็น ฯลฯ)
    // โดยยังคง raw/tap/note ด้านบนเป็น "ค่าล่าสุดของวัน" เพื่อให้ UI เดิมใช้งานได้
    latestMeasuredAt: { type: Date, default: null },
    measurements: [
      {
        measuredAt: { type: Date, default: null },
        sourceTimestamp: { type: String, default: "" }, // ค่าดิบจากชีต (ใช้กันซ้ำ)
        village: { type: String, default: "" },
        raw: {
          turbidityNtu: { type: Number, default: null },
          ph: { type: Number, default: null },
          tdsMgL: { type: Number, default: null },
        },
        tap: {
          turbidityNtu: { type: Number, default: null },
          ph: { type: Number, default: null },
          tdsMgL: { type: Number, default: null },
          freeChlorineSourceMgL: { type: Number, default: null },
          freeChlorineEndMgL: { type: Number, default: null },
        },
        note: { type: String, default: "" },
      },
    ],

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


