import { requireElderlySchoolAdmin } from "./_auth";
import dbConnect from "@/lib/dbConnect";
import ElderlyMentalHealthAssessment from "@/models/elderly-school/ElderlyMentalHealthAssessment";
import { is2QPositive, score9Q } from "@/lib/elderly-school/mentalHealth";
import { ObjectId } from "mongodb";

function getBangkokISODate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function handler(req, res) {
  const auth = await requireElderlySchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });
  await dbConnect();

  if (req.method === "GET") {
    const { personId, yearBE, limit = "20" } = req.query;
    if (!personId) return res.status(400).json({ success: false, message: "Missing personId" });
    const year = yearBE ? Number(yearBE) : null;
    const l = Math.min(50, Math.max(1, Number(limit) || 20));

    const filter = { personId: new ObjectId(personId) };
    if (year && Number.isFinite(year)) filter.yearBE = year;

    const items = await ElderlyMentalHealthAssessment.find(filter)
      .sort({ assessedAt: -1 })
      .limit(l)
      .lean();
    return res.status(200).json({ success: true, items });
  }

  if (req.method === "POST") {
    const { personId, yearBE, assessmentDate, q2, q9, assessedBy, note, referred } = req.body || {};
    if (!personId) return res.status(400).json({ success: false, message: "Missing personId" });
    const year = Number(yearBE);
    if (!Number.isFinite(year) || year < 2500 || year > 2700) {
      return res.status(400).json({ success: false, message: "Invalid yearBE" });
    }

    const dateISO = String(assessmentDate || "").trim() || getBangkokISODate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return res.status(400).json({ success: false, message: "Invalid assessmentDate (YYYY-MM-DD)" });
    }

    const q1 = Boolean(q2?.q1 === true || q2?.q1 === "true" || q2?.q1 === 1 || q2?.q1 === "1");
    const q2b = Boolean(q2?.q2 === true || q2?.q2 === "true" || q2?.q2 === 1 || q2?.q2 === "1");
    const positive = is2QPositive({ q1, q2: q2b });

    const scored = q9 ? score9Q(q9?.answers ?? q9) : score9Q(null);

    // Upsert by person-year-date (so staff can re-save same day)
    const update = {
      personId: new ObjectId(personId),
      yearBE: year,
      assessmentDate: dateISO,
      q2: { q1, q2: q2b, positive },
      q9: {
        answers: scored.answers,
        totalScore: scored.totalScore,
        severity: scored.severity,
        suicidalRisk: scored.suicidalRisk,
      },
      assessedAt: new Date(),
      assessedBy: assessedBy ? String(assessedBy).trim() : null,
      note: note ? String(note).trim() : null,
    };
    // แจ้งเจ้าหน้าที่ได้เฉพาะผล 2Q บวก — ส่ง referred มาเมื่อไหร่ค่อยเขียน (client เก่าไม่ส่ง = ไม่แตะค่าเดิม)
    if (referred !== undefined) {
      const on = positive && referred === true;
      update.referral = { notified: on, notifiedAt: on ? new Date() : null, notifiedBy: on ? auth.userId : null };
    }

    try {
      await ElderlyMentalHealthAssessment.updateOne(
        { personId: new ObjectId(personId), yearBE: year, assessmentDate: dateISO },
        { $set: update },
        { upsert: true }
      );
    } catch (e) {
      // E11000 race: retry once
      if (String(e?.message || "").includes("E11000")) {
        await ElderlyMentalHealthAssessment.updateOne(
          { personId: new ObjectId(personId), yearBE: year, assessmentDate: dateISO },
          { $set: update }
        );
      } else {
        throw e;
      }
    }

    const item = await ElderlyMentalHealthAssessment.findOne({
      personId: new ObjectId(personId),
      yearBE: year,
      assessmentDate: dateISO,
    }).lean();

    return res.status(200).json({ success: true, item });
  }

  // บันทึก/ยกเลิก "แจ้งเจ้าหน้าที่สาธารณสุขแล้ว" ของผลประเมินที่มีอยู่ (เฉพาะ 2Q บวก)
  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id || !ObjectId.isValid(String(id))) {
      return res.status(400).json({ success: false, message: "Missing id" });
    }
    const doc = await ElderlyMentalHealthAssessment.findOne({ _id: new ObjectId(String(id)) }).lean();
    if (!doc) return res.status(404).json({ success: false, message: "ไม่พบผลประเมิน" });
    if (!doc?.q2?.positive) {
      return res.status(400).json({ success: false, message: "แจ้งเจ้าหน้าที่ได้เฉพาะผล 2Q บวก" });
    }
    const on = req.body?.referred === true;
    await ElderlyMentalHealthAssessment.updateOne(
      { _id: doc._id },
      { $set: { referral: { notified: on, notifiedAt: on ? new Date() : null, notifiedBy: on ? auth.userId : null } } }
    );
    const item = await ElderlyMentalHealthAssessment.findOne({ _id: doc._id }).lean();
    return res.status(200).json({ success: true, item });
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}

