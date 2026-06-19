import dbConnect from "@/lib/dbConnect";
import {
  formatDateLendThai,
  parseBorrowDateTimeInput,
} from "@/lib/smartHealthBorrowDates";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.useDb("db_takhli");
    const { user, deviceType, deviceId, borrowDateTime } = req.body;

    // Validate required fields
    if (!user || !deviceType || !deviceId || !borrowDateTime) {
      return res.status(400).json({ 
        message: "ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลให้ครบ" 
      });
    }

    // Validate citizen ID
    if (!user.citizenId) {
      return res.status(400).json({ 
        message: "ไม่พบเลขบัตรประชาชนของผู้ขอ กรุณาเลือกผู้ขอที่มีเลขบัตรประชาชน" 
      });
    }

    // Ensure person exists in person_data (required for borrow-return mapping)
    const personCollection = db.collection("person_data");
    const cid = String(user.citizenId || "").replace(/\D/g, "");
    if (!cid || cid.length !== 13) {
      return res.status(400).json({ message: "เลขบัตรประชาชนไม่ถูกต้อง" });
    }
    const fullName = String(user.fullName || user.name || "").trim();
    const phone = user.phone ? String(user.phone).trim() : null;
    if (!fullName) {
      return res.status(400).json({ message: "กรุณาระบุชื่อ-นามสกุลผู้ขอ" });
    }

    const now = new Date();
    await personCollection.updateOne(
      { citizenId: cid },
      {
        $set: {
          citizenId: cid,
          fullName,
          phone,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    // Check if device is available
    const deviceCollection = db.collection("register_object_health");
    const device = await deviceCollection.findOne({ 
      index_id_tk: deviceId,
      ob_status: true 
    });

    if (!device) {
      return res.status(400).json({ 
        message: "อุปกรณ์ไม่พร้อมให้ยืม หรือไม่มีอยู่ในระบบ" 
      });
    }

    // Check if user already has an active borrow
    const borrowCollection = db.collection("resoles_sm_health");
    const activeBorrow = await borrowCollection.findOne({
      id_personal_use: cid,
      date_return: ""
    });

    if (activeBorrow) {
      return res.status(400).json({ 
        message: "คุณมีอุปกรณ์ที่ยังไม่ได้คืน กรุณาคืนอุปกรณ์ก่อนยืมใหม่" 
      });
    }

    // Generate borrowing ID (RD-{count}-{date})
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear() + 543).slice(-2); // Thai year, last 2 digits
    const dateStr = `${day}-${month}-${year}`;

    // Get the latest count for the current year (not just today)
    const currentYear = String(today.getFullYear() + 543).slice(-2); // Thai year, last 2 digits
    const yearBorrows = await borrowCollection.find({
      id_use_object: { $regex: `^RD-\\d{3}-\\d{2}-\\d{2}-${currentYear}$` }
    }).toArray();

    let nextCount = 1;
    if (yearBorrows.length > 0) {
      // Sort by the count part (second part after RD-)
      const latestBorrow = yearBorrows.sort((a, b) => {
        const countA = parseInt(a.id_use_object.split('-')[1]);
        const countB = parseInt(b.id_use_object.split('-')[1]);
        return countB - countA;
      })[0];
      const latestCount = parseInt(latestBorrow.id_use_object.split('-')[1]);
      nextCount = latestCount + 1;
    }

    const borrowingId = `RD-${String(nextCount).padStart(3, '0')}-${dateStr}`;

    const lendDate = parseBorrowDateTimeInput(borrowDateTime);
    if (!lendDate) {
      return res.status(400).json({
        message: "รูปแบบวันที่และเวลาที่ยืมไม่ถูกต้อง",
      });
    }
    const dateLendFormatted = formatDateLendThai(lendDate);
    if (!dateLendFormatted) {
      return res.status(400).json({
        message: "ไม่สามารถจัดรูปแบบวันที่ยืมได้",
      });
    }

    // Create borrow record
    const borrowRecord = {
      id_use_object: borrowingId,
      index_id_tk: deviceId,
      id_personal_use: cid,
      date_lend: dateLendFormatted,
      date_return: "",
      created_at: new Date(),
      updated_at: new Date()
    };

    await borrowCollection.insertOne(borrowRecord);

    // Update device status
    await deviceCollection.updateOne(
      { index_id_tk: deviceId },
      { 
        $set: { 
          ob_status: false,
          updated_at: new Date()
        } 
      }
    );

    return res.status(200).json({
      message: "บันทึกการยืมอุปกรณ์สำเร็จ",
      borrowingId: borrowingId,
      borrowRecord: borrowRecord
    });

  } catch (error) {
    console.error("❌ Borrow device error:", error);
    return res.status(500).json({ 
      message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง" 
    });
  }
}
