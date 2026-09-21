import type { Collection } from "mongodb";
import { getDb } from "@/lib/mongoNative";
import type { Truck, Route, Community, Assignment, GarbageSettings } from "@/types/garbage";

// getDb ย้ายไปเป็นไฟล์กลาง lib/mongoNative.ts (แชร์กับโมดูล smart-water)
// re-export เพื่อไม่ให้ import เดิมทั้ง repo ต้องแก้
export { getDb };

export async function trucks(): Promise<Collection<Truck>> {
  return (await getDb()).collection<Truck>("garbage_trucks");
}

export async function routes(): Promise<Collection<Route>> {
  return (await getDb()).collection<Route>("garbage_routes");
}

export async function communities(): Promise<Collection<Community>> {
  return (await getDb()).collection<Community>("garbage_communities");
}

export async function assignments(): Promise<Collection<Assignment>> {
  return (await getDb()).collection<Assignment>("garbage_assignments");
}

export async function settings(): Promise<Collection<GarbageSettings>> {
  return (await getDb()).collection<GarbageSettings>("garbage_settings");
}

/** สร้าง index ทั้งหมด — เรียกจาก seed script ปลอดภัยที่จะเรียกซ้ำ */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection("garbage_trucks").createIndex({ number: 1 }, { unique: true });
  await db.collection("garbage_routes").createIndex({ code: 1 }, { unique: true });
  await db.collection("garbage_routes").createIndex({ "stops.name": 1 });
  await db.collection("garbage_communities").createIndex({ name: 1 }, { unique: true });
  // ตั้ง default_language: "none" เพราะ MongoDB ไม่มี stemmer ภาษาไทย
  await db
    .collection("garbage_communities")
    .createIndex({ name: "text", aliases: "text" }, { default_language: "none" });
  await db.collection("garbage_assignments").createIndex({ weekday: 1, effectiveFrom: -1 });
  // คีย์ธรรมชาติของงานมอบหมาย — unique เพื่อกันเพิ่มซ้ำจากหน้าแอดมิน (M6)
  await db
    .collection("garbage_assignments")
    .createIndex({ weekday: 1, truckNumber: 1, shiftNo: 1 }, { unique: true, name: "natural_key" });
  await db.collection("garbage_assignments").createIndex({ routeCode: 1 });
  await db.collection("garbage_settings").createIndex({ key: 1 }, { unique: true });
}
