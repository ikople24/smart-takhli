const mongoose = require("mongoose");
const RecordSchema = new mongoose.Schema({
  docType: { type: String, enum: ["PARCEL", "NS3A", "CONSTRUCTION"] },
  recordKey: { type: String, unique: true },
  deedNo: { type: String, default: null, index: true },
  landNo: { type: String, default: null },
  survey: { type: String, default: null },
  parcelCode: { type: String, default: null, index: true },
  parcelMatch: {
    status: { type: String, default: null },
    method: { type: String, default: null },
    confidence: { type: String, default: null },
    basemapId: { type: mongoose.Schema.Types.ObjectId, default: null },
    candidates: { type: Array, default: [] },
    matchedAt: { type: Date, default: null },
  },
  reconcileOverride: {
    parcelCode: { type: String, default: null },
    deedNo: { type: String, default: null },
    landNo: { type: String, default: null },
    survey: { type: String, default: null },
    area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
    geometry: { type: mongoose.Schema.Types.Mixed, default: null }, // รูปแปลงที่ จนท. แก้ (เฟส 2) — canonical ไม่ถูกแตะ
    status: { type: String, default: null }, // "resolved" = จนท. ตัดสินแล้ว (auto reconcile ห้ามทับ)
    note: { type: String, default: null },
    by: { type: String, default: null },
    at: { type: Date, default: null },
  },
  area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
  owners: [{ title: String, name: String, surname: String, fullName: String, idHash: { type: String, default: null } }],
  geometry: { type: mongoose.Schema.Types.Mixed, default: null },
  hasGeometry: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "retired"], default: "active" },
  lastTxnId: { type: mongoose.Schema.Types.ObjectId, ref: "M10Transaction" },
  lastChangeType: String, lastTxnDate: Date,
  version: { type: Number, default: 1 },
  history: [{ txnId: mongoose.Schema.Types.ObjectId, changeType: String, txnDate: Date, at: Date }],
  updatedAt: { type: Date, default: Date.now },
}, { collection: "m10_records" });
RecordSchema.index({ geometry: "2dsphere" }, { sparse: true });
module.exports = mongoose.models.M10Record || mongoose.model("M10Record", RecordSchema);
