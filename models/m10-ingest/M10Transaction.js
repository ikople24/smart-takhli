const mongoose = require("mongoose");
const TransactionSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "M10ImportBatch", index: true },
  docType: { type: String, enum: ["PARCEL", "NS3A", "CONSTRUCTION"] },
  recordKey: { type: String, default: null, index: true },
  deedNo: { type: String, default: null, index: true },
  rawStatus: String, changeType: String, taxRelevant: Boolean,
  reviewStatus: { type: String, enum: ["pending", "confirmed", "rejected", "auto"], default: "pending", index: true },
  reviewedBy: String, reviewedAt: Date,
  ltaxStatus: { type: String, enum: ["pending", "keyed", "skipped"], default: "pending", index: true },
  ltaxKeyedBy: String,
  ltaxKeyedAt: Date,
  ltaxNote: String,
  txnDate: Date, regAmount: { type: Number, default: null },
  owner: { title: String, name: String, surname: String, fullName: String, idHash: { type: String, default: null } },
  area: { rai: Number, ngan: Number, wa: Number, sqm: Number },
  geometry: { type: mongoose.Schema.Types.Mixed, default: null }, // reprojected 4326 (parcel txn)
  payloadRaw: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
}, { collection: "m10_transactions" });
// dedup index เฉพาะแถวที่มี recordKey (parcel/ns3a) — construction ไม่มี key แปลง
TransactionSchema.index({ batchId: 1, recordKey: 1, rawStatus: 1, txnDate: 1 }, { unique: true, partialFilterExpression: { recordKey: { $type: "string" } } });
TransactionSchema.index({ ltaxStatus: 1, changeType: 1 });
module.exports = mongoose.models.M10Transaction || mongoose.model("M10Transaction", TransactionSchema);
