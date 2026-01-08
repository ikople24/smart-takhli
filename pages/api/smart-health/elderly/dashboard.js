import dbConnect from "@/lib/dbConnect";
import ElderlyVisit from "@/models/ElderlyVisit";
import { computeBMI, bmiCategoryThai, bpCategory } from "@/lib/elderlySchoolDashboard";

function maskCitizenId(id) {
  const s = String(id || "").replace(/\D/g, "");
  if (s.length < 4) return s || "";
  return `*********${s.slice(-4)}`;
}

function toNum(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const yearBE = Number(req.query.yearBE);
    if (!Number.isFinite(yearBE) || yearBE < 2500 || yearBE > 2700) {
      return res.status(400).json({ message: "Invalid yearBE (e.g. 2568)" });
    }

    const includePeople =
      req.query.includePeople === "1" || req.query.includePeople === "true";
    const riskOnly = req.query.riskOnly === "1" || req.query.riskOnly === "true";

    const visit =
      req.query.visit === "latest"
        ? "latest"
        : typeof req.query.visit === "string" && req.query.visit.trim()
          ? Number(req.query.visit.trim())
          : "latest";

    const visitNo =
      typeof visit === "number" && Number.isFinite(visit) && visit >= 1 && visit <= 16
        ? visit
        : null;

    await dbConnect();

    // Select one visit record per person for the given year:
    // - visitNo provided: pick that visitNo
    // - latest: pick max visitNo that has any measurement
    const match = { yearBE };
    if (visitNo) match.visitNo = visitNo;

    const pipeline = [
      { $match: match },
      {
        $addFields: {
          hasData: {
            $or: [
              { $ne: ["$weightKg", null] },
              { $ne: ["$waistCm", null] },
              { $ne: ["$pulseBpm", null] },
              { $ne: ["$bp1Sys", null] },
              { $ne: ["$bp1Dia", null] },
              { $ne: ["$bp2Sys", null] },
              { $ne: ["$bp2Dia", null] },
            ],
          },
        },
      },
      ...(visitNo
        ? []
        : [
            { $match: { hasData: true } },
            { $sort: { personId: 1, visitNo: -1 } },
            { $group: { _id: "$personId", visit: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$visit" } },
          ]),
      {
        $lookup: {
          from: "elderly_people",
          localField: "personId",
          foreignField: "_id",
          as: "person",
        },
      },
      { $unwind: { path: "$person", preserveNullAndEmptyArrays: true } },
    ];

    const rows = await ElderlyVisit.aggregate(pipeline);

    // Compute summary + people list
    const bmiCounts = { normal: 0, risk: 0, unknown: 0 };
    const bmiBreakdown = {
      underweight: 0,
      normal: 0,
      overweight: 0,
      obese1: 0,
      obese2: 0,
      unknown: 0,
    };
    const bpCounts = { normal: 0, low: 0, risk: 0, high: 0, unknown: 0 };

    // Averages
    let bmiSum = 0;
    let bmiN = 0;
    let bpSysSum = 0;
    let bpDiaSum = 0;
    let bpN = 0;
    let bpScoreSum = 0; // low=-1, normal=0, risk=1, high=2
    let bpScoreN = 0;

    const people = [];

    for (const r of rows) {
      const p = r.person || {};
      const heightCm = toNum(r.heightCm) ?? toNum(p.heightCm);
      const bmi = computeBMI(r.weightKg, heightCm);
      const bmiCat = bmiCategoryThai(bmi);

      // BP: prefer bp1 if present, else bp2
      const sys = toNum(r.bp1Sys) ?? toNum(r.bp2Sys);
      const dia = toNum(r.bp1Dia) ?? toNum(r.bp2Dia);
      const bpCat = bpCategory(sys, dia);

      const bmiRisk = bmiCat !== "unknown" && bmiCat !== "normal";
      const bpRisk = bpCat === "low" || bpCat === "risk" || bpCat === "high";

      if (typeof bmi === "number" && Number.isFinite(bmi)) {
        bmiSum += bmi;
        bmiN += 1;
      }

      if (bmiCat === "unknown") bmiCounts.unknown++;
      else if (bmiCat === "normal") bmiCounts.normal++;
      else bmiCounts.risk++;

      if (bmiCat in bmiBreakdown) bmiBreakdown[bmiCat]++;
      else bmiBreakdown.unknown++;

      if (sys !== null && dia !== null) {
        bpSysSum += sys;
        bpDiaSum += dia;
        bpN += 1;
      }

      if (bpCat === "unknown") bpCounts.unknown++;
      else if (bpCat === "normal") bpCounts.normal++;
      else if (bpCat === "low") bpCounts.low++;
      else if (bpCat === "high") bpCounts.high++;
      else bpCounts.risk++;

      if (bpCat !== "unknown") {
        const score =
          bpCat === "low" ? -1 : bpCat === "normal" ? 0 : bpCat === "risk" ? 1 : 2;
        bpScoreSum += score;
        bpScoreN += 1;
      }

      const overallRisk = bmiRisk || bpRisk;

      if (includePeople) {
        people.push({
          personId: String(p._id || r.personId),
          fullName: p.fullName || "",
          citizenIdMasked: p.citizenId ? maskCitizenId(p.citizenId) : "",
          yearBE,
          visitNo: r.visitNo,
          bmi,
          bmiCategory: bmiCat,
          bmiRisk,
          bp: { systolic: sys, diastolic: dia, category: bpCat, risk: bpRisk },
          overallRisk,
        });
      }
    }

      const bpRiskTotal = bpCounts.low + bpCounts.risk + bpCounts.high;
    const filteredPeople = riskOnly ? people.filter((x) => x.overallRisk) : people;

    return res.status(200).json({
      success: true,
      yearBE,
      visit: visitNo || "latest",
      totals: {
        peopleCounted: rows.length,
      },
      bmi: bmiCounts,
      bmiBreakdown,
      averages: {
        bmiAvg: bmiN ? bmiSum / bmiN : null,
        bmiN,
        bpAvgSys: bpN ? bpSysSum / bpN : null,
        bpAvgDia: bpN ? bpDiaSum / bpN : null,
        bpN,
        bpStatusScoreAvg: bpScoreN ? bpScoreSum / bpScoreN : null,
        bpStatusScoreN: bpScoreN,
        bpStatusScoreMapping: { low: -1, normal: 0, risk: 1, high: 2 },
      },
      bp: { ...bpCounts, riskTotal: bpRiskTotal },
      people: includePeople ? filteredPeople : undefined,
    });
  } catch (error) {
    console.error("elderly dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Dashboard failed",
    });
  }
}


