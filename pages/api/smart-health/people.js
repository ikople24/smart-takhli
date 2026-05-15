import dbConnect from "@/lib/dbConnect";
import { ObjectId } from "mongodb";
import { requireAuth } from "@/lib/requireAuth";

const dbName = "db_takhli";
const collectionName = "person_data";

export default async function handler(req, res) {
  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.useDb(dbName);
    const collection = db.collection(collectionName);

    // GET - Fetch all person data
    if (req.method === "GET") {
      const auth = await requireAuth(req, res, ["admin", "superadmin"]);
      if (!auth) return;

      const data = await collection.find({}).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(data);
    }

    // POST - Add new person record
    if (req.method === "POST") {
      const auth = await requireAuth(req, res, ["admin", "superadmin"]);
      if (!auth) return;

      const {
        basic,
        title,
        firstName,
        lastName,
        fullName,
        citizenId,
        phone,
        birthYear,
        age,
        dataGroup,
        address,
        community,
        location,
      } = req.body;

      // Basic mode: used by borrow/return flow (minimal fields, upsert by citizenId)
      if (basic) {
        const cid = String(citizenId || "").replace(/\D/g, "");
        const name = String(fullName || "").trim();
        const tel = phone ? String(phone).trim() : null;

        if (!cid || cid.length !== 13) {
          return res.status(400).json({ message: "กรุณากรอกเลขบัตรประชาชน 13 หลัก" });
        }
        if (!name) {
          return res.status(400).json({ message: "กรุณากรอกชื่อ-นามสกุล" });
        }

        const now = new Date();
        const update = {
          $set: {
            citizenId: cid,
            fullName: name,
            phone: tel,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        };

        // Only set optional fields when provided (avoid overwriting with empty)
        if (community && String(community).trim()) {
          update.$set.community = String(community).trim();
        }
        if (location && location.lat != null && location.lng != null) {
          update.$set.location = {
            lat: Number(location.lat),
            lng: Number(location.lng),
          };
        }

        const result = await collection.updateOne({ citizenId: cid }, update, { upsert: true });
        return res.status(200).json({
          success: true,
          message: "บันทึกข้อมูลบุคคลสำเร็จ",
          upsertedId: result.upsertedId || null,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        });
      }

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
        citizenId: citizenId || null,
        phone: phone || null,
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

    // DELETE - Delete person record
    if (req.method === "DELETE") {
      const auth = await requireAuth(req, res, ["admin", "superadmin"]);
      if (!auth) return;

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

    // PUT - Update person record
    if (req.method === "PUT") {
      const auth = await requireAuth(req, res, ["admin", "superadmin"]);
      if (!auth) return;

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
    console.error("People API error:", error);
    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในระบบ",
      error: error.message,
    });
  }
}








