import mongoose from "mongoose";

const Pm25LatestSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    source: { type: String, default: "dustboy" },
    latest: {
      pm25: String,
      Time: String,
      date_select: String,
      stationName: String,
    },
    logDatetime: { type: String, default: null },
    syncedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true, collection: "pm25_latest" }
);

export default mongoose.models.Pm25Latest ||
  mongoose.model("Pm25Latest", Pm25LatestSchema);
