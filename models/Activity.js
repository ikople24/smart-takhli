import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index สำหรับการค้นหา
ActivitySchema.index({ isActive: 1 });
ActivitySchema.index({ isDefault: 1 });
ActivitySchema.index({ startDate: 1, endDate: 1 });

// Update updatedAt before saving
ActivitySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ลบ Model เก่าถ้ามี
if (mongoose.models.Activity) {
  delete mongoose.models.Activity;
}

export default mongoose.model('Activity', ActivitySchema);
