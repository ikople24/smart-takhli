import type { NextApiRequest, NextApiResponse } from "next";
import type { SearchHit } from "@/types/garbage";
import { normalizePlaceName } from "@/lib/garbage/community";
import { routes as routesCol, assignments as assignmentsCol, trucks as trucksCol } from "@/lib/garbage/db";
import { WEEKDAY_TH } from "@/lib/garbage/labels";
import { pickLatestVersions } from "@/lib/garbage/resolve";
import { todayInBangkok } from "@/lib/garbage/time";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "รองรับเฉพาะ GET" });
  }

  const raw = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const q = (raw ?? "").trim();
  if (q.length < 2) return res.status(400).json({ error: "ต้องพิมพ์อย่างน้อย 2 ตัวอักษร" });

  // ตัดคำนำหน้าและช่องว่างออกเพื่อให้ "ซ.มาลัย" ก็เจอ "มาลัย" และกลับกัน
  // กฎอยู่ที่ lib/garbage/community.ts ที่เดียว — สคริปต์จับคู่ถนนใช้กฎเดียวกันเป๊ะ
  const needle = normalizePlaceName(q);
  // คำที่เป็นคำนำหน้าล้วน (ถนน/ถ./ซอย/ซ./ชุมชน) normalize แล้วเหลือค่าว่าง — จะ match ทุกอย่าง จึงตีเป็นคำค้นไม่พอ
  // ต้องใช้ข้อความคนละอันกับเกต 2 ตัวอักษรข้างบน ไม่งั้นคนพิมพ์ "ซอย" (3 ตัวอักษร) จะเห็นว่า "ต้องพิมพ์อย่างน้อย 2 ตัวอักษร"
  if (needle.length < 1) {
    return res
      .status(400)
      .json({ error: 'กรุณาพิมพ์ชื่อถนนหรือชุมชน ไม่ใช่เฉพาะคำนำหน้า เช่น พิมพ์ "มาลัย" แทน "ซอย"' });
  }

  try {
    const [rCol, aCol, tCol] = await Promise.all([routesCol(), assignmentsCol(), trucksCol()]);
    // ใช้เที่ยงคืนกรุงเทพฯ ของวันนี้ ให้ตรงกับ convention effectiveTo แบบ inclusive ใน resolve.ts
    // (effectiveTo = เที่ยงคืนของวันสุดท้ายที่ยังใช้ผัง — เทียบด้วยเวลาปัจจุบันจะตัดผังของวันนี้ทิ้งผิด ๆ)
    const at = new Date(`${todayInBangkok()}T00:00:00+07:00`);
    const [allRoutes, rawAssignments, allTrucks] = await Promise.all([
      rCol.find({ active: true }).toArray(),
      aCol.find({
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }],
      }).sort({ effectiveFrom: -1, _id: -1 }).toArray(),
      // เลือกเฉพาะ number/color — เอกสาร Truck มี driverName ซึ่ง **ห้ามหลุดออก API สาธารณะ**
      tCol.find({}, { projection: { _id: 0, number: 1, color: 1 } }).toArray(),
    ]);
    // สีรถ default เป็น "green" เหมือน resolve.ts — คันที่ยังไม่มีในทะเบียนจะได้ไม่ทำให้ hit หาย
    const colorByTruck = new Map(allTrucks.map((t) => [t.number, t.color]));

    // จัดกลุ่ม assignment ตามวัน แล้วเลือกเวอร์ชันล่าสุดของแต่ละวัน
    const byWeekday = new Map<number, typeof rawAssignments>();
    for (const a of rawAssignments) {
      const list = byWeekday.get(a.weekday) ?? [];
      list.push(a);
      byWeekday.set(a.weekday, list);
    }

    const hits: SearchHit[] = [];
    for (const [weekday, list] of byWeekday) {
      for (const a of pickLatestVersions(list)) {
        if (!a.routeCode) continue;
        const route = allRoutes.find((r) => r.code === a.routeCode);
        if (!route) continue;

        const timeBySeq = new Map(a.stopTimes.map((s) => [s.seq, s.atMin]));
        // จุดที่ตรงด้วย "ชื่อจุด" ไปแล้วในงานนี้ — กันไม่ให้ลูปชุมชนข้างล่างสร้างแถวซ้ำของจุดเดียวกัน
        // (เช่นค้น "มาลัย" จุด "ถนนมาลัย" ในชุมชนมาลัย จะเข้าเงื่อนไขทั้งสองลูป)
        const matchedSeqs = new Set<number>();
        for (const s of route.stops) {
          if (!normalizePlaceName(s.name).includes(needle)) continue;
          // วันนั้นไม่ได้เก็บจุดนี้ → ไม่ใช่คำตอบของ "วันไหนรถมา" จึงไม่ต้องแสดง
          if (!timeBySeq.has(s.seq)) continue;
          hits.push({
            matchType: "stop", matchName: s.name, stopName: s.name, seq: s.seq,
            routeCode: route.code, routeName: route.name,
            weekday, weekdayName: WEEKDAY_TH[weekday],
            truckNumber: a.truckNumber,
            truckColor: colorByTruck.get(a.truckNumber) ?? "green",
            kind: a.kind, coverForRouteCode: a.coverForRouteCode,
            startMin: a.startMin, endMin: a.endMin,
            atMin: timeBySeq.get(s.seq) ?? null,
            served: true,
            communityName: s.communityName ?? null,
          });
          matchedSeqs.add(s.seq);
        }
        // ค้นด้วยชื่อชุมชน — อิงชุมชนของ "จุดเก็บ" (RouteStop.communityName) ไม่ใช่ a.communityWindows
        // ที่เลิกใช้แล้วและว่างทั้งหมดในข้อมูลจริง · hit จึงเป็นระดับจุด มี atMin จริงของจุดนั้น
        for (const s of route.stops) {
          if (!s.communityName) continue;
          if (!normalizePlaceName(s.communityName).includes(needle)) continue;
          if (matchedSeqs.has(s.seq)) continue; // แสดงเป็นผลแบบ "ชื่อจุด" ไปแล้ว
          if (!timeBySeq.has(s.seq)) continue; // วันนั้นไม่ได้เก็บจุดนี้
          hits.push({
            matchType: "community", matchName: s.communityName, stopName: s.name, seq: s.seq,
            routeCode: route.code, routeName: route.name,
            weekday, weekdayName: WEEKDAY_TH[weekday],
            truckNumber: a.truckNumber,
            truckColor: colorByTruck.get(a.truckNumber) ?? "green",
            kind: a.kind, coverForRouteCode: a.coverForRouteCode,
            startMin: a.startMin, endMin: a.endMin,
            atMin: timeBySeq.get(s.seq) ?? null,
            served: true,
            communityName: s.communityName,
          });
        }
      }
    }

    hits.sort((x, y) => x.weekday - y.weekday || (x.startMin ?? 0) - (y.startMin ?? 0));

    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ query: q, count: hits.length, hits: hits.slice(0, 100) });
  } catch (err) {
    console.error("[garbage/search]", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหา" });
  }
}
