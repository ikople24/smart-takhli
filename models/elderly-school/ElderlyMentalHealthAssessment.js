import mongoose from "mongoose";

const ElderlyMentalHealthAssessmentSchema = new mongoose.Schema(
  {
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyPerson",
      required: true,
      index: true,
    },
    yearBE: { type: Number, required: true, index: true }, // 2568, 2569, ...

    // YYYY-MM-DD (Asia/Bangkok) for grouping/reporting
    assessmentDate: { type: String, required: true, index: true },

    // 2Q
    q2: {
      q1: { type: Boolean, required: true }, // ซึมเศร้า/หดหู่/หมดหวัง
      q2: { type: Boolean, required: true }, // เบื่อ/ไม่อยากทำอะไร
      positive: { type: Boolean, required: true, index: true },
    },

    // 9Q (optional; only when 2Q positive or staff chooses to do it)
    q9: {
      answers: {
        type: [Number], // length 9; each 0..3
        default: null,
      },
      totalScore: { type: Number, default: null, index: true },
      severity: {
        type: String,
        enum: ["none", "mild", "moderate", "severe", "unknown"],
        default: "unknown",
        index: true,
      },
      suicidalRisk: { type: Boolean, default: null, index: true }, // derived from item 9 > 0
    },

    // metadata
    assessedAt: { type: Date, default: () => new Date(), index: true },
    assessedBy: { type: String, default: null }, // optional user id/name
    note: { type: String, default: null },
  },
  { timestamps: true }
);

// Prevent duplicate assessments per person per day per year (editable by overwrite via API if needed)
ElderlyMentalHealthAssessmentSchema.index(
  { personId: 1, yearBE: 1, assessmentDate: 1 },
  { unique: true }
);

export default mongoose.models.ElderlyMentalHealthAssessment ||
  mongoose.model(
    "ElderlyMentalHealthAssessment",
    ElderlyMentalHealthAssessmentSchema,
    "elderly_mental_health_assessments"
  );

