/** นาทีจากเที่ยงคืน 0–1439 (เช่น 4.00 น. = 240, 13.30 น. = 810, 20.00 น. = 1200) */
export type Minutes = number;

export type TruckColor = "yellow" | "green";
export type TruckStatus = "active" | "maintenance" | "retired";
export type StopMode = "truck" | "walk";
export type AssignmentKind = "normal" | "substitute" | "day_off" | "special";

/** 0 = อาทิตย์ … 6 = เสาร์ ตรงกับ Date.getDay() */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Truck {
  number: number;
  color: TruckColor;
  plate?: string | null;
  status: TruckStatus;
}

export interface Community {
  name: string;
  aliases?: string[];
}

export interface RouteStop {
  seq: number;
  name: string;
  mode: StopMode;
  /** อ้างถนนในชั้นข้อมูล GIS — ยังไม่ได้ใช้ในเฟสนี้ */
  roadId?: string | null;
}

export interface Route {
  code: string;
  name: string;
  defaultTruckNumber: number;
  stops: RouteStop[];
  communityNames: string[];
  source?: string;
  needsVerification?: boolean;
  active: boolean;
}

export interface StopTime {
  seq: number;
  atMin: Minutes;
}

export interface CommunityWindow {
  communityNames: string[];
  startMin: Minutes;
  endMin: Minutes;
  note?: string;
}

export interface Assignment {
  weekday: Weekday;
  shiftNo: number;
  truckNumber: number;
  routeCode: string | null;
  kind: AssignmentKind;
  coverForRouteCode: string | null;
  startMin: Minutes | null;
  endMin: Minutes | null;
  stopTimes: StopTime[];
  communityWindows: CommunityWindow[];
  label: string | null;
  effectiveFrom: Date;
  /**
   * เที่ยงคืนกรุงเทพฯ ของ "วันสุดท้ายที่ยังใช้ผังนี้" (inclusive) — null = ใช้ตลอดไป
   * ฝั่งเขียนข้อมูล (admin/seed) ห้ามใช้ convention แบบ exclusive เพราะ resolver คิวรีด้วย $gte
   */
  effectiveTo: Date | null;
}

/** ผลลัพธ์หลัง join แล้ว พร้อมส่งให้ UI */
export interface ResolvedAssignment {
  truckNumber: number;
  truckColor: TruckColor;
  shiftNo: number;
  kind: AssignmentKind;
  routeCode: string | null;
  routeName: string | null;
  /** สายนี้ยังต้องให้กองสาธารณสุขตรวจชื่อจุด (R5–R7 ถอดจากโปสเตอร์) — ไม่มีสายถือว่า false */
  routeNeedsVerification: boolean;
  coverForRouteCode: string | null;
  startMin: Minutes | null;
  endMin: Minutes | null;
  label: string | null;
  stops: Array<RouteStop & { atMin: Minutes | null }>;
  communityWindows: CommunityWindow[];
}

export interface ResolvedDaySchedule {
  date: string; // YYYY-MM-DD
  weekday: Weekday;
  assignments: ResolvedAssignment[];
}

export type LiveStatus = "upcoming" | "running" | "finished" | "unknown";

export interface LivePosition {
  status: LiveStatus;
  /** จำนวนนาทีนับจากตอนนี้ก่อนเริ่ม — มีค่าเมื่อ status = "upcoming" */
  startsInMin: number | null;
  currentStop: (RouteStop & { atMin: Minutes | null }) | null;
  nextStop: (RouteStop & { atMin: Minutes | null }) | null;
  /** นาทีนับจากตอนนี้ถึง nextStop */
  etaNextMin: number | null;
  currentWindow: CommunityWindow | null;
  /** 0–1 */
  progress: number;
}

/** ค่าตั้งค่าการแสดงผลของโมดูล — singleton doc key = "default" ใน garbage_settings */
export interface GarbageSettings {
  key: string;
  contactPhone: string | null;
  contactNote: string | null;
  updatedBy: string | null;
}
