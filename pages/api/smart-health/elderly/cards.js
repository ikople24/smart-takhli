import dbConnect from "@/lib/dbConnect";
import ElderlyPerson from "@/models/ElderlyPerson";
import ElderlyVisit from "@/models/ElderlyVisit";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed" });
  try {
    const yearBE = Number(req.query?.yearBE);
    if (!Number.isFinite(yearBE)) {
      return res.status(400).json({ success: false, message: "Missing yearBE" });
    }

    await dbConnect();

    const personIds = await ElderlyVisit.distinct("personId", { yearBE });
    const people = await ElderlyPerson.find({ _id: { $in: personIds } })
      .select({ fullName: 1 })
      .lean();

    people.sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "th"));

    return res.status(200).json({
      success: true,
      yearBE,
      people: people.map((p) => ({ personId: String(p._id), fullName: p.fullName || "" })),
    });
  } catch (e) {
    console.error("cards error:", e);
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}


