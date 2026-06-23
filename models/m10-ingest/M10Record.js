const mongoose = require("mongoose");
const RecordSchema = new mongoose.Schema({
  docType: { type: String, enum: ["PARCEL", "NS3A", "CONSTRUCTION"] },
  recordKey: { type: String, unique: true },
  deedNo: { type: String, default: null, index: true },
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
