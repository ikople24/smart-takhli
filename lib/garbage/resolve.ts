import type {
  Assignment, Route, Truck, ResolvedAssignment, ResolvedDaySchedule, Weekday,
} from "@/types/garbage";
import { assignments as assignmentsCol, routes as routesCol, trucks as trucksCol } from "./db";
import { weekDatesOf, weekdayOf } from "./time";

/**
 * เมื่อมีหลายเวอร์ชันของ (วัน, รถ, รอบ) เดียวกัน เลือกอันที่ effectiveFrom ใหม่สุด
 * ถ้า effectiveFrom เท่ากัน ตัวแรกในลิสต์ชนะ — ผู้เรียกจึงควร sort มาก่อน
 * (resolveScheduleForDate sort ด้วย _id: -1 → เอกสารที่สร้างทีหลังชนะ)
 */
export function pickLatestVersions(list: Assignment[]): Assignment[] {
  const best = new Map<string, Assignment>();
  for (const a of list) {
    const key = `${a.weekday}-${a.truckNumber}-${a.shiftNo}`;
    const cur = best.get(key);
    if (!cur || a.effectiveFrom > cur.effectiveFrom) best.set(key, a);
  }
  return [...best.values()];
}

/** logic บริสุทธิ์ — ไม่แตะฐานข้อมูล เพื่อให้เทสต์ได้ */
export function buildDaySchedule(
  date: string,
  weekday: Weekday,
  list: Array<Assignment & { _id?: unknown }>,
  routes: Route[],
  trucks: Truck[]
): ResolvedDaySchedule {
  const routeByCode = new Map(routes.map((r) => [r.code, r]));
  const truckByNumber = new Map(trucks.map((t) => [t.number, t]));

  const resolved: ResolvedAssignment[] = list.map((a) => {
    const route = a.routeCode ? routeByCode.get(a.routeCode) ?? null : null;
    const truck = truckByNumber.get(a.truckNumber);
    if (!truck) {
      // ข้อมูลไม่ครบ (ตารางอ้างรถที่ไม่มีในทะเบียน) — ยัง render ต่อด้วยสี default แต่เตือนไว้ให้ตามแก้
      console.warn(`[garbage] ไม่พบรถเบอร์ ${a.truckNumber} ในทะเบียนรถ — ใช้สีเขียวเป็นค่า default`);
    }
    const timeBySeq = new Map(a.stopTimes.map((s) => [s.seq, s.atMin]));

    return {
      id: a._id == null ? "" : String(a._id),
      truckNumber: a.truckNumber,
      truckColor: truck?.color ?? "green",
      shiftNo: a.shiftNo,
      kind: a.kind,
      routeCode: a.routeCode,
      routeName: route?.name ?? null,
      routeNeedsVerification: route?.needsVerification ?? false,
      coverForRouteCode: a.coverForRouteCode,
      startMin: a.startMin,
      endMin: a.endMin,
      label: a.label,
      stops: route
        ? route.stops.map((s) => ({ ...s, atMin: timeBySeq.get(s.seq) ?? null }))
        : [],
      communityWindows: a.communityWindows,
    };
  });

  // วันหยุดไปท้ายสุด ที่เหลือเรียงตามเวลาเริ่ม แล้วเบอร์รถ แล้วรอบ
  resolved.sort((x, y) => {
    const xOff = x.startMin == null ? 1 : 0;
    const yOff = y.startMin == null ? 1 : 0;
    if (xOff !== yOff) return xOff - yOff;
    if (x.startMin != null && y.startMin != null && x.startMin !== y.startMin)
      return x.startMin - y.startMin;
    if (x.truckNumber !== y.truckNumber) return x.truckNumber - y.truckNumber;
    return x.shiftNo - y.shiftNo;
  });

  return { date, weekday, assignments: resolved };
}

