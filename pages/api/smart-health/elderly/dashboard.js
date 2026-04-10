import dbConnect from "@/lib/dbConnect";
import ElderlyVisit from "@/models/ElderlyVisit";
import { computeBMI, bmiCategoryThai, bpCategory } from "@/lib/elderlySchoolDashboard";
import ElderlyMentalHealthAssessment from "@/models/ElderlyMentalHealthAssessment";
import { ObjectId } from "mongodb";

function maskCitizenId(id) {
  const s = String(id || "").replace(/\D/g, "");
  if (s.length < 4) return s || "";
  return `*********${s.slice(-4)}`;
}

function toNum(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function round1(n) {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function computeWhtR(waistCm, heightCm) {
  const w = toNum(waistCm);
  const h = toNum(heightCm);
  if (!w || !h) return null;
  if (h <= 0) return null;
  return w / h;
}

function pulseCategory(pulseBpm) {
  const p = toNum(pulseBpm);
  if (!p) return "unknown";
  if (p < 50) return "low";
  if (p <= 100) return "normal";
  return "high";
}

function metabolicScreeningScore({ bmi, bmiCategory, whtRVal, bpSys, bpDia }) {
  // Screening-only score from fields we have (not a diagnosis).
  // +1: WHtR >= 0.5 (abdominal obesity)
  // +1: BMI >= 25 (obese1/obese2)
  // +1: BP >= 130/85 (numeric)
  let score = 0;
  const abdominalRisk = typeof whtRVal === "number" && whtRVal >= 0.5;
  if (abdominalRisk) score += 1;

  const bmiObese =
    bmiCategory === "obese1" ||
    bmiCategory === "obese2" ||
    (typeof bmi === "number" && Number.isFinite(bmi) && bmi >= 25);
  if (bmiObese) score += 1;

  const s = toNum(bpSys);
  const d = toNum(bpDia);
  const bpHigh = (s !== null && s >= 130) || (d !== null && d >= 85);
  if (bpHigh) score += 1;

  return { score, abdominalRisk };
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

    // Latest mental health assessment per person (same year)
    const personIds = rows
      .map((r) => r?.person?._id || r?.personId)
      .filter(Boolean)
      .map((id) => new ObjectId(String(id)));

    const mhByPersonId = new Map();
    if (personIds.length) {
      const latestAssessments = await ElderlyMentalHealthAssessment.aggregate([
        { $match: { yearBE, personId: { $in: personIds } } },
        { $sort: { personId: 1, assessedAt: -1 } },
        { $group: { _id: "$personId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
      ]);
      for (const a of latestAssessments || []) {
        mhByPersonId.set(String(a.personId), a);
      }
    }

    // Visits history (for trend fields) - only when includePeople
    const visitsByPersonId = new Map();
    if (includePeople && personIds.length) {
      const allVisits = await ElderlyVisit.find({ yearBE, personId: { $in: personIds } })
        .sort({ personId: 1, visitNo: 1 })
        .lean();
      for (const v of allVisits || []) {
        const k = String(v.personId);
        const arr = visitsByPersonId.get(k) || [];
        arr.push(v);
        visitsByPersonId.set(k, arr);
      }
    }

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
    const pulseCounts = { normal: 0, low: 0, high: 0, unknown: 0 };
    const abdominalCounts = { normal: 0, risk: 0, unknown: 0 }; // WHtR>=0.5
    const metabolicCounts = { low: 0, high: 0, unknown: 0 }; // score>=2
    const mentalCounts = { ok: 0, risk: 0, urgent: 0, unknown: 0 };

    // Averages
    let bmiSum = 0;
    let bmiN = 0;
    let bpSysSum = 0;
    let bpDiaSum = 0;
    let bpN = 0;
    let bpScoreSum = 0; // low=-1, normal=0, risk=1, high=2
    let bpScoreN = 0;
    let whtRSum = 0;
    let whtRN = 0;

    const people = [];

    for (const r of rows) {
      const p = r.person || {};
      const personKey = String(p._id || r.personId);
      const heightCm = toNum(r.heightCm) ?? toNum(p.heightCm);
      const bmi = computeBMI(r.weightKg, heightCm);
      const bmiCat = bmiCategoryThai(bmi);

      // BP: prefer bp1 if present, else bp2
      const sys = toNum(r.bp1Sys) ?? toNum(r.bp2Sys);
      const dia = toNum(r.bp1Dia) ?? toNum(r.bp2Dia);
      const bpCat = bpCategory(sys, dia);

      const pulseCat = pulseCategory(r.pulseBpm);
      if (pulseCat === "unknown") pulseCounts.unknown++;
      else if (pulseCat === "low") pulseCounts.low++;
      else if (pulseCat === "high") pulseCounts.high++;
      else pulseCounts.normal++;

      const whtRVal = computeWhtR(r.waistCm, heightCm);
      if (typeof whtRVal === "number") {
        whtRSum += whtRVal;
        whtRN += 1;
      }
      if (whtRVal === null) abdominalCounts.unknown++;
      else if (whtRVal >= 0.5) abdominalCounts.risk++;
      else abdominalCounts.normal++;

      const meta = metabolicScreeningScore({
        bmi,
        bmiCategory: bmiCat,
        whtRVal,
        bpSys: sys,
        bpDia: dia,
      });
      const metabolicUnknown =
        whtRVal === null && (bmiCat === "unknown" || bmi === null) && (sys === null || dia === null);
      if (metabolicUnknown) {
        metabolicCounts.unknown++;
      } else if (meta.score >= 2) {
        metabolicCounts.high++;
      } else {
        metabolicCounts.low++;
      }

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

      const assessment = mhByPersonId.get(personKey) || null;
      const mh = assessment
        ? {
            q2Positive: Boolean(assessment?.q2?.positive),
            q9Severity: assessment?.q9?.severity || "unknown",
            q9TotalScore:
              typeof assessment?.q9?.totalScore === "number" ? assessment.q9.totalScore : null,
            suicidalRisk:
              typeof assessment?.q9?.suicidalRisk === "boolean" ? assessment.q9.suicidalRisk : null,
            assessedAt: assessment?.assessedAt || null,
            assessmentDate: assessment?.assessmentDate || null,
          }
        : null;

      // Trend metrics (vs baseline and previous)
      let trend = null;
      if (includePeople) {
        const history = visitsByPersonId.get(personKey) || [];
        const currentVisitNo = typeof r.visitNo === "number" ? r.visitNo : null;

        const baselineWeightKg = toNum(p.baselineWeightKg);
        const firstWeightVisit = history.find((x) => toNum(x?.weightKg) !== null);
        const baselineWeightUsed =
          baselineWeightKg !== null ? baselineWeightKg : toNum(firstWeightVisit?.weightKg);

        const currentWeight = toNum(r.weightKg);
        const prevWeightVisit = [...history]
          .filter((x) => (currentVisitNo ? (x.visitNo || 0) < currentVisitNo : true))
          .reverse()
          .find((x) => toNum(x?.weightKg) !== null);

        const currentWaist = toNum(r.waistCm);
        const firstWaistVisit = history.find((x) => toNum(x?.waistCm) !== null);
        const baselineWaistUsed = toNum(firstWaistVisit?.waistCm);
        const prevWaistVisit = [...history]
          .filter((x) => (currentVisitNo ? (x.visitNo || 0) < currentVisitNo : true))
          .reverse()
          .find((x) => toNum(x?.waistCm) !== null);

        const prevBpVisit = [...history]
          .filter((x) => (currentVisitNo ? (x.visitNo || 0) < currentVisitNo : true))
          .reverse()
          .find((x) => (toNum(x?.bp1Sys) ?? toNum(x?.bp2Sys)) !== null && (toNum(x?.bp1Dia) ?? toNum(x?.bp2Dia)) !== null);
        const prevSys = prevBpVisit ? toNum(prevBpVisit.bp1Sys) ?? toNum(prevBpVisit.bp2Sys) : null;
        const prevDia = prevBpVisit ? toNum(prevBpVisit.bp1Dia) ?? toNum(prevBpVisit.bp2Dia) : null;

        trend = {
          currentVisitNo,
          baseline: {
            weightKg: baselineWeightUsed,
            waistCm: baselineWaistUsed,
          },
          previous: {
            visitNo: prevWeightVisit?.visitNo ?? prevWaistVisit?.visitNo ?? prevBpVisit?.visitNo ?? null,
            weightKg: toNum(prevWeightVisit?.weightKg),
            waistCm: toNum(prevWaistVisit?.waistCm),
            bpSys: prevSys,
            bpDia: prevDia,
          },
          deltaFromBaseline: {
            weightKg:
              currentWeight !== null && baselineWeightUsed !== null
                ? round1(currentWeight - baselineWeightUsed)
                : null,
            waistCm:
              currentWaist !== null && baselineWaistUsed !== null
                ? round1(currentWaist - baselineWaistUsed)
                : null,
          },
          deltaFromPrevious: {
            weightKg:
              currentWeight !== null && toNum(prevWeightVisit?.weightKg) !== null
                ? round1(currentWeight - toNum(prevWeightVisit.weightKg))
                : null,
            waistCm:
              currentWaist !== null && toNum(prevWaistVisit?.waistCm) !== null
                ? round1(currentWaist - toNum(prevWaistVisit.waistCm))
                : null,
            bpSys: sys !== null && prevSys !== null ? round1(sys - prevSys) : null,
            bpDia: dia !== null && prevDia !== null ? round1(dia - prevDia) : null,
          },
        };
      }

      const mhUrgent = mh?.suicidalRisk === true;
      const mhRisk =
        mhUrgent ||
        mh?.q9Severity === "moderate" ||
        mh?.q9Severity === "severe" ||
        (mh?.q2Positive === true && (mh?.q9Severity === "unknown" || mh?.q9TotalScore === null));

      if (!mh) mentalCounts.unknown++;
      else if (mhUrgent) mentalCounts.urgent++;
      else if (mhRisk) mentalCounts.risk++;
      else mentalCounts.ok++;

      const overallRisk = bmiRisk || bpRisk || (!metabolicUnknown && meta.score >= 2) || mhRisk;

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
          waistCm: toNum(r.waistCm),
          whtR: round1(whtRVal),
          abdominalRisk: whtRVal === null ? null : whtRVal >= 0.5,
          pulseBpm: toNum(r.pulseBpm),
          pulseCategory: pulseCat,
          metabolicRiskScore: metabolicUnknown ? null : meta.score,
          metabolicRiskHigh: metabolicUnknown ? null : meta.score >= 2,
          bp: { systolic: sys, diastolic: dia, category: bpCat, risk: bpRisk },
          mentalHealth: mh,
          trend,
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
        whtRAvg: whtRN ? whtRSum / whtRN : null,
        whtRN,
      },
      bp: { ...bpCounts, riskTotal: bpRiskTotal },
      pulse: pulseCounts,
      abdominal: abdominalCounts,
      metabolic: metabolicCounts,
      mentalHealth: mentalCounts,
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


