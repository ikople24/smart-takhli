import dbConnect from "@/lib/dbConnect";
import Assignment from "@/models/Assignment";
import {
  isComplaintStaffFromRequest,
  getPdpaMapByComplaintIds,
  sanitizeAssignmentsMap,
} from "@/lib/complaintPrivacy";

export default async function handler(req, res) {
  const { method } = req;

  await dbConnect();

  if (method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { complaintIds } = req.body;

  if (!complaintIds || !Array.isArray(complaintIds) || complaintIds.length === 0) {
    return res.status(400).json({ success: false, error: "Complaint IDs array is required" });
  }

  try {
    // ดึง assignments ทั้งหมดในครั้งเดียว
    const assignments = await Assignment.find({ 
      complaintId: { $in: complaintIds } 
    }).lean();
    
    // แปลงเป็น object โดยใช้ complaintId เป็น key
    const assignmentsMap = {};
    assignments.forEach(assignment => {
      // ถ้ามีหลาย assignment ต่อ complaint ให้เก็บอันแรก
      if (!assignmentsMap[assignment.complaintId]) {
        assignmentsMap[assignment.complaintId] = assignment;
      }
    });

    const isStaff = await isComplaintStaffFromRequest(req);
    const pdpaMap = await getPdpaMapByComplaintIds(complaintIds);
    const safeMap = sanitizeAssignmentsMap(assignmentsMap, isStaff, pdpaMap);

    res.status(200).json({ success: true, data: safeMap });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

