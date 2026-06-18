import dbConnect from "@/lib/dbConnect";
import Satisfaction from "@/models/Satisfaction";
import { n8n } from "@/lib/n8nWebhook";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId, rating, comment } = req.body;

  if (!complaintId || !rating) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const newSatisfaction = await Satisfaction.create({
      complaintId,
      rating,
      comment,
    });

    // แจ้งเตือน n8n (fire-and-forget)
    n8n.satisfactionSubmitted({ complaintId: String(complaintId), rating, comment });

    return res.status(201).json({ success: true, data: newSatisfaction });
  } catch (error) {
    console.error("Error saving satisfaction:", error);
    return res.status(500).json({ message: "Server error" });
  }
}