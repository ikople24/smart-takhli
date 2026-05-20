import dbConnect from "@/lib/dbConnect";
import Complaint from "@/models/Complaint";
import { isComplaintStaffFromRequest } from "@/lib/complaintPrivacy";
import { normalizeDetailRedactions } from "@/lib/pdpaTextMask";

/**
 * POST /api/complaints/privacy
 * Body:
 *   - { complaintId, isConfidential?: boolean, pdpaSensitive?: boolean }
 *   - { complaintId, pdpaDetailRedactions: { start, end }[] }  // บันทึกช่วงซ่อนคำ (เจ้าหน้าที่)
 * ต้องเป็น admin/superadmin (Clerk publicMetadata.role)
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const staff = await isComplaintStaffFromRequest(req);
  if (!staff) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }

  await dbConnect();

  const {
    complaintId,
    isConfidential,
    pdpaSensitive,
    pdpaDetailRedactions,
  } = req.body || {};

  if (!complaintId) {
    return res.status(400).json({ success: false, error: "complaintId is required" });
  }

  const hasBoolean =
    typeof isConfidential === "boolean" || typeof pdpaSensitive === "boolean";
  const hasRedactions = Array.isArray(pdpaDetailRedactions);

  if (!hasBoolean && !hasRedactions) {
    return res.status(400).json({
      success: false,
      error:
        "Provide isConfidential and/or pdpaSensitive as boolean, or pdpaDetailRedactions as array",
    });
  }

  const $set = {};
  if (typeof isConfidential === "boolean") $set.isConfidential = isConfidential;
  if (typeof pdpaSensitive === "boolean") $set.pdpaSensitive = pdpaSensitive;

  if (hasRedactions) {
    const existing = await Complaint.findById(complaintId).select("detail").lean();
    const detailText = existing?.detail || "";
    $set.pdpaDetailRedactions = normalizeDetailRedactions(
      pdpaDetailRedactions,
      detailText.length
    );
  }

  if (Object.keys($set).length === 0) {
    return res.status(400).json({ success: false, error: "Nothing to update" });
  }

  try {
    const updated = await Complaint.findByIdAndUpdate(
      complaintId,
      { $set },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, error: "Complaint not found" });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("complaints/privacy error:", err);
    return res.status(500).json({ success: false, error: "Update failed" });
  }
}
