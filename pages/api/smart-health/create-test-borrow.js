import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const borrowCollection = db.collection("resoles_sm_health");
    const deviceCollection = db.collection("register_object_health");

    // Get available devices
    const availableDevices = await deviceCollection.find({
      ob_status: true
    }).limit(3).toArray();

    if (availableDevices.length === 0) {
      return res.status(404).json({ 
        message: "ไม่มีอุปกรณ์ว่างสำหรับสร้างข้อมูลทดสอบ" 
      });
    }

    const testBorrows = [];
    const today = new Date();

    for (let i = 0; i < Math.min(3, availableDevices.length); i++) {
      const device = availableDevices[i];
      const borrowId = `RD-${String(i + 1).padStart(3, '0')}-${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${(today.getFullYear() + 543).toString().slice(-2)}`;
      
      const borrowData = {
        id_use_object: borrowId,
        index_id_tk: device.index_id_tk || device.ob_code,
        id_personal_use: "1234567890123", // Test citizen ID
        date_lend: today.toLocaleString('th-TH'),
        date_return: "", // Empty for borrowed status
        created_at: new Date(),
        updated_at: new Date()
      };

      // Insert borrow record
      await borrowCollection.insertOne(borrowData);

      // Update device status to borrowed
      await deviceCollection.updateOne(
        { index_id_tk: device.index_id_tk || device.ob_code },
        { $set: { ob_status: false, updated_at: new Date() } }
      );

      testBorrows.push(borrowData);
    }

    console.log("=== สร้างข้อมูลทดสอบสำเร็จ ===");
    console.log("จำนวนรายการที่สร้าง:", testBorrows.length);
    console.log("รายการ:", testBorrows.map(b => b.id_use_object));
    console.log("==============================");

    return res.status(200).json({
      message: `สร้างข้อมูลทดสอบสำเร็จ ${testBorrows.length} รายการ`,
      borrows: testBorrows
    });

  } catch (error) {
    console.error("❌ Create test borrow error:", error);
    return res.status(500).json({ 
      message: "เกิดข้อผิดพลาดในการสร้างข้อมูลทดสอบ" 
    });
  }
}
