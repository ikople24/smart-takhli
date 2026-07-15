import dbConnect from "@/lib/dbConnect";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import "@/models/smart-school/SchoolApplicant"; // ให้ mongoose รู้จัก model ก่อน populate
import { getFiscalYearBE } from "@/lib/smart-school/fiscalYear";
import { maskCitizenId } from "@/lib/smart-school/citizenId";
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

    const [apps, yearsRaw] = await Promise.all([
      SchoolApplication.find({ surveyYear: year })
        .populate("applicantRef")
        .sort({ createdAt: -1 })
        .lean(),
      SchoolApplication.distinct("surveyYear"),
    ]);

    // จัดกลุ่มครัวเรือนจาก householdKey (fallback normalize address)
    const hkOf = (app) =>
      app.householdKey ||
      (String(app.address || "").replace(/\s+/g, "").toLowerCase().length >= 6
        ? String(app.address || "").replace(/\s+/g, "").toLowerCase()
        : null);

    const groups = {};
    for (const app of apps) {
      const k = hkOf(app);
      if (k) (groups[k] = groups[k] || []).push(app);
    }

    const applications = apps.map((app) => {
      const a = app.applicantRef || {};
      const k = hkOf(app);
      const members = (groups[k] || [])
        .filter((m) => String(m._id) !== String(app._id))
        .map((m) => ({
          ref: String(m._id),
          name: (m.applicantRef?.prefix || "") + (m.applicantRef?.name || ""),
          level: m.educationLevel || "",
          status: m.status,
        }));
      // derive ทั้งคู่จาก masked เดียวกัน — เลขผิดรูปใน DB จะโชว์เป็น "ยังไม่มีเลข" ให้กรอกทับได้
      const citizenIdMasked = a.citizenId ? maskCitizenId(a.citizenId) : "";
      return {
        ...app,
        applicantRef: String(a._id || app.applicantRef || ""),
        prefix: a.prefix || "",
        name: a.name || "",
        phone: a.phone || "",
        // เลขเต็มอยู่ใน a.citizenId (populate) — mask ฝั่ง server เท่านั้น ห้ามส่งเลขเต็มออก
        hasCitizenId: !!citizenIdMasked,
        citizenIdMasked: citizenIdMasked || null,
        household: { key: k, members },
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
