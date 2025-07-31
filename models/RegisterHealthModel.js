import mongoose from 'mongoose';

const RegisterHealthSchema = new mongoose.Schema(
  {
    ob_code: { type: String, required: true },
    ob_type: { type: String, required: true },
    ob_status: { type: Boolean, default: true }, // true = available, false = in use
    registered_by: { type: String },
    note: { type: String },
    id_code_th: { type: String },
    index_id_tk: { type: String },
  },
  {
    timestamps: true,
    collection: 'register_object_health'
  }
);

export default mongoose.models.RegisterHealth || mongoose.model('RegisterHealth', RegisterHealthSchema);
