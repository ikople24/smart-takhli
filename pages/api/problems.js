import dbConnect from "@/lib/dbConnect";
import ProblemOption from "@/models/ProblemOption";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    try {
      const problems = await ProblemOption.find({});
      res.status(200).json(problems);
    } catch (err) {
      console.error("❌ Mongo fetch error:", err);
      res.status(500).json({ error: "Failed to fetch problems" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}