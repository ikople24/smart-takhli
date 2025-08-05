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
    actualAddress: {
      type: String,
      default: ''
    },
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
    familyStatus: {
      type: [String],
      enum: ['บิดา-มารดาแยกกันอยู่', 'แยกกันอยู่ชั่วคราว', 'หย่าร้าง', 'บิดาส่งเสีย', 'มารดาส่งเสีย', 'บิดา/มารดาไม่ได้ส่งเสีย'],
      default: []
    },
    receivedScholarship: {
      type: [String],
      default: []
    },
    takhliScholarshipHistory: {
      type: [String],
      enum: ['เคยได้รับทุนการศึกษา ปีงบประมาณ 2565', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2566', 'เคยได้รับทุนการศึกษา ปีงบประมาณ 2567', 'ไม่เคยได้รับทุนการศึกษา'],
      default: []
    },
    schoolName: {
      type: String,
      default: ''
    },
    gradeLevel: {
      type: String,
      default: ''
    },
    gpa: {
      type: Number,
      min: 0,
      max: 4,
      default: null
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
