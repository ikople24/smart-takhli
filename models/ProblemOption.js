import mongoose from "mongoose";

const problemOptionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  iconUrl: { type: String, default: "" },
  category: { type: String, default: "" },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.ProblemOption || mongoose.model("ProblemOption", problemOptionSchema);