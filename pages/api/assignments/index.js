import dbConnect from "@/lib/dbConnect";
import Assignment from "@/models/Assignment";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    try {
      const assignments = await Assignment.find({});
      res.status(200).json(assignments);
    } catch {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}