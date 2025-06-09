// /pages/api/submittedreports/update-status.js
import dbConnect from "@/lib/dbConnect"; // ถ้ามี
import SubmittedReport from "@/models/SubmittedReport"; // ชื่อโมเดลต้องตรง

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "PUT") {
    const { complaintId, status } = req.body;

    try {
      const updated = await SubmittedReport.findOneAndUpdate(
        { _id: complaintId },
        { status },
        { new: true }
      );

      if (!updated) return res.status(404).json({ message: "ไม่พบข้อมูล" });

      res.status(200).json(updated);
    } catch (err) {
      res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
    }
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}