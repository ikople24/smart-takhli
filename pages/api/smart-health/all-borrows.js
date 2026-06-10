import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const borrowCollection = db.collection("resoles_sm_health");

    // Get all borrows
    const allBorrows = await borrowCollection.find({}).sort({ date_lend: -1 }).toArray();

    // Count by status
    const activeBorrows = allBorrows.filter(borrow => 
      !borrow.date_return || borrow.date_return === "" || borrow.date_return === "_"
    );
    
    const returnedBorrows = allBorrows.filter(borrow => 
      borrow.date_return && borrow.date_return !== "" && borrow.date_return !== "_"
    );

    return res.status(200).json({
      total: allBorrows.length,
      active: activeBorrows.length,
      returned: returnedBorrows.length,
      data: allBorrows
    });

  } catch (error) {
    console.error("❌ Failed to fetch all borrows:", error);
    return res.status(500).json({ 
      message: "ไม่สามารถดึงข้อมูลทั้งหมดได้" 
    });
  }
}
