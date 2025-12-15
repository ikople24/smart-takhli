import dbConnect from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

const dbName = "db_takhli";
const collectionName = "elderly_data";

export default async function handler(req, res) {
  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.useDb(dbName);
    const collection = db.collection(collectionName);

    // GET - Fetch all elderly data
    if (req.method === "GET") {
      const data = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(data);
    }

    // POST - Add new elderly record
    if (req.method === "POST") {
      const {
        title,
        firstName,
        lastName,
        fullName,
        birthYear,
        age,
        dataGroup,
        address,
        community,
        location,
      } = req.body;

      // Validate required fields
      if (!title) {
        return res.status(400).json({
          message: "กรุณาเลือกคำนำหน้า",
        });
      }

      if (!firstName || !lastName) {
        return res.status(400).json({
          message: "กรุณากรอกชื่อและนามสกุล",
        });
      }

      if (!birthYear) {
        return res.status(400).json({
          message: "กรุณาระบุปีเกิด (พ.ศ.)",
        });
      }

      if (!community) {
        return res.status(400).json({
          message: "กรุณาเลือกชุมชน",
        });
      }

      const newRecord = {
        title,
        firstName,
        lastName,
        fullName: fullName || `${title}${firstName} ${lastName}`,
        birthYear: parseInt(birthYear),
        age: age || null,
        dataGroup: dataGroup || "general",
        address: address || null,
        community,
        location: location || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await collection.insertOne(newRecord);

      return res.status(201).json({
        success: true,
        message: "บันทึกข้อมูลสำเร็จ",
        id: result.insertedId,
      });
    }

    // DELETE - Delete elderly record
    if (req.method === "DELETE") {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ message: "กรุณาระบุ ID" });
      }

      const result = await collection.deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: "ไม่พบข้อมูล" });
      }

      return res.status(200).json({
        success: true,
        message: "ลบข้อมูลสำเร็จ",
      });
    }

    // PUT - Update elderly record
    if (req.method === "PUT") {
      const { id } = req.query;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({ message: "กรุณาระบุ ID" });
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "ไม่พบข้อมูล" });
      }

      return res.status(200).json({
        success: true,
        message: "อัปเดตข้อมูลสำเร็จ",
      });
    }

    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    console.error("Elderly API error:", error);
    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในระบบ",
      error: error.message,
    });
  }
}
