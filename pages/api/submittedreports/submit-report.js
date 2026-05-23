// pages/api/submit-report.js
import dbConnect from "@/lib/dbConnect";
import SubmittedReport from "@/models/SubmittedReport";
import getNextSequence from "@/lib/getNextSequence";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    await dbConnect();
    const complaintId = await getNextSequence("complaintId");
    console.log("📥 Incoming body:", req.body);
    console.log("🆔 Generated complaintId:", complaintId);
    const newReport = await SubmittedReport.create({
      ...req.body,
      complaintId,
    });

    // n8n workflow อ่านแค่ images[0] — เรียงให้รูปล่าสุดที่ user เลือก/เปลี่ยน
    // ไปอยู่ index 0 ใน payload ของ webhook (DB ยังเก็บลำดับเดิมตามที่ส่งมา)
    const reportData = newReport.toObject();
    const orderedImages = Array.isArray(reportData.images)
      ? [...reportData.images].filter(Boolean).reverse()
      : [];
    const webhookPayload = { ...reportData, images: orderedImages };

    // 🔔 POST ไปยัง n8n webhook
    const webhookRes = await fetch(
      "https://primary-production-a1769.up.railway.app/webhook/submit-tk",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      }
    );

    if (!webhookRes.ok) {
      const errorText = await webhookRes.text();
      console.error("🚨 Webhook failed:", webhookRes.status, errorText);
    }

    res.status(201).json({ success: true, data: newReport, complaintId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
}
