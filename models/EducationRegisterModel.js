import mongoose from "mongoose";

const EducationSchema = new mongoose.Schema(
  {
    applicantId: {
      type: String,
      unique: true,
      required: true,
    },
    level: String,
    prefix: String,
    name: String,
    address: String,
    phone: String,
    note: String,
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
