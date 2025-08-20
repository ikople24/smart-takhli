import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const borrowCollection = db.collection("resoles_sm_health");

    // Get all borrows
    const allBorrows = await borrowCollection.find({}).toArray();

    console.log("=== ตรวจสอบรูปแบบวันที่ ===");
    console.log("จำนวนรายการทั้งหมด:", allBorrows.length);

    let updatedCount = 0;
    const updatePromises = [];

    for (const borrow of allBorrows) {
      let needsUpdate = false;
      let newDateLend = borrow.date_lend;

      // ตรวจสอบรูปแบบ date_lend
      if (borrow.date_lend) {
        // ถ้าเป็น MongoDB Date object
        if (borrow.date_lend instanceof Date) {
          newDateLend = borrow.date_lend.toLocaleString('th-TH', {
            day: '2-digit',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          needsUpdate = true;
          console.log(`แปลง Date object: ${borrow.date_lend} → ${newDateLend}`);
        }
        // ถ้าเป็น string แต่ format ไม่ถูกต้อง
        else if (typeof borrow.date_lend === 'string') {
          // ตรวจสอบว่าเป็น format ที่ต้องการหรือไม่
          const thaiDatePattern = /^\d{1,2}\/\d{1,2}\/\d{4}\s\d{1,2}:\d{2}:\d{2}$/;
          if (!thaiDatePattern.test(borrow.date_lend)) {
            // ลองแปลงจาก format อื่น
            try {
              const date = new Date(borrow.date_lend);
              if (!isNaN(date.getTime())) {
                newDateLend = date.toLocaleString('th-TH', {
                  day: '2-digit',
                  month: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
                needsUpdate = true;
                console.log(`แปลง string format: ${borrow.date_lend} → ${newDateLend}`);
              }
            } catch {
              console.log(`ไม่สามารถแปลงได้: ${borrow.date_lend}`);
            }
          }
        }
      }

      // ตรวจสอบรูปแบบ date_return
      let newDateReturn = borrow.date_return;
      if (borrow.date_return) {
        // ถ้าเป็น MongoDB Date object
        if (borrow.date_return instanceof Date) {
          newDateReturn = borrow.date_return.toLocaleString('th-TH', {
            day: '2-digit',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          needsUpdate = true;
          console.log(`แปลง Date object (return): ${borrow.date_return} → ${newDateReturn}`);
        }
        // ถ้าเป็น string แต่ format ไม่ถูกต้อง
        else if (typeof borrow.date_return === 'string' && borrow.date_return !== "" && borrow.date_return !== "_") {
          const thaiDatePattern = /^\d{1,2}\/\d{1,2}\/\d{4}\s\d{1,2}:\d{2}:\d{2}$/;
          if (!thaiDatePattern.test(borrow.date_return)) {
            try {
              const date = new Date(borrow.date_return);
              if (!isNaN(date.getTime())) {
                newDateReturn = date.toLocaleString('th-TH', {
                  day: '2-digit',
                  month: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });
                needsUpdate = true;
                console.log(`แปลง string format (return): ${borrow.date_return} → ${newDateReturn}`);
              }
            } catch {
              console.log(`ไม่สามารถแปลงได้ (return): ${borrow.date_return}`);
            }
          }
        }
      }

      // อัปเดตข้อมูลถ้าจำเป็น
      if (needsUpdate) {
        const updatePromise = borrowCollection.updateOne(
          { _id: borrow._id },
          { 
            $set: { 
              date_lend: newDateLend,
              date_return: newDateReturn,
              updated_at: new Date()
            } 
          }
        );
        updatePromises.push(updatePromise);
        updatedCount++;
      }
    }

    // รอให้การอัปเดตเสร็จสิ้น
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`อัปเดตรูปแบบวันที่แล้ว ${updatedCount} รายการ`);
    } else {
      console.log("ไม่มีการอัปเดตที่จำเป็น");
    }

    // ตรวจสอบผลลัพธ์
    const updatedBorrows = await borrowCollection.find({}).toArray();
    const activeBorrows = updatedBorrows.filter(borrow => 
      !borrow.date_return || borrow.date_return === "" || borrow.date_return === "_"
    );

    console.log("=== ผลลัพธ์หลังการแปลง ===");
    console.log("จำนวนรายการทั้งหมด:", updatedBorrows.length);
    console.log("จำนวนรายการที่ยังไม่ได้คืน:", activeBorrows.length);
    console.log("ตัวอย่างข้อมูล:");
    updatedBorrows.slice(0, 3).forEach((borrow, index) => {
      console.log(`Record ${index + 1}:`, {
        id_use_object: borrow.id_use_object,
        date_lend: borrow.date_lend,
        date_return: borrow.date_return,
        type_lend: typeof borrow.date_lend,
        type_return: typeof borrow.date_return
      });
    });
    console.log("============================");

    return res.status(200).json({
      message: `แปลงรูปแบบวันที่เสร็จสิ้น`,
      totalRecords: updatedBorrows.length,
      updatedRecords: updatedCount,
      activeBorrows: activeBorrows.length
    });

  } catch (error) {
    console.error("❌ Fix date formats error:", error);
    return res.status(500).json({ 
      message: "เกิดข้อผิดพลาดในการแปลงรูปแบบวันที่" 
    });
  }
}
