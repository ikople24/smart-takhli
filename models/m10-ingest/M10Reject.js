const mongoose = require("mongoose");
const RejectSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "M10ImportBatch", index: true },
  source: String, docType: String,
  rawRow: { type: mongoose.Schema.Types.Mixed }, reason: String,
  createdAt: { type: Date, default: Date.now },
}, { collection: "m10_rejects" });
module.exports = mongoose.models.M10Reject || mongoose.model("M10Reject", RejectSchema);
