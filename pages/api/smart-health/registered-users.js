import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const collection = db.collection("ob_registration_requests");

    // Get unique users with status "ลงทะเบียนอุปกรณ์"
    const users = await collection.aggregate([
      {
        $match: {
          status: "ลงทะเบียนอุปกรณ์"
        }
      },
      {
        $group: {
          _id: "$phone", // Group by phone number
          name: { $first: "$name" },
          phone: { $first: "$phone" },
          latestRequest: { $first: "$$ROOT" }
        }
      },
      {
        $sort: { "latestRequest.submitted_at": -1 }
      },
      {
        $project: {
          _id: 0,
          name: 1,
          phone: 1,
          citizenId: "$latestRequest.citizen_id", // Try citizen_id first
          status: "$latestRequest.status",
          submittedAt: "$latestRequest.submitted_at"
        }
      },
      {
        $match: {
          status: "ลงทะเบียนอุปกรณ์" // Double check status after grouping
        }
      }
    ]).toArray();

    return res.status(200).json(users);

  } catch (error) {
    console.error("❌ Failed to fetch registered users:", error);
    return res.status(500).json({ 
      message: "ไม่สามารถดึงข้อมูลผู้ขอได้" 
    });
  }
}
