import mongoose from "mongoose";

const Pm25MonthlySchema = new mongoose.Schema(
  {
    monthKey: { type: String, required: true, unique: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    avg: { type: Number, required: true },
    count: { type: Number, default: 0 },
    syncedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "pm25_monthly" }
);

export default mongoose.models.Pm25Monthly ||
  mongoose.model("Pm25Monthly", Pm25MonthlySchema);
