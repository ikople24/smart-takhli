// ประวัติสุขภาพทุกปีของผู้เรียน 1 คน สำหรับ "พิมพ์สรุปสำหรับแพทย์" (แอดมิน) — ทุกครั้งที่เปิดจะลงบันทึกใน elderly_access_logs
import { requireElderlySchoolAdmin } from "./_auth";
import dbConnect from "@/lib/dbConnect";
import { ObjectId } from "mongodb";
import ElderlyPerson from "@/models/elderly-school/ElderlyPerson";
import ElderlyVisit from "@/models/elderly-school/ElderlyVisit";
import ElderlySchoolSchedule from "@/models/elderly-school/ElderlySchoolSchedule";
import ElderlyMentalHealthAssessment from "@/models/elderly-school/ElderlyMentalHealthAssessment";
import ElderlyAccessLog from "@/models/elderly-school/ElderlyAccessLog";
import { buildHealthHistory, yearlyBpSummary } from "@/lib/elderly-school/history";

export default async function handler(req, res) {
  const auth = await requireElderlySchoolAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, message: auth.message });
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed" });

  const personId = String(req.query?.personId || "");
  if (!ObjectId.isValid(personId)) return res.status(400).json({ success: false, message: "Invalid personId" });

  try {
    await dbConnect();
    const pid = new ObjectId(personId);
    const person = await ElderlyPerson.findById(pid).lean();
    if (!person) return res.status(404).json({ success: false, message: "ไม่พบผู้เรียน" });

    const [visits, assessments] = await Promise.all([
      ElderlyVisit.find({ personId: pid }).lean(),
      ElderlyMentalHealthAssessment.find({ personId: pid }, { yearBE: 1, assessmentDate: 1, "q2.positive": 1 })
        .sort({ assessmentDate: -1 })
        .lean(),
    ]);
    const years = [...new Set(visits.map((v) => v.yearBE))];
    const schedules = years.length
      ? await ElderlySchoolSchedule.find({ yearBE: { $in: years } }, { yearBE: 1, "sessions.visitNo": 1, "sessions.dateISO": 1 }).lean()
      : [];
    const history = buildHealthHistory({ person, visits, schedules });

    // 2Q ล่าสุดของแต่ละปี (แสดงแค่ บวก/ปกติ + วันที่)
    const mhByYear = {};
    for (const a of assessments) {
      if (!mhByYear[a.yearBE]) mhByYear[a.yearBE] = { date: a.assessmentDate, positive: a.q2?.positive === true };
    }

    await ElderlyAccessLog.create({ personId: pid, action: "doctor-summary", userId: auth.userId });

    const digits = String(person.citizenId || "").replace(/\D/g, "");
    return res.status(200).json({
      success: true,
      person: {
        fullName: person.fullName,
        citizenLast4: digits.slice(-4),
        ageYears: person.ageYears ?? null,
        birthDateText: person.birthDateText ?? null,
        bloodType: person.bloodType ?? null,
        phone: person.phone ?? null,
        address: person.address ?? null,
        heightCm: person.heightCm ?? null,
      },
      history,
      bpByYear: yearlyBpSummary(history),
      mentalHealthByYear: mhByYear,
    });
  } catch (error) {
    console.error("elderly history error:", error);
    return res.status(500).json({ success: false, message: "โหลดประวัติไม่สำเร็จ" });
  }
}
