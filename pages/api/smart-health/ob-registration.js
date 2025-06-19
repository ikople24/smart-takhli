import dbConnect from "@/lib/dbConnect";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { name, phone, equipment, reason } = req.body;

  if (!name || !phone || !equipment || !reason) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
    const db = (await dbConnect()).connection.db;
    const result = await db.collection("ob_registration_requests").insertOne({
      name,
      phone,
      equipment,
      reason,
      submitted_at: new Date()
    });

    res.status(200).json({ message: "ส่งข้อมูลสำเร็จ", insertedId: result.insertedId });
  } catch (error) {
    console.error("❌ Insert Error:", error);
    res.status(500).json({ message: "ไม่สามารถบันทึกข้อมูลได้" });
  }
}