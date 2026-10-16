// POST /api/smart-papar/water-reports — ประชาชนแจ้งน้ำขุ่น/ไม่ไหล (ไม่ต้องล็อกอิน) + rate-limit ต่อ IP/เบอร์
// บันทึกลง smart_papar_water_reports → หาชุมชนจากพิกัดฝั่ง server → การ์ด LINE เข้ากลุ่มเจ้าหน้าที่เดิม 1 ข้อความ
// คืน { ticket, communityName } เท่านั้น — ไม่คืนข้อมูลส่วนบุคคล
// ⚠️ โควตา LINE OA ใช้ร่วมทั้งระบบ — rate-limit เข้มกว่า flood-relief (3 เรื่อง/ชม.)
import dbConnect from "@/lib/dbConnect";
import WaterReport from "@/models/smart-papar/WaterReport";
import { validateWaterReportInput, newWaterTicket, formatWaterReportFlex } from "@/lib/smart-papar/waterReport";
import { findCommunityName } from "@/lib/flood-relief/locate";
import { clientIp } from "@/lib/flood-relief/rateLimit";
import { lineNotifyAdminGroup } from "@/lib/lineMessaging";

const LIMIT = { max: 3, windowMin: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const v = validateWaterReportInput(req.body);
  if (!v.ok) {
    return res.status(400).json({ success: false, message: "กรอกข้อมูลไม่ครบ", errors: v.errors });
  }
  const input = v.value;

  try {
    await dbConnect();

    const ip = clientIp(req.headers, req.socket?.remoteAddress);
    const since = new Date(Date.now() - LIMIT.windowMin * 60 * 1000);
    const [byIp, byPhone] = await Promise.all([
      ip ? WaterReport.countDocuments({ clientIp: ip, createdAt: { $gte: since } }) : 0,
      WaterReport.countDocuments({ phone: input.phone, createdAt: { $gte: since } }),
    ]);
    if ((ip && byIp >= LIMIT.max) || byPhone >= LIMIT.max) {
      return res
        .status(429)
        .json({ success: false, message: "ส่งเรื่องถี่เกินไป เรื่องก่อนหน้าถึงเจ้าหน้าที่แล้ว กรุณารอสักครู่" });
    }

    // basemap อ่านไม่ได้ก็ยังบันทึกได้ — เจ้าหน้าที่ดูจากพิกัดแทน
    const communityName = await findCommunityName(input.point).catch((err) => {
      console.error("[smart-papar/water-reports] community lookup failed:", err);
      return null;
    });

    const now = new Date();
    let doc = null;
    for (let i = 0; i < 3 && !doc; i++) {
      try {
        doc = await WaterReport.create({
          ticket: newWaterTicket(),
          symptoms: input.symptoms,
          since: input.since,
          location: { type: "Point", coordinates: [input.point.lng, input.point.lat] },
          accuracyM: input.accuracyM,
          communityName,
          addressNote: input.addressNote,
          photos: input.photos,
          prefix: input.prefix,
          fullName: input.fullName,
          phone: input.phone,
          consentAt: now,
          clientIp: ip,
        });
      } catch (err) {
        if (err?.code !== 11000) throw err; // ticket ชน (โอกาสน้อยมาก) → สุ่มใหม่
      }
    }
    if (!doc) throw new Error("ticket collision");

    // รอผล LINE เพื่อบันทึก lineNotifiedAt — ล้มแค่ log เรื่องแจ้งบันทึกแล้วไม่หาย
    const sent = await lineNotifyAdminGroup([
      formatWaterReportFlex({ ...input, ticket: doc.ticket, communityName, createdAt: now }),
    ]).catch((err) => {
      console.error("[smart-papar/water-reports] LINE notify failed:", err);
      return false;
    });
    if (sent) await WaterReport.updateOne({ _id: doc._id }, { $set: { lineNotifiedAt: new Date() } }).catch(() => {});

    return res.status(201).json({ success: true, data: { ticket: doc.ticket, communityName } });
  } catch (err) {
    console.error("[smart-papar/water-reports] POST", err);
    return res.status(500).json({ success: false, message: "ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้ง" });
  }
}
