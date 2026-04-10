import mongoose from "mongoose";

const EmployeePersonSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, index: true },
    department: { type: String, required: true, index: true },
    phone: { type: String, default: null },
    notes: { type: String, default: null },
    source: { type: String, default: "sheet" },
  },
  { timestamps: true }
);

EmployeePersonSchema.index({ fullName: 1, department: 1 }, { unique: true });

export default mongoose.models.EmployeePerson ||
  mongoose.model("EmployeePerson", EmployeePersonSchema, "employee_people");

