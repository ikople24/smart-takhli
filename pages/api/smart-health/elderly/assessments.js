import dbConnect from "@/lib/dbConnect";
import ElderlyMentalHealthAssessment from "@/models/ElderlyMentalHealthAssessment";
import { is2QPositive, score9Q } from "@/lib/elderlyMentalHealth";
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
    const { personId, yearBE, assessmentDate, q2, q9, assessedBy, note } = req.body || {};
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

  return res.status(405).json({ success: false, message: "Method not allowed" });
}

