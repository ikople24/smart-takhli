import dbConnect from "@/lib/dbConnect";
import Assignment from "@/models/Assignment";
import {
  isComplaintStaffFromRequest,
  getPdpaMapByComplaintIds,
  sanitizeAssignmentsLean,
} from "@/lib/complaintPrivacy";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    try {
      const assignments = await Assignment.find({}).lean();
      const isStaff = await isComplaintStaffFromRequest(req);
      const ids = assignments.map((a) => a.complaintId).filter(Boolean);
      const pdpaMap = await getPdpaMapByComplaintIds(ids);
      const safe = sanitizeAssignmentsLean(assignments, isStaff, pdpaMap);
      res.status(200).json(safe);
    } catch {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}