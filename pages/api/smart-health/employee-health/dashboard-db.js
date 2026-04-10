import dbConnect from "@/lib/dbConnect";
import EmployeeHealthRecord from "@/models/EmployeeHealthRecord";
import { computeBMI, bmiCategoryThai, bpCategory } from "@/lib/elderlySchoolDashboard";
import { sugarCategoryMgDl } from "@/lib/employeeHealthDashboard";

function toNum(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const includePeople = req.query.includePeople === "1" || req.query.includePeople === "true";
    const riskOnly = req.query.riskOnly === "1" || req.query.riskOnly === "true";
    const department =
      typeof req.query.department === "string" && req.query.department.trim()
        ? req.query.department.trim()
        : null;

    await dbConnect();

    const match = department ? { department } : {};

    // Build department list from records (source of truth for UI tabs)
    const deptAgg = await EmployeeHealthRecord.aggregate([
      { $match: {} },
      { $group: { _id: "$department", people: { $addToSet: "$personId" } } },
      { $project: { department: "$_id", peopleCount: { $size: "$people" } } },
      { $sort: { department: 1 } },
    ]);
    const departments = (deptAgg || [])
      .map((d) => ({ department: String(d.department || ""), peopleCount: Number(d.peopleCount || 0) }))
      .filter((d) => d.department);

    const rows = await EmployeeHealthRecord.aggregate([
      { $match: match },
      { $sort: { personId: 1, measuredAt: -1 } },
      { $group: { _id: "$personId", rec: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$rec" } },
      {
        $lookup: {
          from: "employee_people",
          localField: "personId",
          foreignField: "_id",
          as: "person",
        },
      },
      { $unwind: { path: "$person", preserveNullAndEmptyArrays: true } },
    ]);

    const bmiCounts = { normal: 0, risk: 0, unknown: 0 };
    const bpCounts = { normal: 0, low: 0, risk: 0, high: 0, unknown: 0 };
    const sugarCounts = { normal: 0, low: 0, risk: 0, high: 0, unknown: 0 };

    const people = [];

    for (const r of rows || []) {
      const p = r.person || {};
      const weightKg = toNum(r.weightKg);
      const heightCm = toNum(r.heightCm);
      const sys = toNum(r.sys);
      const dia = toNum(r.dia);
      const sugar = toNum(r.sugarMgDl);

      const bmi = computeBMI(weightKg, heightCm);
      const bmiCat = bmiCategoryThai(bmi);
      const bpCat = bpCategory(sys, dia);
      const sugarCat = sugarCategoryMgDl(sugar);

      if (bmiCat === "unknown") bmiCounts.unknown++;
      else if (bmiCat === "normal") bmiCounts.normal++;
      else bmiCounts.risk++;

      if (bpCat === "unknown") bpCounts.unknown++;
      else if (bpCat === "normal") bpCounts.normal++;
      else if (bpCat === "low") bpCounts.low++;
      else if (bpCat === "high") bpCounts.high++;
      else bpCounts.risk++;

      if (sugarCat === "unknown") sugarCounts.unknown++;
      else if (sugarCat === "normal") sugarCounts.normal++;
      else if (sugarCat === "low") sugarCounts.low++;
      else if (sugarCat === "high") sugarCounts.high++;
      else sugarCounts.risk++;

      const bmiRisk = bmiCat !== "unknown" && bmiCat !== "normal";
      const bpRisk = bpCat === "low" || bpCat === "risk" || bpCat === "high";
      const sugarRisk = sugarCat === "risk" || sugarCat === "high" || sugarCat === "low";

      const overallRisk = bmiRisk || bpRisk || sugarRisk;

      if (includePeople) {
        people.push({
          personId: String(p._id || r.personId),
          department: r.department || "",
          name: p.fullName || "",
          measuredAt: r.measuredAt || null,
          measurementDate: r.measurementDate || null,
          weightKg,
          heightCm,
          bmi,
          bmiCategory: bmiCat,
          bp: { systolic: sys, diastolic: dia, category: bpCat, risk: bpRisk },
          sugarMgDl: sugar,
          sugarCategory: sugarCat,
          overallRisk,
        });
      }
    }

    const bpRiskTotal = bpCounts.low + bpCounts.risk + bpCounts.high;
    const filteredPeople = riskOnly ? people.filter((x) => x.overallRisk) : people;

    return res.status(200).json({
      success: true,
      department: department || "all",
      departments,
      totals: { peopleCounted: rows.length },
      bmi: bmiCounts,
      bp: { ...bpCounts, riskTotal: bpRiskTotal },
      sugar: sugarCounts,
      people: includePeople ? filteredPeople : undefined,
    });
  } catch (e) {
    console.error("employee health dashboard-db error:", e);
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}

