// models/flood-relief/FloodShelter.js
// ศูนย์พักพิง — collection flood_shelters (หมุดเขียวบนแผนที่แอดมิน)
import mongoose from "mongoose";

const PointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
);

const FloodShelterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: PointSchema, required: true },
    capacity: { type: Number, default: 0 },
    occupancy: { type: Number, default: 0 },
    note: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "flood_shelters" }
);

FloodShelterSchema.index({ location: "2dsphere" });

export default mongoose.models.FloodShelter || mongoose.model("FloodShelter", FloodShelterSchema, "flood_shelters");
