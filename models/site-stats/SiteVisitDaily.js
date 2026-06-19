import mongoose from "mongoose";

const SiteVisitDailySchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD (Asia/Bangkok)
    count: { type: Number, default: 0 },
  },
  { collection: "site_visit_daily", timestamps: true }
);

export default mongoose.models.SiteVisitDaily ||
  mongoose.model("SiteVisitDaily", SiteVisitDailySchema);
