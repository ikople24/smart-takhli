import mongoose from "mongoose";

const EducationSchema = new mongoose.Schema(
  {
    applicantId: {
      type: String,
      unique: true,
      required: true,
    },
    educationLevel: String,
    prefix: String,
    name: String,
    address: String,
    phone: String,
    note: String,
    annualIncome: {
      type: Number,
      default: 0
    },
    incomeSource: {
      type: [String],
      default: []
    },
    householdMembers: {
      type: Number,
      default: 1,
      min: 1
    },
    housingStatus: {
      type: String,
      enum: ['ผู้อาศัย', 'เจ้าของ', 'บ้านเช่า', 'อื่นๆ', 'ไม่ระบุ', ''],
      default: 'ไม่ระบุ'
    },
    receivedScholarship: {
      type: [String],
      default: []
    },
    imageUrl: {
      type: [String],
      required: true,
      validate: [
        array => Array.isArray(array) && array.length <= 3,
        'Maximum of 3 images allowed'
      ],
    },
    location: Object,
  },
  { timestamps: true }
);

export default mongoose.models.EducationRegister ||
  mongoose.model("EducationRegister", EducationSchema);
