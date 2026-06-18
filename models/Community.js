import mongoose from "mongoose";

const CommunitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  population: { type: Number, default: null },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  appId: { type: String, required: true, index: true },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.models.Community || mongoose.model("Community", CommunitySchema, "communities");
