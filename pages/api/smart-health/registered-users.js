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

    // Debug: Check all statuses in database
    const allStatuses = await collection.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();

    console.log("=== Debug Registered Users ===");
    console.log("All statuses in database:");
    allStatuses.forEach(status => {
      console.log(`- ${status._id}: ${status.count} records`);
    });
    console.log("Total users with 'ลงทะเบียนอุปกรณ์' status:", users.length);
    if (users.length > 0) {
      console.log("Sample user:", users[0]);
      console.log("All users status:");
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} - ${user.status}`);
      });
    }
    console.log("==============================");

    return res.status(200).json(users);

  } catch (error) {
    console.error("❌ Failed to fetch registered users:", error);
    return res.status(500).json({ 
      message: "ไม่สามารถดึงข้อมูลผู้ขอได้" 
    });
  }
}
