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

    console.log("=== Debug All Borrows ===");
    console.log("Total borrows:", allBorrows.length);
    console.log("Active borrows:", activeBorrows.length);
    console.log("Returned borrows:", returnedBorrows.length);
    console.log("Sample records:");
    allBorrows.slice(0, 5).forEach((borrow, index) => {
      console.log(`Record ${index + 1}:`, {
        id_use_object: borrow.id_use_object,
        index_id_tk: borrow.index_id_tk,
        id_personal_use: borrow.id_personal_use,
        date_lend: borrow.date_lend,
        date_return: borrow.date_return,
        status: (!borrow.date_return || borrow.date_return === "" || borrow.date_return === "_") ? "Active" : "Returned"
      });
    });
    console.log("==========================");

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
