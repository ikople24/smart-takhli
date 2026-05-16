import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId } = req.query;

  if (!complaintId) {
    return res.status(400).json({ success: false, message: "Missing complaintId" });
  }

  try {
    const satisfaction = await Satisfaction.findOne({ complaintId }).lean();
    
    if (!satisfaction) {
      return res.status(200).json({ success: true, data: null });
    }

    return res.status(200).json({ success: true, data: satisfaction });
  } catch (error) {
    console.error("Error fetching satisfaction:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

