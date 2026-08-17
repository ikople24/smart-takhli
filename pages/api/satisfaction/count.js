import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId, source } = req.query;

  if (!complaintId) {
    return res.status(400).json({ success: false, message: "Missing complaintId" });
  }

  try {
    const query = { complaintId };
    if (source === "public" || source === "line") {
      query.source = source;
    }
    const count = await Satisfaction.countDocuments(query);
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("Error counting satisfaction:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

