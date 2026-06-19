import mongoose from "mongoose";

const SiteOnlineSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true },
    lastSeen: { type: Date, default: Date.now },
  },
  { collection: "site_online" }
);

// TTL: doc หมดอายุ 300 วินาทีหลัง lastSeen (ถือว่าออฟไลน์)
SiteOnlineSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 300 });

export default mongoose.models.SiteOnline ||
  mongoose.model("SiteOnline", SiteOnlineSchema);
