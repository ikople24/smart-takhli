import dbConnect from "@/lib/dbConnect";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import "@/models/smart-school/SchoolApplicant"; // ให้ mongoose รู้จัก model ก่อน populate
import { getFiscalYearBE } from "@/lib/smart-school/fiscalYear";
import { requireSchoolAdmin } from "./_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
  const auth = await requireSchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  try {
    await dbConnect();
    const year = parseInt(req.query.year) || getFiscalYearBE();

    const [apps, yearsRaw, prevAwarded] = await Promise.all([
      SchoolApplication.find({ surveyYear: year })
        .populate("applicantRef")
        .sort({ createdAt: -1 })
        .lean(),
      SchoolApplication.distinct("surveyYear"),
      SchoolApplication.find({ surveyYear: year - 1, status: "ได้รับทุน" })
        .select("applicantRef")
        .lean(),
    ]);

    const prevAwardedSet = new Set(prevAwarded.map((a) => String(a.applicantRef)));

    // จัดกลุ่มครัวเรือน: key = เบอร์โทร (p:) หรือที่อยู่ตรงกันทั้งข้อความ (a:)
    const keysOf = (app) => {
      const phone = (app.applicantRef?.phone || "").trim();
      const addr = (app.address || "").trim();
      return [phone && `p:${phone}`, addr && `a:${addr}`].filter(Boolean);
    };
    const groups = {};
    for (const app of apps) {
      for (const key of keysOf(app)) (groups[key] = groups[key] || []).push(app);
    }

    const applications = apps.map((app) => {
      const keys = keysOf(app);
      const mates = new Map();
      for (const k of keys) {
        for (const m of groups[k] || []) {
          if (String(m._id) !== String(app._id)) mates.set(String(m._id), m);
        }
      }
      const a = app.applicantRef || {};
      return {
        ...app,
        applicantRef: String(a._id || app.applicantRef || ""),
        prefix: a.prefix || "",
        name: a.name || "",
        phone: a.phone || "",
        citizenId: a.citizenId || null,
        flags: {
          prevYearAwarded: prevAwardedSet.has(String(a._id)),
          householdKey: keys.find((k) => (groups[k] || []).length >= 2) || null,
          householdAwardedOther: [...mates.values()].some((m) => m.status === "ได้รับทุน"),
        },
      };
    });

    const stats = {
      total: applications.length,
      renewals: applications.filter((r) => r.isRenewal).length,
      byStatus: applications.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {}),
    };

    return res.status(200).json({
      year,
      years: yearsRaw.sort((x, y) => y - x),
      applications,
      stats,
    });
  } catch (err) {
    console.error("❌ smart-school list error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
