import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.db;
    const collection = db.collection("register_object_health");

    const { ob_type, id_code_th, index_id_tk, ob_status = true } = req.body;

    // Validate required fields
    if (!ob_type || !id_code_th || !index_id_tk) {
      return res.status(400).json({ 
        message: "กรุณากรอกข้อมูลให้ครบถ้วน",
        required: ["ob_type", "id_code_th", "index_id_tk"] 
      });
    }

    // Check if device with same serial already exists
    const existing = await collection.findOne({ index_id_tk });
    if (existing) {
      return res.status(400).json({ 
        message: "อุปกรณ์นี้มีอยู่ในระบบแล้ว (Serial Number ซ้ำ)" 
      });
    }

    // Insert new device
    const result = await collection.insertOne({
      ob_type,
      id_code_th,
      index_id_tk,
      ob_status,
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "เพิ่มอุปกรณ์สำเร็จ",
      id: result.insertedId,
    });
  } catch (error) {
    console.error("Error adding device:", error);
    return res.status(500).json({ 
      message: "เกิดข้อผิดพลาดในการเพิ่มอุปกรณ์",
      error: error.message 
    });
  }
}
