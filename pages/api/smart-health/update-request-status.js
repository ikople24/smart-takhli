import dbConnect from "@/lib/dbConnect";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const { id } = req.query;
    const { status, action } = req.body;

    if (!id) {
      return res.status(400).json({ message: "ไม่พบรหัสคำขอ" });
    }

    const requestCollection = db.collection("ob_registration_requests");
    const borrowCollection = db.collection("resoles_sm_health");

    // Find the request
    const request = await requestCollection.findOne({ _id: new ObjectId(id) });
    if (!request) {
      return res.status(404).json({ message: "ไม่พบคำขอนี้" });
    }

    console.log("=== อัปเดตสถานะคำขอ ===");
    console.log("รหัสคำขอ:", id);
    console.log("สถานะเดิม:", request.status);
    console.log("สถานะใหม่:", status);
    console.log("การดำเนินการ:", action);
    console.log("==========================");

    let updateData = {
      status: status,
      updated_at: new Date()
    };

    // Handle specific actions based on status
    switch (status) {
      case "ประเมินโดยพยาบาลวิชาชีพ":
        // เมื่อพยาบาลประเมินแล้ว
        updateData.assessed_by = "พยาบาลวิชาชีพ";
        updateData.assessed_at = new Date();
        break;

      case "ลงทะเบียนอุปกรณ์":
        // เมื่อลงทะเบียนอุปกรณ์แล้ว
        updateData.registered_at = new Date();
        break;

      case "ส่งมอบอุปกรณ์":
        // เมื่อส่งมอบอุปกรณ์แล้ว
        if (action === "borrow") {
          // สร้างรายการยืมใหม่
          const today = new Date();
          const day = String(today.getDate()).padStart(2, '0');
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const year = String(today.getFullYear() + 543).slice(-2);
          const dateStr = `${day}-${month}-${year}`;

          // Get next borrow count for current year
          const currentYear = String(today.getFullYear() + 543).slice(-2);
          const yearBorrows = await borrowCollection.find({
            id_use_object: { $regex: `^RD-\\d{3}-\\d{2}-\\d{2}-${currentYear}$` }
          }).toArray();

          let nextCount = 1;
          if (yearBorrows.length > 0) {
            const latestBorrow = yearBorrows.sort((a, b) => {
              const countA = parseInt(a.id_use_object.split('-')[1]);
              const countB = parseInt(b.id_use_object.split('-')[1]);
              return countB - countA;
            })[0];
            const latestCount = parseInt(latestBorrow.id_use_object.split('-')[1]);
            nextCount = latestCount + 1;
          }

          const borrowingId = `RD-${String(nextCount).padStart(3, '0')}-${dateStr}`;

          // Create borrow record
          const borrowRecord = {
            id_use_object: borrowingId,
            index_id_tk: request.equipment || "ไม่ระบุ",
            id_personal_use: request.phone, // ใช้เบอร์โทรเป็น id_personal_use
            date_lend: today.toLocaleString('th-TH'),
            date_return: "", // Empty for borrowed status
            request_id: id, // Link to original request
            created_at: new Date(),
            updated_at: new Date()
          };

          await borrowCollection.insertOne(borrowRecord);
          updateData.borrow_id = borrowingId;
          updateData.borrowed_at = new Date();

          console.log("สร้างรายการยืม:", borrowingId);
        }
        break;

      default:
        break;
    }

    // Update request status
    const result = await requestCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    console.log("ผลการอัปเดต:", result);

    return res.status(200).json({
      message: "อัปเดตสถานะสำเร็จ",
      status: status,
      borrowId: updateData.borrow_id || null
    });

  } catch (error) {
    console.error("❌ Update status error:", error);
    return res.status(500).json({ 
      message: "เกิดข้อผิดพลาดในการอัปเดตสถานะ" 
    });
  }
}
