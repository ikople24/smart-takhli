import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    position: String,
    department: String,
    role: String,
    phone: String,
    profileImage: String,
    assignedTask: String,
    clerkId: String,
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    exitDate: { type: Date, default: null },
    exitNote: { type: String, default: "" },
  },
  { collection: "users", timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export async function createUser(data) {
  const user = new User(data);
  return await user.save();
}
