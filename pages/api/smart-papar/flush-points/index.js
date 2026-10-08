// /api/smart-papar/flush-points — ทะเบียนหัวโบล์
// GET  : หัวที่ใช้งานอยู่ + วันที่โบล่าสุด · ใช้ได้ 2 ทาง: เครื่องภาคสนามที่ใส่รหัสแล้ว (cookie) หรือแอดมินที่มีสิทธิ์หน้าคุณภาพน้ำ
//        ?scope=admin (แอดมินเท่านั้น) → รวมหัวที่ปิดใช้งาน + ข้อมูลผู้แก้ล่าสุด/ประวัติ สำหรับหน้าจัดการทะเบียน
// POST : เพิ่มหัวโบล์ใหม่ (แอดมินเท่านั้น)
// ไม่เปิดสาธารณะ — เป็นตำแหน่งอุปกรณ์ประปา
import dbConnect from "@/lib/dbConnect";
import FlushPoint from "@/models/smart-papar/FlushPoint";
import FlushingLog from "@/models/smart-papar/FlushingLog";
import { readFieldSession } from "@/lib/smart-papar/fieldAuth";
import { validateFlushPointInput } from "@/lib/smart-papar/flushPointEdit";
import { requireSmartPaparAdmin } from "../water-quality/_auth";

const BASE_FIELDS = {
  code: 1,
  kind: 1,
  roadName: 1,
  name: 1,
  location: 1,
  photoUrl: 1,
  "legacy.surveyedAt": 1,
  "legacy.surveyedBy": 1,
};
const ADMIN_FIELDS = {
  ...BASE_FIELDS,
  typeCode: 1,
  active: 1,
  updatedAt: 1,
  updatedByName: 1,
  history: { $slice: -10 },
};

async function adminAuth(req, res) {
  const auth = await requireSmartPaparAdmin(req).catch(() => null);
  if (!auth) {
    res.status(500).json({ success: false, message: "ตรวจสอบสิทธิ์ไม่สำเร็จ" });
    return null;
  }
  if (!auth.ok) {
    res.status(auth.status).json({ success: false, message: auth.message });
    return null;
  }
  return auth;
}

export default async function handler(req, res) {
  if (req.method === "POST") return create(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const adminScope = req.query.scope === "admin";
  if (adminScope || !readFieldSession(req)) {
    if (!(await adminAuth(req, res))) return;
  }

  try {
    await dbConnect();
    const [points, last] = await Promise.all([
      FlushPoint.find(adminScope ? {} : { active: true })
        .select(adminScope ? ADMIN_FIELDS : BASE_FIELDS)
        .sort({ code: 1 })
        .lean(),
      FlushingLog.aggregate([
        { $match: { deletedAt: null, flushPointId: { $type: "objectId" } } },
        { $group: { _id: "$flushPointId", lastFlushedAt: { $max: "$flushedAt" }, count: { $sum: 1 } } },
      ]),
    ]);
    const byId = new Map(last.map((l) => [String(l._id), l]));
    // หน้าจัดการทะเบียนต้องเห็นค่าล่าสุดทันทีหลังแก้ — ห้ามแคช
    res.setHeader("Cache-Control", adminScope ? "no-store" : "private, max-age=60");
    return res.status(200).json({
      success: true,
      data: points.map((p) => {
        const l = byId.get(String(p._id));
        return { ...p, lastFlushedAt: l?.lastFlushedAt || null, flushCount: l?.count || 0 };
      }),
    });
  } catch (error) {
    console.error("smart-papar flush-points GET error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function create(req, res) {
  const auth = await adminAuth(req, res);
  if (!auth) return;

  const v = validateFlushPointInput(req.body, { isCreate: true });
  if (!v.ok) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors: v.errors });
  }

  try {
    await dbConnect();
    if (await FlushPoint.exists({ code: v.value.code })) {
      return res
        .status(409)
        .json({ success: false, message: "รหัสนี้มีอยู่แล้ว", errors: { code: "รหัสนี้มีอยู่แล้ว" } });
    }
    const doc = await FlushPoint.create({
      ...v.value,
      createdByName: auth.name || "",
      updatedByClerkId: auth.userId,
      updatedByName: auth.name || "",
      history: [{ at: new Date(), byClerkId: auth.userId, byName: auth.name || "", action: "create", changes: [] }],
    });
    return res.status(201).json({ success: true, data: doc.toObject() });
  } catch (error) {
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "รหัสนี้มีอยู่แล้ว", errors: { code: "รหัสนี้มีอยู่แล้ว" } });
    }
    console.error("smart-papar flush-points POST error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
