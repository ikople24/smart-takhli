import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const { borrowId, returnDateTime } = req.body;

    if (!borrowId) {
      return res.status(400).json({ 
        message: "ไม่พบรหัสการยืม" 
      });
    }

    const borrowCollection = db.collection("resoles_sm_health");
    const deviceCollection = db.collection("register_object_health");

    // Find the borrow record
    const borrowRecord = await borrowCollection.findOne({
      id_use_object: borrowId,
      $or: [
        { date_return: "" },
        { date_return: "_" },
        { date_return: "-" },
        { date_return: null }
      ]
    });

    if (!borrowRecord) {
      return res.status(404).json({ 
        message: "ไม่พบรายการยืมอุปกรณ์นี้ หรืออุปกรณ์ถูกคืนแล้ว" 
      });
    }

    // Set return date
    const returnDate = returnDateTime || new Date().toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    console.log("=== คืนอุปกรณ์ ===");
    console.log("รหัสการยืม:", borrowId);
    console.log("รหัสอุปกรณ์:", borrowRecord.index_id_tk);
    console.log("วันที่คืน:", returnDate);
    console.log("==================");

    // Update borrow record with return date
    const borrowUpdateResult = await borrowCollection.updateOne(
      { id_use_object: borrowId },
      { 
        $set: { 
          date_return: returnDate,
          updated_at: new Date()
        } 
      }
    );
    console.log("ผลการอัปเดตรายการยืม:", borrowUpdateResult);

    // Update device status back to available
    const deviceUpdateResult = await deviceCollection.updateOne(
      { index_id_tk: borrowRecord.index_id_tk },
      { 
        $set: { 
          ob_status: true,
          updated_at: new Date()
        } 
      }
    );
    console.log("ผลการอัปเดตสถานะอุปกรณ์:", deviceUpdateResult);

    // Verify the update
    const updatedBorrow = await borrowCollection.findOne({ id_use_object: borrowId });
    const updatedDevice = await deviceCollection.findOne({ index_id_tk: borrowRecord.index_id_tk });
    
    console.log("ข้อมูลรายการยืมหลังอัปเดต:", {
      id_use_object: updatedBorrow?.id_use_object,
      date_return: updatedBorrow?.date_return
    });
    
    console.log("ข้อมูลอุปกรณ์หลังอัปเดต:", {
      index_id_tk: updatedDevice?.index_id_tk,
      ob_status: updatedDevice?.ob_status
    });

    console.log("=== คืนอุปกรณ์สำเร็จ ===");
    console.log("รหัสการยืม:", borrowId);
    console.log("รหัสอุปกรณ์:", borrowRecord.index_id_tk);
    console.log("วันที่คืน:", returnDate);
    console.log("========================");

    return res.status(200).json({
      message: "คืนอุปกรณ์สำเร็จ",
      borrowId: borrowId,
      deviceId: borrowRecord.index_id_tk,
      returnDate: returnDate
    });

  } catch (error) {
    console.error("❌ Return device error:", error);
    return res.status(500).json({ 
      message: "เกิดข้อผิดพลาดในการคืนอุปกรณ์" 
    });
  }
}
