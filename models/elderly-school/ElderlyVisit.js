import mongoose from "mongoose";

const ElderlyVisitSchema = new mongoose.Schema(
  {
    personId: { type: mongoose.Schema.Types.ObjectId, ref: "ElderlyPerson", required: true, index: true },
    yearBE: { type: Number, required: true, index: true }, // 2568, 2569, ...
    visitNo: { type: Number, required: true, min: 1, max: 16, index: true },

    measuredAt: { type: Date, default: null }, // optional; sheet timestamp may be backfilled
    checkinDate: { type: String, default: null }, // YYYY-MM-DD (Asia/Bangkok) for "1 day 1 submission" rules (public check-in)

    // Measurements
    weightKg: { type: Number, default: null },
    heightCm: { type: Number, default: null },
    waistCm: { type: Number, default: null },
    pulseBpm: { type: Number, default: null },

    bp1Sys: { type: Number, default: null },
    bp1Dia: { type: Number, default: null },
    bp2Sys: { type: Number, default: null },
    bp2Dia: { type: Number, default: null },

    // metadata
    source: { type: String, default: "manual" }, // sheet2568, sheet2569, manual
    note: { type: String, default: null },
    editedBy: { type: String, default: null },
    editReason: { type: String, default: null },
  },
  { timestamps: true }
);

// prevent duplicates per person-year-visit
ElderlyVisitSchema.index({ personId: 1, yearBE: 1, visitNo: 1 }, { unique: true });
// prevent multiple check-ins per day (only when checkinDate exists)
ElderlyVisitSchema.index(
  { personId: 1, yearBE: 1, checkinDate: 1 },
  { unique: true, partialFilterExpression: { checkinDate: { $type: "string" } } }
);

export default mongoose.models.ElderlyVisit ||
  mongoose.model("ElderlyVisit", ElderlyVisitSchema, "elderly_visits");


