const mongoose = require("mongoose");
const ImportBatchSchema = new mongoose.Schema({
  optId: String, optName: String, period: { type: String, index: true },
  files: [{ name: String }],
  fileHash: { type: String, unique: true, sparse: true }, // idempotency — กันนำเข้าซ้ำระดับ DB (ปิด concurrent-upload race)
  counts: { parcel: Number, ns3a: Number, construction: Number, geometry: Number, rejects: Number },
  status: { type: String, enum: ["processing", "done", "failed"], default: "processing" },
  importedAt: { type: Date, default: Date.now },
}, { collection: "m10_import_batches" });
module.exports = mongoose.models.M10ImportBatch || mongoose.model("M10ImportBatch", ImportBatchSchema);
