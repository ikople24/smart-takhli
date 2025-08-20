import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const borrowCollection = db.collection("resoles_sm_health");

    // Get all active borrows (where date_return is empty, "_", "-", or null)
    const activeBorrows = await borrowCollection.find({
      $or: [
        { date_return: "" },
        { date_return: "_" },
        { date_return: "-" },
        { date_return: null }
      ]
    }).sort({ date_lend: -1 }).toArray();

    // Return active borrows directly without request info
    const enrichedActiveBorrows = activeBorrows;

    console.log("=== Debug Active Borrows ===");
    console.log("Total active borrows:", enrichedActiveBorrows.length);
    console.log("Sample borrow records:");
    enrichedActiveBorrows.slice(0, 3).forEach((borrow, index) => {
      console.log(`Record ${index + 1}:`, {
        id_use_object: borrow.id_use_object,
        index_id_tk: borrow.index_id_tk,
        id_personal_use: borrow.id_personal_use,
        date_lend: borrow.date_lend,
        date_return: borrow.date_return,
        requestInfo: borrow.requestInfo
      });
    });
    console.log("============================");

    return res.status(200).json(enrichedActiveBorrows);

  } catch (error) {
    console.error("❌ Failed to fetch active borrows:", error);
    return res.status(500).json({ 
      message: "ไม่สามารถดึงข้อมูลรายการยืมที่ยังไม่ได้คืนได้" 
    });
  }
}
