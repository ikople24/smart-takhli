import mongoose from "mongoose";

const ElderlyPersonSchema = new mongoose.Schema(
  {
    citizenId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, index: true },
    ageYears: { type: Number, default: null },
    birthDateText: { type: String, default: null }, // keep raw text from sheet (e.g. "1/1/2490")
    bloodType: { type: String, default: null },
    address: { type: String, default: null },
    phone: { type: String, default: null },
    occupation: { type: String, default: null },

    // often constant across visits
    heightCm: { type: Number, default: null },
    baselineWeightKg: { type: Number, default: null }, // น้ำหนักตั้งต้น (จากคอลัมน์น้ำหนักหลัก เช่น F)

    // metadata
    sourceYearFirstSeen: { type: Number, default: null }, // e.g. 2568
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.ElderlyPerson ||
  mongoose.model("ElderlyPerson", ElderlyPersonSchema, "elderly_people");


