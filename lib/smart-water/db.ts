import type { Collection, Document } from "mongodb";
import { getDb } from "@/lib/mongoNative";

// ชื่อ collection คงที่ — ห้ามเปลี่ยนหลังมีข้อมูล production
export const PIPES_COLLECTION = "water_pipes";
export const NODES_COLLECTION = "water_nodes";

export async function pipes(): Promise<Collection<Document>> {
  return (await getDb()).collection(PIPES_COLLECTION);
}

export async function nodes(): Promise<Collection<Document>> {
  return (await getDb()).collection(NODES_COLLECTION);
}

/** สร้าง index ทั้งหมด — เรียกจาก seed script ปลอดภัยที่จะเรียกซ้ำ (แบบเดียวกับ garbage) */
export async function ensureWaterIndexes(): Promise<void> {
  const db = await getDb();

  await db.collection(PIPES_COLLECTION).createIndexes([
    { key: { geometry: "2dsphere" }, name: "geo" },
    { key: { material: 1, diameterMm: 1 }, name: "by_material" },
    { key: { roadName: 1 }, name: "by_road" },
    { key: { status: 1, deletedAt: 1 }, name: "by_status" },
    { key: { code: 1 }, name: "by_code" },
  ]);

  await db.collection(NODES_COLLECTION).createIndexes([
    { key: { geometry: "2dsphere" }, name: "geo" },
    { key: { type: 1, deletedAt: 1 }, name: "by_type" },
    { key: { onPipeId: 1 }, name: "by_pipe" },
    {
      key: { hydrantNo: 1 },
      name: "uniq_hydrant_no",
      unique: true,
      partialFilterExpression: { hydrantNo: { $type: "string" } },
    },
  ]);
}
