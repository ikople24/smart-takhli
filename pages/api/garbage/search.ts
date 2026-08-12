import type { NextApiRequest, NextApiResponse } from "next";
import { routes as routesCol, assignments as assignmentsCol } from "@/lib/garbage/db";
import { pickLatestVersions } from "@/lib/garbage/resolve";

const WEEKDAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

interface SearchHit {
  matchType: "stop" | "community";
  matchName: string;
  routeCode: string;
  routeName: string;
  weekday: number;
  weekdayName: string;
  truckNumber: number;
  startMin: number | null;
  endMin: number | null;
  atMin: number | null;
}

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

  try {
    const [rCol, aCol] = await Promise.all([routesCol(), assignmentsCol()]);
    const now = new Date();
    const [allRoutes, rawAssignments] = await Promise.all([
      rCol.find({ active: true }).toArray(),
      aCol.find({
        effectiveFrom: { $lte: now },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
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
          hits.push({
            matchType: "stop", matchName: s.name,
            routeCode: route.code, routeName: route.name,
            weekday, weekdayName: WEEKDAY_TH[weekday],
            truckNumber: a.truckNumber,
            startMin: a.startMin, endMin: a.endMin,
            atMin: timeBySeq.get(s.seq) ?? null,
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
              startMin: w.startMin, endMin: w.endMin, atMin: null,
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
