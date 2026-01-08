import dbConnect from "@/lib/dbConnect";
import ElderlyVisit from "@/models/ElderlyVisit";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    const { personId, yearBE } = req.query;
    if (!personId) return res.status(400).json({ message: "Missing personId" });

    const filter = { personId: new ObjectId(personId) };
    if (yearBE) filter.yearBE = Number(yearBE);

    const visits = await ElderlyVisit.find(filter).sort({ yearBE: -1, visitNo: 1 }).lean();
    return res.status(200).json({ success: true, visits });
  }

  if (req.method === "POST") {
    const { personId, yearBE, visitNo, ...rest } = req.body || {};
    if (!personId) return res.status(400).json({ message: "Missing personId" });
    const year = Number(yearBE);
    const no = Number(visitNo);
    if (!Number.isFinite(year) || year < 2500 || year > 2700) {
      return res.status(400).json({ message: "Invalid yearBE" });
    }
    if (!Number.isFinite(no) || no < 1 || no > 16) {
      return res.status(400).json({ message: "Invalid visitNo (1..16)" });
    }

    const allowed = [
      "measuredAt",
      "weightKg",
      "heightCm",
      "waistCm",
      "pulseBpm",
      "bp1Sys",
      "bp1Dia",
      "bp2Sys",
      "bp2Dia",
      "note",
      "editedBy",
      "editReason",
    ];
    const update = {};
    for (const k of allowed) {
      if (k in rest) update[k] = rest[k];
    }

    await ElderlyVisit.updateOne(
      { personId: new ObjectId(personId), yearBE: year, visitNo: no },
      { $set: { ...update, source: "manual" } },
      { upsert: true }
    );

    const visit = await ElderlyVisit.findOne({ personId: new ObjectId(personId), yearBE: year, visitNo: no }).lean();
    return res.status(200).json({ success: true, visit });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: "Missing id" });

    const allowed = [
      "measuredAt",
      "weightKg",
      "heightCm",
      "waistCm",
      "pulseBpm",
      "bp1Sys",
      "bp1Dia",
      "bp2Sys",
      "bp2Dia",
      "note",
      "editedBy",
      "editReason",
    ];
    const update = {};
    for (const k of allowed) {
      if (k in (req.body || {})) update[k] = req.body[k];
    }

    await ElderlyVisit.updateOne({ _id: new ObjectId(id) }, { $set: update });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ message: "Method not allowed" });
}


