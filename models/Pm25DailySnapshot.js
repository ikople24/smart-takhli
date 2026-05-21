import mongoose from "mongoose";

const Pm25DailySnapshotSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    days: [
      {
        date: String,
        ymd: String,
        avg: Number,
        dayName: String,
      },
    ],
    syncedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true, collection: "pm25_daily_snapshot" }
);

export default mongoose.models.Pm25DailySnapshot ||
  mongoose.model("Pm25DailySnapshot", Pm25DailySnapshotSchema);
