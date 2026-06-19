import dbConnect from "@/lib/dbConnect";
import Assignment from "@/models/Assignment";
import {
  isComplaintStaffFromRequest,
  getPdpaMapByComplaintIds,
  sanitizeAssignmentsLean,
} from "@/lib/complaintPrivacy";

export default async function handler(req, res) {
  const {
    query: { complaintId },
    method,
  } = req;

  await dbConnect();

  if (method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const assignments = await Assignment.find({ complaintId }).lean();
    if (!assignments) {
      return res.status(404).json({ success: false, message: "No assignments found" });
    }
    const isStaff = await isComplaintStaffFromRequest(req);
    const ids = assignments.map((a) => a.complaintId).filter(Boolean);
    const pdpaMap = await getPdpaMapByComplaintIds(ids);
    const safe = sanitizeAssignmentsLean(assignments, isStaff, pdpaMap);
    res.status(200).json({ success: true, data: safe });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}