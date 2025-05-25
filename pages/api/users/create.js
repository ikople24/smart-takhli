import axios from "axios";
import dbConnect from "@/lib/dbConnect";
import { createUser } from "@/models/CreateUser";
import mongoose from "mongoose";

export default async function handler(req, res) {
  try {
    await dbConnect(); // ensure MongoDB connection is established
    if (req.method === "POST") {
      const data = req.body;
      console.log("📦 Received user data:", data);

      try {
        const result = await createUser(data);

        // ✅ ส่ง webhook ไปยัง n8n
        try {
          console.log("📤 Sending webhook to n8n...");
          await axios.post("https://primary-production-a1769.up.railway.app/webhook/new-user", {
            name: data.name,
            position: data.position,
            department: data.department,
            phone: data.phone,
            role: data.role,
            clerkId: data.clerkId,
          });
          console.log("✅ Webhook sent to n8n");
        } catch (webhookErr) {
          console.error("❌ Failed to send webhook to n8n:", webhookErr.message);
        }

        return res.status(200).json({ success: true, message: "บันทึกข้อมูลผู้ใช้สำเร็จ", insertedId: result._id });
      } catch (e) {
        console.error("❌ Failed to save user:", e);
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    if (req.method === "GET") {
      const users = await User.find({});
      return res.status(200).json({ success: true, users });
    }

    if (req.method === "PUT") {
      const { _id, ...updateData } = req.body;
      const result = await User.findByIdAndUpdate(_id, updateData, { new: true });
      return res.status(200).json({ success: true, message: "อัปเดตสำเร็จ", user: result });
    }

    if (req.method === "DELETE") {
      const { _id } = req.body;
      const result = await User.findByIdAndUpdate(_id, { isArchived: true, isActive: false }, { new: true });
      return res.status(200).json({ success: true, message: "ลบผู้ใช้แบบ soft delete แล้ว", user: result });
    }

    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error("❌ ข้อผิดพลาด:", error);
    return res.status(500).json({ success: false, message: error.message, stack: error.stack });
  }
}