/** อ่านจากฐานข้อมูลแล้วประกอบเป็นตารางของวันที่ระบุ */
export async function resolveScheduleForDate(date: string): Promise<ResolvedDaySchedule> {
  const weekday = weekdayOf(date);
  const at = new Date(`${date}T00:00:00+07:00`);

  const [aCol, rCol, tCol] = await Promise.all([assignmentsCol(), routesCol(), trucksCol()]);
  const [rawAssignments, allRoutes, allTrucks] = await Promise.all([
    aCol
      // effectiveTo เก็บเป็นเที่ยงคืนกรุงเทพฯ ของ "วันสุดท้ายที่ยังใช้ผังนี้" (inclusive) —
      // จึงใช้ $gte กับเที่ยงคืนของวันที่ขอ; ฝั่ง admin ที่เขียนข้อมูลห้ามใช้ convention แบบ exclusive
      .find({
        weekday,
        effectiveFrom: { $lte: at },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: at } }],
      })
      // เรียงใหม่สุดก่อน + _id ใหม่สุดก่อน เพื่อให้ pickLatestVersions ตัดสิน tie แบบ deterministic
      .sort({ effectiveFrom: -1, _id: -1 })
      .toArray(),
    // ดึงเฉพาะสาย active — assignment ที่อ้างสายที่ปิดใช้งานจะ render แบบไม่มีสายโดยตั้งใจ
    // (routeName เป็น null, stops ว่าง) ไม่ใช่ bug
    rCol.find({ active: true }).toArray(),
    tCol.find({}).toArray(),
  ]);

  return buildDaySchedule(date, weekday, pickLatestVersions(rawAssignments), allRoutes, allTrucks);
}

/** งานมอบหมายนี้มีผลในวันที่อ้างอิงหรือไม่ — effectiveTo คือวันสุดท้ายที่ยังใช้ (inclusive) */
function isEffectiveOn(a: Assignment, at: Date): boolean {
  return a.effectiveFrom <= at && (a.effectiveTo == null || a.effectiveTo >= at);
}

/**
 * logic บริสุทธิ์ — ไม่แตะฐานข้อมูล เพื่อให้เทสต์ได้
 * dates เรียงลำดับอย่างไร ผลลัพธ์เรียงอย่างนั้น (ผู้เรียกใช้ weekDatesOf จึงได้อาทิตย์→เสาร์)
 * วันที่ไม่มีงานยังต้องอยู่ในผลลัพธ์ด้วย assignments ว่าง — ฝั่ง UI ใช้บอกว่าวันไหนรอข้อมูล
 *
 * **เงื่อนไขที่ผู้เรียกต้องทำมาก่อน:** `list` ต้องเรียงใหม่สุดมาก่อน เพราะ pickLatestVersions
 * ตัดสิน tie ด้วย "ตัวแรกในลิสต์ชนะ" เมื่อหลายเวอร์ชันของ (วัน, รถ, รอบ) เดียวกันมี effectiveFrom
 * เท่ากัน — ถ้าส่งลิสต์ที่ไม่ได้เรียง การเลือกเวอร์ชันจะขึ้นกับลำดับที่ไดรเวอร์คืนมา (ไม่ deterministic)
 * `resolveWeekSchedule` จัดการให้แล้วด้วย .sort({ effectiveFrom: -1, _id: -1 }) — ห้ามลบ
 */
export function buildWeekSchedule(
  dates: string[],
  list: Array<Assignment & { _id?: unknown }>,
  routes: Route[],
  trucks: Truck[]
): ResolvedDaySchedule[] {
  return dates.map((date) => {
    const weekday = weekdayOf(date);
    const at = new Date(`${date}T00:00:00+07:00`);
    const forDay = list.filter((a) => a.weekday === weekday && isEffectiveOn(a, at));
    return buildDaySchedule(date, weekday, pickLatestVersions(forDay), routes, trucks);
  });
}

/**
 * อ่านฐานข้อมูล "รอบเดียว" แล้วประกอบตารางทั้งสัปดาห์ที่ครอบวันที่ระบุ
 * คิวรีด้วยกรอบกว้างสุดของสัปดาห์ แล้วกรองช่วงมีผลละเอียดต่อวันใน buildWeekSchedule
 */
export async function resolveWeekSchedule(date: string): Promise<ResolvedDaySchedule[]> {
  const dates = weekDatesOf(date);
  const weekStart = new Date(`${dates[0]}T00:00:00+07:00`);
  const weekEnd = new Date(`${dates[6]}T00:00:00+07:00`);

  const [aCol, rCol, tCol] = await Promise.all([assignmentsCol(), routesCol(), trucksCol()]);
  const [rawAssignments, allRoutes, allTrucks] = await Promise.all([
    aCol
      .find({
        effectiveFrom: { $lte: weekEnd },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: weekStart } }],
      })
      .sort({ effectiveFrom: -1, _id: -1 })
      .toArray(),
    rCol.find({ active: true }).toArray(),
    tCol.find({}).toArray(),
  ]);

  return buildWeekSchedule(dates, rawAssignments, allRoutes, allTrucks);
}
