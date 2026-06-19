import mongoose from "mongoose";

const OrganizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  address: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "" },
  website: { type: String, default: "" },
  appId: { type: String, required: true, index: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Organization || mongoose.model("Organization", OrganizationSchema, "organizations");
