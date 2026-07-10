import dbConnect from "@/lib/dbConnect";
import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { requireSmartLightAdmin } from "../_auth";
import { nextPoleCode } from "@/lib/smart-light/poleCode";
import { POLE_STATUS_VALUES, LAMP_TYPE_VALUES } from "@/lib/smart-light/constants";

// validate พิกัดช่วงประเทศไทยแบบหยาบ — กัน lat/lng สลับกันหรือพิมพ์ผิด
export function validateCoords(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return "พิกัดต้องเป็นตัวเลข";
  if (la < 5 || la > 21 || ln < 97 || ln > 106) return "พิกัดอยู่นอกช่วงประเทศไทย";
  return null;
}

export default async function handler(req, res) {
  const auth = await requireSmartLightAdmin(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, message: auth.message });
  }

  await dbConnect();

  if (req.method === "GET") {
    try {
      const { group, status } = req.query;
      const query = {};
      if (group) query.group = String(group);
      if (status) {
        if (!POLE_STATUS_VALUES.includes(String(status))) {
          return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
        }
        query.status = String(status);
      }
      // ไม่ส่ง surveys[] ในหน้า list — โหลดครั้งเดียว ~1,067 แถวให้ payload เบา
      const items = await StreetLightPole.find(query)
        .select("-surveys")
        .sort({ code: 1 })
        .lean();
      return res.status(200).json({ success: true, data: items });
    } catch (error) {
      console.error("smart-light poles GET error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  if (req.method === "POST") {
    try {
      const { lat, lng, group, lampType, note, photoUrl, name } = req.body || {};

      const coordError = validateCoords(lat, lng);
      if (coordError) {
        return res.status(400).json({ success: false, message: coordError });
      }
      const groupName = String(group || "").trim();
      if (!groupName) {
        return res.status(400).json({ success: false, message: "กรุณาระบุชุมชน/กลุ่ม" });
      }
      if (lampType && !LAMP_TYPE_VALUES.includes(String(lampType))) {
        return res.status(400).json({ success: false, message: "ชนิดโคมไม่ถูกต้อง" });
      }

      // gen code แล้ว insert — ถ้าชน unique (insert พร้อมกัน) ลองใหม่สูงสุด 3 ครั้ง
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const code = await nextPoleCode();
          const doc = await StreetLightPole.create({
            code,
            name: String(name || "").trim(),
            group: groupName,
            lat: Number(lat),
            lng: Number(lng),
            lampType: lampType ? String(lampType) : "unknown",
            note: String(note || ""),
            photoUrl: String(photoUrl || ""),
            source: "manual",
          });
          return res.status(201).json({ success: true, data: doc });
        } catch (error) {
          if (error?.code === 11000) {
            lastError = error;
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    } catch (error) {
      console.error("smart-light poles POST error:", error);
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
