import mongoose from 'mongoose';

const SubmittedReportSchema = new mongoose.Schema({

  fullName: String,
  phone: String,
  community: String,
  problems: [String],
  category: String,
  images: [String],
  detail: String,
  location: {
    lat: Number,
    lng: Number,
  },
  prefix: String,
  address: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  complaintId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'อยู่ระหว่างดำเนินการ',
  },
  officer: {
    type: String,
    default: 'on',
  },
  isConfidential: { type: Boolean, default: false },
  pdpaSensitive: { type: Boolean, default: false },
  pdpaDetailRedactions: {
    type: [
      {
        start: { type: Number, required: true },
        end: { type: Number, required: true },
      },
    ],
    default: [],
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  // LINE OA Integration — เก็บ LINE userId เมื่อ user ติดต่อผ่าน LINE Bot
  lineUserId: {
    type: String,
    default: null,
  },
});

export default mongoose.models.SubmittedReport || mongoose.model('SubmittedReport', SubmittedReportSchema);