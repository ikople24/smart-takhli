import dbConnect from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  const db = (await dbConnect()).connection.db;
  const collection = db.collection("ob_registration_requests");

  if (req.method === "GET") {
    const data = await collection.find().sort({ submitted_at: -1 }).toArray();
    return res.status(200).json(data);
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: "Missing ID" });
    await collection.deleteOne({ _id: new ObjectId(id) });
    return res.status(200).json({ message: "Deleted" });
  }

  if (req.method === "POST") {
    const { name, phone, equipment, reason, location } = req.body;

    if (!name || !phone || !equipment || !reason || !location) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    try {
      const result = await collection.insertOne({
        name,
        phone,
        equipment,
        reason,
        location,
        submitted_at: new Date(),
        status: "รับคำร้อง"
      });
      return res.status(200).json({ message: "ส่งข้อมูลสำเร็จ", insertedId: result.insertedId });
    } catch (error) {
      console.error("❌ Insert Error:", error);
      return res.status(500).json({ message: "ไม่สามารถบันทึกข้อมูลได้" });
    }
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ message: "Missing id or status" });
    }

    try {
      await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      return res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" });
    } catch (error) {
      console.error("❌ Update Error:", error);
      return res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}