import mongoose from 'mongoose';

const SubmittedReportSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  community: String,
  problems: [String],
  images: [String],
  detail: String,
  location: {
    lat: Number,
    lng: Number,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    default: 'อยู่ระหว่างดำเนินการ',
  },
  officer: {
    type: String,
    default: '',
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.SubmittedReport || mongoose.model('SubmittedReport', SubmittedReportSchema);