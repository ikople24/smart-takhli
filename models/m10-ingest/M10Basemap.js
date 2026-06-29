const mongoose = require("mongoose");
const BasemapSchema = new mongoose.Schema({
  parcelCode: { type: String, index: true }, // ไม่ unique — basemap มีซ้ำ 93
  zoneId: String, blockId: String, lot: String,
  deedNo: { type: String, default: null, index: true }, // Chanod_no → string (ซ้ำได้)
  landNo: { type: String, default: null },
  survey: { type: String, default: null },
  landType: String,
  area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
  geometry: { type: mongoose.Schema.Types.Mixed, default: null }, // Polygon 2D (4326)
}, { collection: "m10_basemap" });
BasemapSchema.index({ geometry: "2dsphere" });
module.exports = mongoose.models.M10Basemap || mongoose.model("M10Basemap", BasemapSchema);
