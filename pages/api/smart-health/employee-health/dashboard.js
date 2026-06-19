import { fetchSheetCSVByGid, summarizeEmployeeHealthTable } from "@/lib/employeeHealthDashboard";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const sheetUrl = typeof req.query.sheetUrl === "string" ? req.query.sheetUrl.trim() : "";
    if (!sheetUrl) {
      return res.status(400).json({ success: false, message: "Missing sheetUrl" });
    }

    const gidsRaw = typeof req.query.gids === "string" ? req.query.gids.trim() : "0";
    const gids = gidsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (!gids.length) {
      return res.status(400).json({ success: false, message: "Missing gids" });
    }

    const includePeople = req.query.includePeople === "1" || req.query.includePeople === "true";
    const riskOnly = req.query.riskOnly === "1" || req.query.riskOnly === "true";
    const countMode = req.query.countMode === "rows" || req.query.countMode === "unique" ? req.query.countMode : "unique";
    const tab =
      req.query.tab === "all"
        ? "all"
        : typeof req.query.tab === "string" && req.query.tab.trim()
          ? req.query.tab.trim()
          : "all";

    const selectedGids = tab === "all" ? gids : gids.includes(tab) ? [tab] : gids;

    const tables = await Promise.all(
      selectedGids.map(async (gid) => {
        const t = await fetchSheetCSVByGid(sheetUrl, gid, { timeoutMs: 20000 });
        return { gid, table: t };
      })
    );

    const summaries = tables.map(({ gid, table }) => {
      const s = summarizeEmployeeHealthTable(table, { countMode, sheetKey: String(gid) });
      return { gid, csvUrl: table.csvUrl, summary: s };
    });

    // merge
    const merged = {
      totals: { peopleCounted: 0, countMode },
      bmi: { normal: 0, risk: 0, unknown: 0 },
      bp: { normal: 0, low: 0, risk: 0, high: 0, unknown: 0, riskTotal: 0 },
      sugar: { normal: 0, low: 0, risk: 0, high: 0, unknown: 0 },
      people: [],
      sheets: summaries.map((x) => ({
        gid: x.gid,
        csvUrl: x.csvUrl,
        detectedColumns: x.summary.detectedColumns,
        totals: x.summary.totals,
      })),
    };

    for (const x of summaries) {
      const s = x.summary;
      merged.totals.peopleCounted += s.totals.peopleCounted;
      merged.bmi.normal += s.bmi.normal;
      merged.bmi.risk += s.bmi.risk;
      merged.bmi.unknown += s.bmi.unknown;

      merged.bp.normal += s.bp.normal;
      merged.bp.low += s.bp.low;
      merged.bp.risk += s.bp.risk;
      merged.bp.high += s.bp.high;
      merged.bp.unknown += s.bp.unknown;
      merged.bp.riskTotal += s.bp.riskTotal;

      merged.sugar.normal += s.sugar.normal;
      merged.sugar.low += s.sugar.low;
      merged.sugar.risk += s.sugar.risk;
      merged.sugar.high += s.sugar.high;
      merged.sugar.unknown += s.sugar.unknown;

      if (includePeople) merged.people.push(...(Array.isArray(s.people) ? s.people : []));
    }

    const people = Array.isArray(merged.people) ? merged.people : [];
    const filteredPeople = riskOnly ? people.filter((p) => p?.overallRisk) : people;

    return res.status(200).json({
      success: true,
      sheetUrl,
      gids,
      tab: tab === "all" ? "all" : selectedGids[0],
      totals: merged.totals,
      bmi: merged.bmi,
      bp: merged.bp,
      sugar: merged.sugar,
      sheets: merged.sheets,
      people: includePeople ? filteredPeople : undefined,
    });
  } catch (e) {
    console.error("employee health dashboard error:", e);
    return res.status(500).json({
      success: false,
      message: e?.message || "Server error",
      hint:
        "ถ้าเห็นว่า sheet ไม่ public: ไปที่ Google Sheet → Share → ตั้งค่า Anyone with the link (Viewer) และ/หรือ File → Share → Publish to the web",
    });
  }
}

