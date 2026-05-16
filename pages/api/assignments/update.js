// /pages/api/assignments/update.js

import dbConnect from "@/lib/dbConnect"; // ถ้าใช้ MongoDB
import Assignment from "@/models/Assignment"; // ตรวจสอบ path ให้ตรงกับโครงสร้างของคุณ

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await dbConnect();

    const { assignmentId, note, solution, solutionImages, completedAt } =
      req.body;

    const updated = await Assignment.findByIdAndUpdate(
      assignmentId,
      {
        note,
        solution: Array.isArray(solution)
          ? solution.map((item) => String(item))
          : [String(solution)],
        solutionImages,
        completedAt,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    return res
      .status(200)
      .json({ message: "Assignment updated", assignment: updated });
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
