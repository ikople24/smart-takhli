import { recordPublicRating } from "@/lib/satisfaction/record";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { complaintId, rating, comment } = req.body;

  if (!complaintId || !rating) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const newSatisfaction = await recordPublicRating({ complaintId, rating, comment });
    return res.status(201).json({ success: true, data: newSatisfaction });
  } catch (error) {
    console.error("Error saving satisfaction:", error);
    return res.status(500).json({ message: "Server error" });
  }
}
