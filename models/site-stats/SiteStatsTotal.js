import mongoose from "mongoose";

const SiteStatsTotalSchema = new mongoose.Schema(
  {
    _id: { type: String }, // คงที่ "total"
    count: { type: Number, default: 0 },
  },
  { collection: "site_stats_total", timestamps: true }
);

export default mongoose.models.SiteStatsTotal ||
  mongoose.model("SiteStatsTotal", SiteStatsTotalSchema);
