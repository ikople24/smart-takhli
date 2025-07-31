import mongoose from 'mongoose';

const StudentFeedbackSchema = new mongoose.Schema({
  grade: {
    type: String,
    required: true,
    enum: ['ประถมศึกษา', 'มัธยมศึกษาตอนต้น', 'มัธยมศึกษาตอนปลาย', 'อุดมศึกษา']
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  emotionLevel: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  category: {
    type: String,
    required: true,
    enum: ['ทั่วไป', 'สุขภาพ', 'การศึกษา', 'สิ่งแวดล้อม', 'การคมนาคม',  'สวัสดิการสังคม','สันทนาการ'  ,'อื่นๆ']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  ipAddress: {
    type: String,
    required: false
  }
});

// Index สำหรับการค้นหาและจัดกลุ่ม
StudentFeedbackSchema.index({ createdAt: -1 });
StudentFeedbackSchema.index({ emotionLevel: 1 });
StudentFeedbackSchema.index({ category: 1 });
StudentFeedbackSchema.index({ grade: 1 });
StudentFeedbackSchema.index({ isApproved: 1 });

// ลบ Model เก่าถ้ามี
if (mongoose.models.StudentFeedback) {
  delete mongoose.models.StudentFeedback;
}

export default mongoose.model('StudentFeedback', StudentFeedbackSchema); 