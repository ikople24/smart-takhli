import { requireElderlySchoolAdmin } from "./_auth";
import dbConnect from "@/lib/dbConnect";
import ElderlySchoolSchedule from "@/models/elderly-school/ElderlySchoolSchedule";
import { normalizeDefaults, normalizeSessions } from "@/lib/elderly-school/schedule";

export default async function handler(req, res) {
  const auth = await requireElderlySchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });
  const yearBE = Number(req.query?.yearBE || (req.body?.yearBE ?? null));
  if (!Number.isFinite(yearBE)) return res.status(400).json({ success: false, message: "Missing yearBE" });

  try {
    await dbConnect();

    if (req.method === "GET") {
      const doc = await ElderlySchoolSchedule.findOne({ yearBE }).lean();
      return res.status(200).json({ success: true, yearBE, schedule: doc || { yearBE, sessions: [] } });
    }

    if (req.method === "PUT") {
      const sessions = normalizeSessions(req.body?.sessions);
      const $set = { yearBE, sessions };
      // ส่ง defaults มาเมื่อไหร่ค่อยเขียน — client เก่าที่ส่งแค่ sessions ไม่ล้างค่าเริ่มต้น
      if (req.body && "defaults" in req.body) $set.defaults = normalizeDefaults(req.body.defaults);
      const doc = await ElderlySchoolSchedule.findOneAndUpdate(
        { yearBE },
        { $set },
        { upsert: true, new: true }
      ).lean();
      return res.status(200).json({ success: true, yearBE, schedule: doc });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (e) {
    console.error("schedule error:", e);
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}


