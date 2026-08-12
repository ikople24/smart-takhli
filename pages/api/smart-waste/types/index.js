import dbConnect from "@/lib/dbConnect";
import WasteType from "@/models/smart-waste/WasteType";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import { isWasteGroupKey } from "@/lib/smart-waste/wasteGroups";
import { ensureWasteTypesSeeded } from "@/lib/smart-waste/seedTypes";
import { requireWasteAdmin } from "../_auth";

// แปลง label เป็น slug ใช้เป็น key เริ่มต้น — แอดมินแก้ได้ก่อนบันทึก
function slugify(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });

  try {
    await dbConnect();
    // seed ก่อนแยก method — ถ้าเรียกเฉพาะใน GET แล้วมี POST เข้ามาก่อนเป็นครั้งแรก
    // collection จะไม่ว่างอีกต่อไป แล้ว 24 ประเภทตั้งต้นจะไม่ถูก seed เลยตลอดกาล
    await ensureWasteTypesSeeded();

    return await routeRequest(req, res, auth);
  } catch (error) {
    console.error("[smart-waste/types]", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
}

async function routeRequest(req, res, auth) {
  if (req.method === "GET") {
    const includeInactive = req.query.includeInactive === "1";
    const filter = includeInactive ? {} : { active: true };
    // _id เป็นตัวตัดสินลำดับสำรอง — order ซ้ำกันได้ ถ้าไม่มี tiebreaker ลำดับคอลัมน์
    // ในไฟล์ export จะสลับไปมาระหว่างการเรียกแต่ละครั้ง
    const types = await WasteType.find(filter).sort({ order: 1, _id: 1 }).lean();

    // นับจำนวนวันที่อ้างถึงแต่ละประเภท — UI ใช้ตัดสินว่าลบได้หรือไม่
    // ($unwind ทั้ง collection ที่สเกลนี้ (~370 เอกสาร/ปี × ~10 entries) เป็นหลักมิลลิวินาที)
    const usage = await WasteDaily.aggregate([
      { $unwind: "$entries" },
      { $group: { _id: "$entries.typeKey", days: { $sum: 1 } } },
    ]);
    const usageByKey = new Map(usage.map((row) => [row._id, row.days]));

    return res.status(200).json({
      types: types.map((type) => ({
        id: String(type._id),
        key: type.key,
        label: type.label,
        group: type.group,
        order: type.order,
        isCommon: Boolean(type.isCommon),
        isHighlighted: Boolean(type.isHighlighted),
        active: type.active !== false,
        usedDays: usageByKey.get(type.key) || 0,
      })),
    });
  }

  if (req.method === "POST") {
    const { label, group, isCommon, isHighlighted } = req.body || {};
    const key = String(req.body?.key || slugify(label || ""));

    if (!label || !String(label).trim()) {
      return res.status(400).json({ message: "ต้องระบุชื่อประเภท" });
    }
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return res
        .status(400)
        .json({ message: "key ต้องเป็น a-z, 0-9 และ _ เท่านั้น และขึ้นต้นด้วยตัวอักษร" });
    }
    if (!isWasteGroupKey(group)) {
      return res.status(400).json({ message: `ไม่รู้จักกลุ่มขยะ "${group}"` });
    }
    if (await WasteType.exists({ key })) {
      return res.status(409).json({ message: `มีประเภทที่ใช้ key "${key}" อยู่แล้ว` });
    }

    // ต่อท้ายเสมอ — ไม่แทรกกลางเพื่อไม่ให้ลำดับคอลัมน์ใน export ของปีเก่าขยับ
    const last = await WasteType.findOne().sort({ order: -1 }).lean();
    const created = await WasteType.create({
      key,
      label: String(label).trim(),
      group,
      order: (last?.order || 0) + 1,
      isCommon: Boolean(isCommon),
      isHighlighted: Boolean(isHighlighted),
      active: true,
      createdByClerkId: auth.userId,
      createdByName: auth.name,
    });

    return res.status(201).json({ id: String(created._id), key: created.key });
  }

  return res.status(405).json({ message: "Method not allowed" });
}
