import mongoose from "mongoose";

const EmployeeHealthRecordSchema = new mongoose.Schema(
  {
    personId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmployeePerson",
      required: true,
      index: true,
    },
    department: { type: String, required: true, index: true },

    // YYYY-MM-DD (Asia/Bangkok) for idempotent daily sync
    measurementDate: { type: String, required: true, index: true },
    measuredAt: { type: Date, default: () => new Date(), index: true },

    weightKg: { type: Number, default: null },
    heightCm: { type: Number, default: null },
    sys: { type: Number, default: null },
    dia: { type: Number, default: null },
    sugarMgDl: { type: Number, default: null },

    source: {
      sheetId: { type: String, default: null },
      gid: { type: String, default: null },
      rowIndex: { type: Number, default: null },
      sheetUrl: { type: String, default: null },
      csvUrl: { type: String, default: null },
    },
  },
  { timestamps: true }
);

EmployeeHealthRecordSchema.index({ personId: 1, measurementDate: 1 }, { unique: true });

export default mongoose.models.EmployeeHealthRecord ||
  mongoose.model("EmployeeHealthRecord", EmployeeHealthRecordSchema, "employee_health_records");

