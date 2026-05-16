import dbConnect from "@/lib/dbConnect";
import ElderlyPerson from "@/models/ElderlyPerson";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    const { id, search = "", page = "1", limit = "20" } = req.query;
    if (id) {
      const person = await ElderlyPerson.findOne({ _id: new ObjectId(id) }).lean();
      if (!person) return res.status(404).json({ message: "Not found" });
      return res.status(200).json({ success: true, person });
    }

    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const q = String(search || "").trim();

    const filter = q
      ? {
          $or: [
            { fullName: { $regex: q, $options: "i" } },
            { citizenId: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      ElderlyPerson.find(filter).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      ElderlyPerson.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      items,
      page: p,
      limit: l,
      total,
    });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: "Missing id" });

    const allowed = [
      "fullName",
      "ageYears",
      "birthDateText",
      "bloodType",
      "address",
      "phone",
      "occupation",
      "heightCm",
      "baselineWeightKg",
      "notes",
    ];
    const update = {};
    for (const k of allowed) {
      if (k in (req.body || {})) update[k] = req.body[k];
    }

    await ElderlyPerson.updateOne({ _id: new ObjectId(id) }, { $set: update });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ message: "Method not allowed" });
}


