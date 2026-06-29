const mongoose = require("mongoose");
// ชั้นการแก้ basemap ของเจ้าหน้าที่ (source of truth) — replay ทับ m10_basemap หลัง import ทุกครั้ง
const BasemapEditSchema = new mongoose.Schema({
  parcelCode: { type: String, unique: true }, // 1 edit ต่อรหัส (upsert latest-wins)
  deedNo: { type: String, default: null },
  landNo: { type: String, default: null },
  survey: { type: String, default: null },
  area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
  geometry: { type: mongoose.Schema.Types.Mixed, default: null }, // null = แก้เฉพาะ attribute
  kind: { type: String, enum: ["edit", "new"], default: "edit" },
  by: { type: String, default: null },
  at: { type: Date, default: Date.now },
  note: { type: String, default: null },
}, { collection: "m10_basemap_edit" });
module.exports = mongoose.models.M10BasemapEdit || mongoose.model("M10BasemapEdit", BasemapEditSchema);
