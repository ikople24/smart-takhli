import { requireElderlySchoolAdmin } from "./_auth";
import dbConnect from "@/lib/dbConnect";
import ElderlyVisit from "@/models/elderly-school/ElderlyVisit";
import { computeBMI, bmiCategoryThai, bpCategory, coerceMeasurementNumber } from "@/lib/health/metrics";
import ElderlyMentalHealthAssessment from "@/models/elderly-school/ElderlyMentalHealthAssessment";
import ElderlySchoolSchedule from "@/models/elderly-school/ElderlySchoolSchedule";
import { missedStreak } from "@/lib/elderly-school/followUp";
import { normalizeSessions } from "@/lib/elderly-school/schedule";
import { yearPersonIds } from "@/lib/elderly-school/enrollment";

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

// ฟิลด์ผลวัด — visit ที่มีค่าอย่างน้อย 1 ช่อง = "มาเรียน/มีผลวัด"
const HAS_DATA_FIELDS = ["weightKg", "waistCm", "pulseBpm", "bp1Sys", "bp1Dia", "bp2Sys", "bp2Dia"];

function visitHasData(v) {
  return HAS_DATA_FIELDS.some((f) => v?.[f] !== null && v?.[f] !== undefined);
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
  const auth = await requireElderlySchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });
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

    // ทุก query ยิงพร้อมกันรอบเดียว (DB อยู่ไกล = แต่ละรอบแพง) — ข้อมูลทั้งปีมีแค่หลักพันแถว
    // ผล 2Q และประวัติ visit ดึงของทั้งปีมาก่อน แล้วค่อยกรองตามคนใน JS (ผลเท่าเดิม)
    const [rows, registeredIds, attendanceAgg, latestAssessments, allVisits, scheduleDoc] = await Promise.all([
      ElderlyVisit.aggregate(pipeline),
      // ภาพรวมทั้งปี (ไม่ขึ้นกับครั้งที่เลือก): จำนวนผู้เรียนในปี (รวมผู้ลงทะเบียนที่ยังไม่มีผลวัด) + จำนวนคนที่มีผลวัดแต่ละครั้ง
      yearPersonIds(yearBE),
      ElderlyVisit.aggregate([
        { $match: { yearBE } },
        { $match: { $or: HAS_DATA_FIELDS.map((f) => ({ [f]: { $ne: null } })) } },
        { $group: { _id: "$visitNo", count: { $sum: 1 } } },
      ]),
      // Latest mental health assessment per person (same year)
      ElderlyMentalHealthAssessment.aggregate([
        { $match: { yearBE } },
        { $sort: { personId: 1, assessedAt: -1 } },
        { $group: { _id: "$personId", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
      ]),
      // Visits history (for trend fields) - only when includePeople
      includePeople
        ? ElderlyVisit.find({ yearBE }).sort({ personId: 1, visitNo: 1 }).lean()
        : Promise.resolve([]),
      // วันเรียน (สำหรับนับขาดเรียนติดกัน) - only when includePeople
      includePeople ? ElderlySchoolSchedule.findOne({ yearBE }).lean() : Promise.resolve(null),
    ]);
    const attendanceByNo = new Map((attendanceAgg || []).map((a) => [Number(a._id), a.count]));

    // ขาดเรียนติดกันรายคน (ทุกคนในปี) — นับเฉพาะวันเรียนที่ผ่านไปแล้ว ไม่นับวันนี้
    const attendanceByPerson = [];
    const streakByPersonId = new Map();
    if (includePeople) {
      const todayISO = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const doneNos = normalizeSessions(scheduleDoc?.sessions)
        .filter((x) => x.dateISO < todayISO)
        .map((x) => x.visitNo);
      // ครั้งที่มีผลวัดรายคน — ใช้ allVisits ที่ดึงมาแล้ว (ไม่ยิง query เพิ่ม)
      const attendedById = new Map();
      for (const v of allVisits || []) {
        if (!visitHasData(v)) continue;
        const k = String(v.personId);
        const arr = attendedById.get(k) || [];
        if (!arr.includes(v.visitNo)) arr.push(v.visitNo);
        attendedById.set(k, arr);
      }
      for (const id of registeredIds) {
        const key = String(id);
        const nos = attendedById.get(key) || [];
        const streak = missedStreak(doneNos, nos);
        streakByPersonId.set(key, streak);
        attendanceByPerson.push({ personId: key, attended: nos.length, missedStreak: streak });
      }
    }
    const attendance = Array.from({ length: 16 }, (_, i) => ({
      visitNo: i + 1,
      count: attendanceByNo.get(i + 1) || 0,
    }));

    const personIds = new Set(rows.map((r) => r?.person?._id || r?.personId).filter(Boolean).map(String));

    // ผล 2Q ของผู้เรียนทั้งปี (รวมคนที่ยังไม่มีผลวัด) — การ์ดสรุปยังนับเฉพาะ rows เหมือนเดิม
    const mhIds = includePeople ? new Set(registeredIds.map(String)) : personIds;
    const mhByPersonId = new Map();
    for (const a of latestAssessments || []) {
      if (mhIds.has(String(a.personId))) mhByPersonId.set(String(a.personId), a);
    }

    const visitsByPersonId = new Map();
    for (const v of allVisits || []) {
      const k = String(v.personId);
      if (!personIds.has(k)) continue;
      const arr = visitsByPersonId.get(k) || [];
      arr.push(v);
      visitsByPersonId.set(k, arr);
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
    const mentalCounts = { ok: 0, risk: 0, unknown: 0 };

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
      // สูง: ใช้จากโปรไฟล์คนก่อน แล้วค่อยค่าใน visit (ชีต) เมื่อโปรไฟล์ไม่มี — BMI/WHtR จะสอดคล้องกับส่วนสูงที่แก้ในหน้าคน
      const heightRaw = p.heightCm ?? r.heightCm;
      const heightCm = coerceMeasurementNumber(heightRaw);
      // BMI เฉพาะรอบนี้: ไม่ย้อนใช้น้ำหนักครั้งก่อน — ไม่มีน้ำหนักใน visit นี้จะไม่คำนวณ
      const bmi = computeBMI(r.weightKg, heightRaw);
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
            assessmentId: assessment?._id ? String(assessment._id) : null,
            referred: assessment?.referral?.notified === true,
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

      // Dashboard สุขภาพจิต: ใช้เฉพาะผล 2Q บวก/ไม่บวก (ไม่นับเกณฑ์จาก 9Q ในการสรุปการ์ด)
      const mhRisk2q = mh?.q2Positive === true;

      if (!mh) mentalCounts.unknown++;
      else if (mhRisk2q) mentalCounts.risk++;
      else mentalCounts.ok++;

      const overallRisk = bmiRisk || bpRisk || (!metabolicUnknown && meta.score >= 2) || mhRisk2q;

      if (includePeople) {
        people.push({
          personId: String(p._id || r.personId),
          fullName: p.fullName || "",
          citizenIdMasked: p.citizenId ? maskCitizenId(p.citizenId) : "",
          yearBE,
          visitNo: r.visitNo,
          visitId: r._id ? String(r._id) : null,
          source: r.source || null,
          hasData: visitHasData(r),
          attendedCount: (visitsByPersonId.get(personKey) || []).filter(visitHasData).length,
          missedStreak: streakByPersonId.get(personKey) ?? 0,
          // ค่าดิบรอบ 1/2 สำหรับตารางกรอกผลรายครั้ง (bp ด้านล่างเลือกรอบ 1 ก่อน)
          bpReadings: {
            bp1Sys: toNum(r.bp1Sys),
            bp1Dia: toNum(r.bp1Dia),
            bp2Sys: toNum(r.bp2Sys),
            bp2Dia: toNum(r.bp2Dia),
          },
          weightKg: coerceMeasurementNumber(r.weightKg),
          heightCmForBmi: heightCm,
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

    // ผล 2Q ล่าสุดของคนที่ไม่มีผลวัดในชุดนี้ (แท็บคัดกรองต้องเห็นว่าใครประเมินแล้ว)
    const rowIds = new Set(rows.map((r) => String(r?.person?._id || r?.personId)));
    const mentalHealthOthers = includePeople
      ? Array.from(mhByPersonId.values())
          .filter((a) => !rowIds.has(String(a.personId)))
          .map((a) => ({
            personId: String(a.personId),
            q2Positive: Boolean(a?.q2?.positive),
            assessmentDate: a?.assessmentDate || null,
            assessmentId: a?._id ? String(a._id) : null,
            referred: a?.referral?.notified === true,
          }))
      : undefined;

    const bpRiskTotal = bpCounts.low + bpCounts.risk + bpCounts.high;
    const filteredPeople = riskOnly ? people.filter((x) => x.overallRisk) : people;

    return res.status(200).json({
      success: true,
      yearBE,
      visit: visitNo || "latest",
      totals: {
        peopleCounted: rows.length,
        registered: registeredIds.length,
      },
      attendance,
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
      mentalHealthOthers,
      attendanceByPerson: includePeople ? attendanceByPerson : undefined,
    });
  } catch (error) {
    console.error("elderly dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Dashboard failed",
    });
  }
}


