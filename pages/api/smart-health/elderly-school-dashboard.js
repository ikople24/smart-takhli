import {
  fetchAndParseSheetCSV,
  summarizeElderlySchoolRows,
} from "@/lib/elderlySchoolDashboard";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const csvUrl = process.env.ELDERLY_SCHOOL_SHEET_CSV_URL;

    const dateISO =
      typeof req.query.date === "string" && req.query.date.trim()
        ? req.query.date.trim()
        : null;

    const countMode =
      req.query.countMode === "rows" || req.query.countMode === "unique"
        ? req.query.countMode
        : "unique";

    const includePeople =
      req.query.includePeople === "1" || req.query.includePeople === "true";

    const riskOnly = req.query.riskOnly === "1" || req.query.riskOnly === "true";

    const visit =
      req.query.visit === "latest"
        ? "latest"
        : typeof req.query.visit === "string" && req.query.visit.trim()
          ? Number(req.query.visit.trim())
          : "latest";

    const columnMap = {
      date: process.env.ELDERLY_SCHOOL_SHEET_DATE_COLUMN,
      weight: process.env.ELDERLY_SCHOOL_SHEET_WEIGHT_COLUMN,
      height: process.env.ELDERLY_SCHOOL_SHEET_HEIGHT_COLUMN,
      systolic: process.env.ELDERLY_SCHOOL_SHEET_SYSTOLIC_COLUMN,
      diastolic: process.env.ELDERLY_SCHOOL_SHEET_DIASTOLIC_COLUMN,
      bp: process.env.ELDERLY_SCHOOL_SHEET_BP_COLUMN,
      bp1: process.env.ELDERLY_SCHOOL_SHEET_BP1_COLUMN,
      bp2: process.env.ELDERLY_SCHOOL_SHEET_BP2_COLUMN,
      citizenId: process.env.ELDERLY_SCHOOL_SHEET_CITIZENID_COLUMN,
      id: process.env.ELDERLY_SCHOOL_SHEET_ID_COLUMN,
      visit:
        typeof visit === "number" && Number.isFinite(visit) && visit >= 1
          ? visit
          : visit === "latest"
            ? "latest"
            : null,
    };

    const table = await fetchAndParseSheetCSV(csvUrl, { timeoutMs: 20000 });
    const summary = summarizeElderlySchoolRows(table, { dateISO, columnMap, countMode });

    const people = Array.isArray(summary.people) ? summary.people : [];
    const filteredPeople = riskOnly ? people.filter((p) => p?.overallRisk) : people;

    return res.status(200).json({
      success: true,
      source: {
        csvUrlConfigured: Boolean(csvUrl),
      },
      ...summary,
      people: includePeople ? filteredPeople : undefined,
    });
  } catch (error) {
    console.error("elderly-school-dashboard API error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "เกิดข้อผิดพลาดในระบบ",
      source: {
        csvUrlConfigured: Boolean(process.env.ELDERLY_SCHOOL_SHEET_CSV_URL),
      },
      hint:
        "ถ้าเห็นว่า sheet ไม่ public: ไปที่ Google Sheet → File → Share → ตั้งค่า Anyone with the link (Viewer) และ/หรือ File → Share → Publish to the web แล้วนำลิงก์ CSV มาใส่ใน ELDERLY_SCHOOL_SHEET_CSV_URL",
    });
  }
}


