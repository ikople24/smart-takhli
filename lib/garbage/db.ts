import { MongoClient, type Collection, type Db } from "mongodb";
import type { Truck, Route, Community, Assignment } from "@/types/garbage";

// ใช้ global cache เพื่อไม่ให้ hot reload ของ Next.js เปิด connection ใหม่ทุกครั้ง
const globalForMongo = globalThis as unknown as { _garbageMongo?: Promise<MongoClient> };

/** เชื่อมต่อแบบ lazy — ห้าม throw ตอน import เพราะไฟล์นี้ถูก import โดยเทสต์และ build */
export async function getDb(): Promise<Db> {
  if (!globalForMongo._garbageMongo) {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error("ต้องตั้งค่า MONGO_URI");
    globalForMongo._garbageMongo = new MongoClient(uri).connect();
  }
  const client = await globalForMongo._garbageMongo;
  // ใช้ database ตามที่ระบุใน URI (db_takhli) — override ได้ด้วย MONGODB_DB
  return client.db(process.env.MONGODB_DB || undefined);
}

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
  await db.collection("garbage_assignments").createIndex({ truckNumber: 1, weekday: 1, shiftNo: 1 });
  await db.collection("garbage_assignments").createIndex({ routeCode: 1 });
}
