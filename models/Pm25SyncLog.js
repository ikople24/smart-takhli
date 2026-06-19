import mongoose from "mongoose";

const Pm25SyncLogSchema = new mongoose.Schema(
  {
    job: { type: String, required: true },
    success: { type: Boolean, default: false },
    message: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "pm25_sync_logs" }
);

export default mongoose.models.Pm25SyncLog ||
  mongoose.model("Pm25SyncLog", Pm25SyncLogSchema);
