import SchoolApplicant from "@/models/smart-school/SchoolApplicant";
import SchoolApplication from "@/models/smart-school/SchoolApplication";
import { normalizeCitizenId, isValidThaiCitizenId } from "@/lib/smart-school/citizenId";

// ตรวจคำขอเปลี่ยนเลขบัตร (ยังไม่เขียน DB) — คืน action ให้ผู้เรียก apply ทีหลัง
// raw === undefined → ไม่แตะ | null/"" → ล้าง | อื่น ๆ → validate checksum + เช็คซ้ำ
export async function resolveCitizenIdChange(applicantId, raw) {
  if (raw === undefined) return { ok: true, action: "none" };
  if (raw === null || String(raw).trim() === "") return { ok: true, action: "clear" };

  const citizenId = normalizeCitizenId(raw);
  if (!isValidThaiCitizenId(citizenId)) {
    return {
      ok: false,
      status: 400,
      message: "เลขบัตรประชาชนไม่ถูกต้อง (ต้องครบ 13 หลักและ checksum ผ่าน)",
    };
  }

  const dup = await SchoolApplicant.findOne({
    citizenId,
    _id: { $ne: applicantId },
  }).lean();
  if (dup) {
    const latestApp = await SchoolApplication.findOne({ applicantRef: dup._id })
      .sort({ surveyYear: -1 })
      .select("surveyYear")
      .lean();
    const dupName = `${dup.prefix || ""}${dup.name || ""}`;
    return {
      ok: false,
      status: 409,
      message: `เลขนี้ถูกผูกกับ ${dupName}${latestApp ? ` (ปีงบ ${latestApp.surveyYear})` : ""} แล้ว`,
      duplicateOf: { name: dupName, latestYear: latestApp?.surveyYear ?? null },
    };
  }
  return { ok: true, action: "set", citizenId };
}

// เขียนผลจาก resolveCitizenIdChange ลง DB — ล้างต้อง $unset (ห้ามเซ็ต ""/null เพราะ unique sparse)
// race ระหว่าง resolve→apply มี unique index กันชั้นสุดท้าย: ผู้เรียกต้อง catch err.code === 11000 → 409
export async function applyCitizenIdChange(applicantId, resolved) {
  if (resolved.action === "clear") {
    await SchoolApplicant.updateOne({ _id: applicantId }, { $unset: { citizenId: 1 } });
  } else if (resolved.action === "set") {
    await SchoolApplicant.updateOne({ _id: applicantId }, { $set: { citizenId: resolved.citizenId } });
  }
}
