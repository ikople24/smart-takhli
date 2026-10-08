// POST /api/smart-papar/field/flushing — เจ้าหน้าที่ภาคสนาม (cookie จากการใส่รหัส) บันทึกโบตะกอน
// บันทึกได้อย่างเดียว แก้/ลบไม่ได้ (ให้แอดมินแก้ที่หน้า /admin/smart-papar/water-quality/flushing)
import dbConnect from "@/lib/dbConnect";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { readFieldSession } from "@/lib/smart-papar/fieldAuth";
import { validateFlushingInput } from "@/lib/smart-papar/flushing";
import { attachFlushPoint } from "@/lib/smart-papar/attachFlushPoint";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const session = readFieldSession(req);
  if (!session) {
    return res
      .status(401)
      .json({ success: false, message: "เครื่องนี้ยังไม่ได้ใส่รหัสเจ้าหน้าที่ หรือรหัสถูกเปลี่ยนแล้ว" });
  }

  const v = validateFlushingInput(req.body);
  if (!v.ok) {
    return res
      .status(400)
      .json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors: v.errors });
  }

  try {
    await dbConnect();
    const fp = await attachFlushPoint(v.value);
    if (!fp.ok) {
      return res
        .status(400)
        .json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors: fp.errors });
    }
    const doc = await FlushingLog.create({
      ...fp.value,
      source: "field",
      fieldDeviceId: session.deviceId,
      createdByClerkId: "",
      createdByName: session.name,
      updatedByClerkId: "",
      updatedByName: session.name,
    });
    // ไม่คืนทั้ง document ให้ฝั่งสาธารณะ — แค่ยืนยันว่าบันทึกแล้ว
    return res.status(201).json({ success: true, data: { _id: doc._id } });
  } catch (error) {
    console.error("smart-papar field flushing POST error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
