import { MongoClient, type Db } from "mongodb";

// native MongoDB client กลาง — แชร์ระหว่างโมดูลที่ไม่ใช้ mongoose (garbage, smart-water)
// ใช้ global cache เพื่อไม่ให้ hot reload ของ Next.js เปิด connection ใหม่ทุกครั้ง
const globalForMongo = globalThis as unknown as { _nativeMongo?: Promise<MongoClient> };

/** เชื่อมต่อแบบ lazy — ห้าม throw ตอน import เพราะไฟล์นี้ถูก import โดยเทสต์และ build */
export async function getDb(): Promise<Db> {
  if (!globalForMongo._nativeMongo) {
    // ใช้ MONGO_URI ตัวเดียวตามมาตรฐาน repo (ไม่มี fallback — กันสภาพแอปครึ่งใบที่ mongoose ล่มแต่โมดูลนี้รอด)
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("ต้องตั้งค่า MONGO_URI");
    // จำกัด pool ให้เล็กเพราะเป็น client ตัวที่สองข้าง ๆ mongoose — default 100/30s กว้างเกินไป
    globalForMongo._nativeMongo = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
      .connect()
      .catch((err) => {
        // ลบ cache เมื่อ connect ล้ม — ไม่งั้น promise ที่ reject ค้างตลอดชีวิต process = 500 ถาวร
        delete globalForMongo._nativeMongo;
        throw err;
      });
  }
  const client = await globalForMongo._nativeMongo;
  // ใช้ db ตาม URI เพื่อให้ตรงกับฝั่ง mongoose; MONGODB_DB มีไว้ override ตอนเทส/สคริปต์เท่านั้น
  return client.db(process.env.MONGODB_DB || undefined);
}
