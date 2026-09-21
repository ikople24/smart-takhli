// seed 24 ประเภทตั้งต้น "เฉพาะตอน collection ยังว่าง"
// อยู่ใน lib/ ไม่ใช่ pages/api/ เพราะมีผู้เรียกมากกว่าหนึ่งที่ (types/index.js และ import.js)
// — import ข้าม endpoint จะลาก handler + Clerk + auth helper ติดมาด้วยโดยไม่จำเป็น
import WasteType from "@/models/smart-waste/WasteType";
import { WASTE_TYPES_SEED } from "./wasteTypesSeed";

export async function ensureWasteTypesSeeded() {
  const count = await WasteType.countDocuments();
  if (count > 0) return { seeded: 0 };
  try {
    await WasteType.insertMany(
      WASTE_TYPES_SEED.map((type) => ({
        key: type.key,
        label: type.label,
        group: type.group,
        order: type.order,
        isCommon: Boolean(type.isCommon),
        isHighlighted: Boolean(type.isHighlighted),
        active: true,
      })),
      // ordered: false — สอง request แรกที่เข้ามาพร้อมกันจะเห็น count = 0 ทั้งคู่
      // แล้ว insert ชนกัน · unique index บน key กันข้อมูลซ้ำอยู่แล้ว ที่ต้องกันเพิ่ม
      // คือไม่ให้คนที่แพ้ race เจอ 500 ทั้งที่ระบบทำงานถูกต้อง
      { ordered: false }
    );
  } catch (error) {
    const writeErrors = error?.writeErrors || [];
    const allDuplicate =
      error?.code === 11000 ||
      (writeErrors.length > 0 &&
        writeErrors.every((item) => (item.err?.code ?? item.code) === 11000));
    if (!allDuplicate) throw error;
  }
  return { seeded: WASTE_TYPES_SEED.length };
}
