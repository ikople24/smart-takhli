import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const collection = db.collection("resoles_sm_health");

    // Get all borrowed devices (where date_return is empty, "_", "-", or null)
    const borrowedDevices = await collection.find({
      $or: [
        { date_return: "" },
        { date_return: "_" },
        { date_return: "-" },
        { date_return: null }
      ]
    }).sort({ date_lend: -1 }).toArray();

    // Get request information for borrowed devices
    const requestCollection = db.collection("ob_registration_requests");
    const requests = await requestCollection.find({}).toArray();
    
    // Map request information to borrowed devices
    const enrichedBorrowedDevices = borrowedDevices.map(device => {
      const request = requests.find(req => req._id.toString() === device.request_id);
      return {
        ...device,
        requestInfo: request ? {
          name: request.name,
          phone: request.phone,
          equipment: request.equipment,
          reason: request.reason
        } : null
      };
    });

    console.log("=== Debug Borrowed Devices ===");
    console.log("Total borrowed devices:", enrichedBorrowedDevices.length);
    console.log("==============================");

    return res.status(200).json(enrichedBorrowedDevices);

  } catch (error) {
    console.error("❌ Failed to fetch borrowed devices:", error);
    return res.status(500).json({ 
      message: "ไม่สามารถดึงข้อมูลอุปกรณ์ที่ถูกยืมได้" 
    });
  }
}
