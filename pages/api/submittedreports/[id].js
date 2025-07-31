import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";

export default async function handler(req, res) {
  const {
    query: { id },
    method,
  } = req;

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
        const deletedReport = await SubmittedReport.findByIdAndDelete(id);
        if (!deletedReport) {
          return res.status(404).json({ success: false, message: "ไม่พบเรื่องร้องเรียนนี้" });
        }
        return res.status(200).json({ success: true, message: "ลบเรียบร้อยแล้ว" });
      } catch (error) {
        return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด", error });
      }
    default:
      res.setHeader("Allow", ["PUT", "DELETE"]);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}