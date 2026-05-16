import dbConnect from "@/lib/dbConnect";
import ElderlySchoolSchedule from "@/models/ElderlySchoolSchedule";

function normalizeSessions(sessions) {
  const arr = Array.isArray(sessions) ? sessions : [];
  const cleaned = arr
    .map((s) => ({
      visitNo: Number(s?.visitNo),
      dateISO: String(s?.dateISO || "").trim(),
      note: s?.note ? String(s.note).trim() : null,
    }))
    .filter((s) => Number.isFinite(s.visitNo) && s.visitNo >= 1 && s.visitNo <= 16 && /^\d{4}-\d{2}-\d{2}$/.test(s.dateISO));

  // unique by visitNo; keep latest
  const byVisit = new Map();
  for (const s of cleaned) byVisit.set(s.visitNo, s);
  const uniq = Array.from(byVisit.values()).sort((a, b) => a.visitNo - b.visitNo);

  // also ensure dateISO is unique (no duplicate dates)
  const dateSeen = new Set();
  const out = [];
  for (const s of uniq) {
    if (dateSeen.has(s.dateISO)) continue;
    dateSeen.add(s.dateISO);
    out.push(s);
  }
  return out;
}

export default async function handler(req, res) {
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
      const doc = await ElderlySchoolSchedule.findOneAndUpdate(
        { yearBE },
        { $set: { yearBE, sessions } },
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


