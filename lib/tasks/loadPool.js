// lib/tasks/loadPool.js
// โหลดเรื่องที่ยังไม่มีคนรับ (ไม่มี Assignment และยังไม่ปิด) พร้อม derived/ป้าย — I/O ใช้ร่วมกันโดย
// GET /api/tasks/pool และ POST /api/tasks/pool-alert · ค่าเฉพาะเจ้าหน้าที่ (ปุ่ม/action) เติมที่ endpoint
import dbConnect from "@/lib/dbConnect";
import Assignment from "@/models/Assignment";
import Complaint from "@/models/Complaint";
import { COMPLAINT_STATUS } from "./status";
import { deriveUnclaimed } from "./derived";
import { defaultDepartmentForCategory, normalizeDepartment } from "./departments";
import { dangerHint, possibleAgencyFor } from "./pool";
import { agingPill, contextBadges } from "./badges";
import { summarizeText, toDate, DAY_MS } from "./format";

/** "ร้องซ้ำ N ครั้ง" = เรื่องจากเบอร์เดียวกันภายในกี่วัน */
const REPEAT_WINDOW_DAYS = 180;
const collator = new Intl.Collator("th");

/**
 * @param {{ settings: object, now?: Date, days?: number | null }} p  days = null → ไม่จำกัดช่วงเวลา
 */
export async function loadPoolItems({ settings, now = new Date(), days = 30 }) {
  await dbConnect();
  const assignedIds = (await Assignment.distinct("complaintId")).filter(Boolean);
  const base = { _id: { $nin: assignedIds }, status: { $ne: COMPLAINT_STATUS.DONE } };
  const since = days ? new Date(now.getTime() - days * DAY_MS) : null;
  const query = since ? { ...base, createdAt: { $gte: since } } : base;

  const rows = await Complaint.find(query)
    .select("complaintId detail category community problems images location createdAt department phone")
    .sort({ createdAt: 1 })
    .lean();
  const olderOutsideWindow = since ? await Complaint.countDocuments({ ...base, createdAt: { $lt: since } }) : 0;

  // ร้องซ้ำ: เรื่องจากเบอร์เดียวกัน + ประเภทเดียวกัน + ชุมชนเดียวกัน ในช่วง REPEAT_WINDOW_DAYS
  // (นับแค่เบอร์อย่างเดียวไม่ได้ — เบอร์เจ้าหน้าที่ที่คีย์แทนประชาชนหลายเรื่องจะกลายเป็น "ร้องซ้ำ 17 ครั้ง")
  // เบอร์โทรไม่หลุดออกจากฟังก์ชันนี้ (คืนแค่จำนวน)
  const repeatKey = (r) => `${String(r.phone ?? "").trim()}|${String(r.category ?? "").trim()}|${String(r.community ?? "").trim()}`;
  const phones = [...new Set(rows.map((r) => String(r.phone ?? "").trim()).filter(Boolean))];
  const phoneCounts = new Map();
  if (phones.length) {
    const agg = await Complaint.aggregate([
      { $match: { phone: { $in: phones }, createdAt: { $gte: new Date(now.getTime() - REPEAT_WINDOW_DAYS * DAY_MS) } } },
      { $group: { _id: { phone: "$phone", category: "$category", community: "$community" }, n: { $sum: 1 } } },
    ]);
    for (const a of agg) phoneCounts.set(repeatKey(a._id), a.n);
  }

  const items = rows.map((c) => {
    const derived = deriveUnclaimed({ complaint: c, settings, now });
    const manual = normalizeDepartment(c.department);
    const department = manual ?? defaultDepartmentForCategory(c.category);
    const text = [c.detail, ...(Array.isArray(c.problems) ? c.problems : [])].filter(Boolean).join(" ");
    const isDangerous = dangerHint(text);
    const possibleAgency = possibleAgencyFor(c.category, text);
    const imageCount = Array.isArray(c.images) ? c.images.length : 0;
    const hasLocation = typeof c.location?.lat === "number" && typeof c.location?.lng === "number";
    const repeatCount = String(c.phone ?? "").trim() ? (phoneCounts.get(repeatKey(c)) ?? 1) : 1;
    return {
      ...derived,
      _id: String(c._id),
      code: c.complaintId || null,
      title: summarizeText(c.detail, 90) || c.category || "(ไม่ระบุรายละเอียด)",
      category: c.category ?? "",
      community: c.community ?? "",
      department,
      departmentSource: manual ? "manual" : department ? "category" : null,
      createdAt: toDate(c.createdAt)?.toISOString() ?? "",
      imageCount,
      hasLocation,
      /** พิกัดสำหรับ "ใกล้ฉัน"/ปุ่มแผนที่บนมือถือ (endpoint เจ้าหน้าที่เท่านั้น) */
      location: hasLocation ? { lat: c.location.lat, lng: c.location.lng } : null,
      repeatCount,
      possibleAgency,
      isDangerous,
      agingPill: agingPill(derived),
      contextBadges: contextBadges({ isDangerous, imageCount, hasLocation, possibleAgency, repeatCount }),
    };
  });

  const communities = [...new Set(items.map((i) => i.community).filter(Boolean))].sort(collator.compare);
  return { items, olderOutsideWindow, communities };
}

/** จำนวนงานเปิดที่แต่ละเจ้าหน้าที่ถืออยู่ — ใช้กระจายงานตอนมอบหมาย */
export async function loadWorkload() {
  await dbConnect();
  const agg = await Assignment.aggregate([
    { $match: { completedAt: { $exists: false } } },
    { $group: { _id: "$userId", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(agg.map((a) => [String(a._id), a.n]));
}
