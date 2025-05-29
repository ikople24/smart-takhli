import dbConnect from "@/lib/dbConnect";
import ProblemOption from "@/models/ProblemOption";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    try {
      const options = await ProblemOption.find({});
      res.status(200).json(options);
    } catch (err) {
      res.status(500).json({ message: "Error fetching problem options" });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}