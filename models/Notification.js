import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'complaint_assigned',
      'complaint_status_updated',
      'task_pending',
      'feedback_requested',
      'admin_alert',
      'system_notice',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  actionUrl: {
    type: String,
    default: null,
  },
  relatedId: {
    type: String,
    default: null,
    index: true,
  },
  relatedType: {
    type: String,
    enum: ['complaint', 'assignment', 'feedback', 'activity', null],
    default: null,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, expiresAt: 1 });

// Pre-save hook to update updatedAt
NotificationSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Auto-delete expired notifications (TTL index)
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.Notification ||
  mongoose.model('Notification', NotificationSchema);
