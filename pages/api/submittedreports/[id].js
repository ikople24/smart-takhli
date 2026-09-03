import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import Assignment from "@/models/Assignment";
import { getAuth, clerkClient } from "@clerk/nextjs/server";
import { logAuditEvent } from "@/lib/auditLogger";

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

  // ต้องล็อกอินทุก method (เดิมแก้พิกัด/ลบเรื่องได้โดยไม่ล็อกอิน — ปิดช่องโหว่ 2026-09-03)
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  await dbConnect();

  switch (method) {
    case "PUT":
      try {
        // Expecting { location: { lat: Number, lng: Number } } in req.body
        const { location } = req.body;
        if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
          return res.status(400).json({ success: false, message: "รูปแบบข้อมูลพิกัดไม่ถูกต้อง" });
        }

        const updatedReport = await SubmittedReport.findByIdAndUpdate(
          id,
          { location },
          { new: true }
        );

        if (!updatedReport) {
          return res.status(404).json({ success: false, message: "ไม่พบเรื่องร้องเรียนนี้" });
        }

        return res.status(200).json({ success: true, data: updatedReport });
      } catch (error) {
        return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error });
      }
    case "DELETE":
      try {
        // ลบเรื่องได้เฉพาะ superadmin (ตรงกับ UI ที่ซ่อนปุ่มลบจาก admin ธรรมดา)
        const client = await clerkClient();
        const caller = await client.users.getUser(userId);
        if (caller.publicMetadata?.role !== "superadmin") {
          return res.status(403).json({ success: false, message: "ลบเรื่องได้เฉพาะ superadmin" });
        }

        const deletedReport = await SubmittedReport.findByIdAndDelete(id);
        if (!deletedReport) {
          return res.status(404).json({ success: false, message: "ไม่พบเรื่องร้องเรียนนี้" });
        }
        // ลบ assignment ของเรื่องนี้ตามไปด้วย — ไม่งั้นค้างเป็น "ซากงาน (ไม่ระบุรายละเอียด)" ในหน้างานเจ้าหน้าที่
        const removed = await Assignment.deleteMany({ complaintId: id });
        logAuditEvent({
          actorClerkId: userId,
          actorName: "superadmin",
          action: "complaint_deleted",
          resourceType: "complaint",
          resourceId: String(id),
          description: `ลบเรื่องร้องเรียน ${deletedReport.complaintId || String(id).slice(-8)} พร้อม assignment ${removed.deletedCount} รายการ`,
        });
        return res.status(200).json({ success: true, message: "ลบเรียบร้อยแล้ว", removedAssignments: removed.deletedCount });
      } catch (error) {
        return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error });
      }
    default:
      res.setHeader("Allow", ["PUT", "DELETE"]);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}