import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const borrowCollection = db.collection("resoles_sm_health");

    const { citizenId } = req.query;

    // Build query for active borrows (where date_return is empty, "_", "-", or null)
    const query = {
      $or: [
        { date_return: "" },
        { date_return: "_" },
        { date_return: "-" },
        { date_return: null }
      ]
    };

    // If citizenId is provided, add filter
    if (citizenId) {
      // Support partial matching for citizen ID
      query.id_personal_use = { $regex: citizenId, $options: "i" };
    }

    const activeBorrows = await borrowCollection
      .find(query)
      .sort({ date_lend: -1 })
      .toArray();

    return res.status(200).json(activeBorrows);

  } catch (error) {
    console.error("❌ Failed to fetch active borrows:", error);
    return res.status(500).json({ 
      message: "ไม่สามารถดึงข้อมูลรายการยืมที่ยังไม่ได้คืนได้" 
    });
  }
}
