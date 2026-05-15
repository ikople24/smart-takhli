import dbConnect from "@/lib/dbConnect";
import ProblemOption from "@/models/ProblemOption";
import { requireAuth } from "@/lib/requireAuth";

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
  } else if (req.method === "POST") {
    try {
      const auth = await requireAuth(req, res, ["admin", "superadmin"]);
      if (!auth) return;

      const { label, iconUrl, category, active } = req.body;
      const newProblem = new ProblemOption({ label, iconUrl, category, active });
      await newProblem.save();
      res.status(201).json(newProblem);
    } catch (err) {
      console.error("❌ Failed to save problem:", err);
      res.status(500).json({ error: "Failed to save problem" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}