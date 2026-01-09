import dbConnect from "@/lib/dbConnect";
import ElderlyPerson from "@/models/ElderlyPerson";
import ElderlyVisit from "@/models/ElderlyVisit";
import ElderlySchoolSchedule from "@/models/ElderlySchoolSchedule";
import { ObjectId } from "mongodb";

function getBangkokISODate() {
  // YYYY-MM-DD in Asia/Bangkok
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCurrentYearBE() {
  const y = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" })
      .formatToParts(new Date())
      .find((p) => p.type === "year")?.value
  );
  return (Number.isFinite(y) ? y : new Date().getFullYear()) + 543;
}

function last4(s) {
  const digits = String(s || "").replace(/\D/g, "");
  return digits.slice(-4);
}

function parseBP(bpText) {
  const m = String(bpText || "")
    .trim()
    .match(/^(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return { sys: null, dia: null };
  const sys = Number(m[1]);
  const dia = Number(m[2]);
  return {
    sys: Number.isFinite(sys) ? sys : null,
    dia: Number.isFinite(dia) ? dia : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { action } = req.body || {};
    const { personId, yearBE, citizenIdLast4 } = req.body || {};

    if (!personId) return res.status(400).json({ success: false, message: "Missing personId" });
    const year = Number(yearBE) || getCurrentYearBE();
    if (!Number.isFinite(year) || year < 2500 || year > 2700) {
      return res.status(400).json({ success: false, message: "Invalid yearBE" });
    }

    const providedLast4 = String(citizenIdLast4 || "").trim();
    if (!/^\d{4}$/.test(providedLast4)) {
      return res.status(400).json({ success: false, message: "กรุณากรอกเลขบัตร 4 ตัวท้ายให้ถูกต้อง" });
    }

    await dbConnect();

    const person = await ElderlyPerson.findOne({ _id: new ObjectId(personId) }).lean();
    if (!person) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนักเรียน" });

    const expected = last4(person.citizenId);
    if (expected !== providedLast4) {
      return res.status(403).json({ success: false, message: "เลขบัตร 4 ตัวท้ายไม่ถูกต้อง" });
    }

    const today = getBangkokISODate();

    // Resolve today's session -> visitNo
    const schedule = await ElderlySchoolSchedule.findOne({ yearBE: year }).lean();
    const sessions = Array.isArray(schedule?.sessions) ? schedule.sessions : [];
    const todaySession = sessions.find((s) => String(s?.dateISO) === today) || null;
    const scheduledVisitNo = todaySession?.visitNo ? Number(todaySession.visitNo) : null;

    // Has already checked in today (per scheduled date)
    const existingToday = await ElderlyVisit.findOne({
      personId: new ObjectId(personId),
      yearBE: year,
      checkinDate: today,
    }).lean();

    // Also prevent double-submit for same visitNo
    const existingVisitNo =
      scheduledVisitNo !== null
        ? await ElderlyVisit.findOne({
            personId: new ObjectId(personId),
            yearBE: year,
            visitNo: scheduledVisitNo,
          }).lean()
        : null;

    if (action === "verify") {
      if (!scheduledVisitNo) {
        return res.status(200).json({
          success: true,
          yearBE: year,
          today,
          person: { fullName: person.fullName },
          canSubmitToday: false,
          alreadySubmittedToday: Boolean(existingToday),
          scheduledVisitNo: null,
          message: "วันนี้ไม่ใช่วันเรียนที่กำหนดไว้ (ยังไม่เปิดให้บันทึก)",
        });
      }

      if (existingToday || existingVisitNo) {
        return res.status(200).json({
          success: true,
          yearBE: year,
          today,
          person: { fullName: person.fullName },
          canSubmitToday: false,
          alreadySubmittedToday: Boolean(existingToday || existingVisitNo),
          scheduledVisitNo,
          message: `วันนี้มีการบันทึกไปแล้วสำหรับครั้งที่ ${scheduledVisitNo} (1 วันบันทึกได้ 1 ครั้ง)`,
        });
      }

      return res.status(200).json({
        success: true,
        yearBE: year,
        today,
        person: { fullName: person.fullName },
        canSubmitToday: true,
        alreadySubmittedToday: false,
        scheduledVisitNo,
        message: "ยืนยันตัวตนสำเร็จ",
      });
    }

    if (action !== "submit") {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    if (!scheduledVisitNo) {
      return res.status(400).json({ success: false, message: "วันนี้ไม่ใช่วันเรียนที่กำหนดไว้ (ยังไม่เปิดให้บันทึก)" });
    }

    if (existingToday || existingVisitNo) {
      return res
        .status(409)
        .json({ success: false, message: `วันนี้บันทึกได้แล้วสำหรับครั้งที่ ${scheduledVisitNo} (ไม่สามารถกรอกซ้ำ)` });
    }

    const { weightKg, waistCm, pulseBpm, bp1, bp2 } = req.body || {};
    const w = weightKg === "" || weightKg === null || weightKg === undefined ? null : Number(weightKg);
    const waist = waistCm === "" || waistCm === null || waistCm === undefined ? null : Number(waistCm);
    const pulse = pulseBpm === "" || pulseBpm === null || pulseBpm === undefined ? null : Number(pulseBpm);
    const b1 = parseBP(bp1);
    const b2 = parseBP(bp2);

    const hasAny =
      Number.isFinite(w) ||
      Number.isFinite(waist) ||
      Number.isFinite(pulse) ||
      (b1.sys !== null && b1.dia !== null) ||
      (b2.sys !== null && b2.dia !== null);

    if (!hasAny) {
      return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลอย่างน้อย 1 ช่อง" });
    }

    const visit = await ElderlyVisit.create({
      personId: new ObjectId(personId),
      yearBE: year,
      visitNo: scheduledVisitNo,
      checkinDate: today,
      measuredAt: new Date(),
      heightCm: person.heightCm ?? null,
      weightKg: Number.isFinite(w) ? w : null,
      waistCm: Number.isFinite(waist) ? waist : null,
      pulseBpm: Number.isFinite(pulse) ? pulse : null,
      bp1Sys: b1.sys,
      bp1Dia: b1.dia,
      bp2Sys: b2.sys,
      bp2Dia: b2.dia,
      source: "public-checkin",
    });

    return res.status(200).json({
      success: true,
      message: "บันทึกสำเร็จ",
      yearBE: year,
      today,
      visitNo: visit.visitNo,
    });
  } catch (error) {
    // Handle unique index race (same day)
    if (String(error?.message || "").includes("E11000")) {
      return res.status(409).json({ success: false, message: "วันนี้บันทึกได้แล้ว 1 ครั้ง (ไม่สามารถกรอกซ้ำ)" });
    }
    console.error("checkin error:", error);
    return res.status(500).json({ success: false, message: error?.message || "Server error" });
  }
}


