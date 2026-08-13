import type { NextApiRequest, NextApiResponse } from "next";
import type { SearchHit } from "@/types/garbage";
import { routes as routesCol, assignments as assignmentsCol } from "@/lib/garbage/db";
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
  const norm = (s: string) =>
    s.normalize("NFC").replace(/^(ถนน|ถ\.\s*|ซอย|ซ\.\s*|ชุมชน)\s*/u, "").replace(/\s/gu, "").toLowerCase();
  const needle = norm(q);
  // คำที่เป็นคำนำหน้าล้วน (ถนน/ถ./ซอย/ซ./ชุมชน) normalize แล้วเหลือค่าว่าง — จะ match ทุกอย่าง จึงตีเป็นคำค้นไม่พอ
  // ต้องใช้ข้อความคนละอันกับเกต 2 ตัวอักษรข้างบน ไม่งั้นคนพิมพ์ "ซอย" (3 ตัวอักษร) จะเห็นว่า "ต้องพิมพ์อย่างน้อย 2 ตัวอักษร"
  if (needle.length < 1) {
    return res
      .status(400)
      .json({ error: 'กรุณาพิมพ์ชื่อถนนหรือชุมชน ไม่ใช่เฉพาะคำนำหน้า เช่น พิมพ์ "มาลัย" แทน "ซอย"' });
  }

  try {
    const [rCol, aCol] = await Promise.all([routesCol(), assignmentsCol()]);
    // ใช้เที่ยงคืนกรุงเทพฯ ของวันนี้ ให้ตรงกับ convention effectiveTo แบบ inclusive ใน resolve.ts
    // (effectiveTo = เที่ยงคืนของวันสุดท้ายที่ยังใช้ผัง — เทียบด้วยเวลาปัจจุบันจะตัดผังของวันนี้ทิ้งผิด ๆ)
    const at = new Date(`${todayInBangkok()}T00:00:00+07:00`);
    const [allRoutes, rawAssignments] = await Promise.all([
      rCol.find({ active: true }).toArray(),
      aCol.find({
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }],
      }).sort({ effectiveFrom: -1, _id: -1 }).toArray(),
    ]);

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
        for (const s of route.stops) {
          if (!norm(s.name).includes(needle)) continue;
          // วันนั้นไม่ได้เก็บจุดนี้ → ไม่ใช่คำตอบของ "วันไหนรถมา" จึงไม่ต้องแสดง
          if (!timeBySeq.has(s.seq)) continue;
          hits.push({
            matchType: "stop", matchName: s.name,
            routeCode: route.code, routeName: route.name,
            weekday, weekdayName: WEEKDAY_TH[weekday],
            truckNumber: a.truckNumber,
            kind: a.kind, coverForRouteCode: a.coverForRouteCode,
            startMin: a.startMin, endMin: a.endMin,
            atMin: timeBySeq.get(s.seq) ?? null,
            served: true,
          });
        }
        for (const w of a.communityWindows) {
          for (const name of w.communityNames) {
            if (!norm(name).includes(needle)) continue;
            hits.push({
              matchType: "community", matchName: name,
              routeCode: route.code, routeName: route.name,
              weekday, weekdayName: WEEKDAY_TH[weekday],
              truckNumber: a.truckNumber,
              kind: a.kind, coverForRouteCode: a.coverForRouteCode,
              startMin: w.startMin, endMin: w.endMin, atMin: null,
              // หน้าต่างชุมชนมีอยู่ในงานของวันนั้น = วันนั้นเก็บ
              served: true,
            });
          }
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
