// /pages/api/submittedreports/update-status.js
import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import { requireAuth } from "@/lib/requireAuth";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const auth = await requireAuth(req, res, ["admin", "superadmin"]);
  if (!auth) return;

  try {
    await dbConnect();

    const { complaintId, status } = req.body;

    if (!complaintId || !status) {
      return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
    }

    const updated = await SubmittedReport.findOneAndUpdate(
      { _id: complaintId },
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "ไม่พบข้อมูล" });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: "เกิดข้อผิดพลาด", error: err.message });
  }
}
