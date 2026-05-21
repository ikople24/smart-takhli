import mongoose from "mongoose";

const Pm25SettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    dataMode: {
      type: String,
      enum: ["sheet_with_api_fallback", "sheet_only", "api_only"],
      default: "sheet_with_api_fallback",
    },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, collection: "pm25_settings" }
);

export default mongoose.models.Pm25Settings ||
  mongoose.model("Pm25Settings", Pm25SettingsSchema);
