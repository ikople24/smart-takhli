// lib/flood-relief/locate.ts (server-only)
// พิกัด → ชุมชน + โซน — ใช้ทั้งตอนสร้างคำขอและ reverse-geocode ให้ได้คำตอบเดียวกันเสมอ
//
// ชุมชน: basemap geojsonfeatures (22 polygon ของแอปพี่น้อง appId app_b) — **อ่านอย่างเดียว**
//   ใช้ native driver (lib/mongoNative) ไม่ใช่ models/GeoJSONFeature เพราะ Mongoose model นั้นประกาศ index
//   ไว้ และ autoIndex อาจสั่งสร้าง index ลง collection ของแอปอื่น · 22 polygon สแกนได้ไม่ต้องมี geo index
//   ห้ามเดาชุมชนจากชื่อซอย ("ซ.มาลัย 2" อยู่ชุมชนรจนา)
// โซน: flood_zones ที่ active — ซ้อนหลายโซนเอาระดับสูงสุด (pickZone)

import type { Types } from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { getDb } from "@/lib/mongoNative";
import FloodZone from "@/models/flood-relief/FloodZone";
import { pickCommunity, toGeoPoint, type LatLng } from "./geo";
import { pickZone } from "./zones";

export async function findCommunityName(point: LatLng): Promise<string | null> {
  const db = await getDb();
  const hits = await db
    .collection("geojsonfeatures")
    .find({ active: true, geometry: { $geoIntersects: { $geometry: toGeoPoint(point) } } })
    .project<{ name: string }>({ name: 1, _id: 0 })
    .toArray();
  return pickCommunity(hits.filter((h) => typeof h.name === "string" && h.name));
}

export type ZoneHit = { _id: Types.ObjectId; name: string; level: string };

export async function findZone(point: LatLng): Promise<ZoneHit | null> {
  await dbConnect();
  const hits = (await FloodZone.find({
    active: true,
    geometry: { $geoIntersects: { $geometry: toGeoPoint(point) } },
  })
    .select({ name: 1, level: 1 })
    .lean()) as unknown as ZoneHit[];
  return pickZone(hits);
}

/** หาทั้งสองอย่างพร้อมกัน · ฝั่งไหนล้มให้เป็น null — คำขอช่วยเหลือต้องบันทึกได้แม้ basemap อ่านไม่ได้ */
export async function locate(point: LatLng) {
  const [community, zone] = await Promise.all([
    findCommunityName(point).catch((err) => {
      console.error("[flood-relief] community lookup failed:", err);
      return null;
    }),
    findZone(point).catch((err) => {
      console.error("[flood-relief] zone lookup failed:", err);
      return null;
    }),
  ]);
  return { communityName: community, zone };
}
