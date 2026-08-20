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
  /**
   * ชื่อพนักงานขับรถ — ข้อมูลพนักงาน **ห้ามส่งออก API สาธารณะ**
   * ตอนนี้เอกสาร Truck ไม่เคยถูก serialize ออกทาง API เลย: resolve.ts อ่านมาใช้แค่ `color`
   * แล้วส่งต่อเป็น ResolvedAssignment.truckColor เท่านั้น — ถ้าจะเพิ่มจุดที่ส่ง Truck ออก
   * ต้องเลือกฟิลด์เองทีละตัว อย่าส่งทั้งก้อน
   */
  driverName?: string | null;
  /** เช่น "รถขยะอัดท้าย", "รถยกภาชนะรองรับ" */
  truckType?: string | null;
}

export interface Community {
  name: string;
  aliases?: string[];
}

export interface RouteStop {
  seq: number;
  name: string;
  mode: StopMode;
  /** อ้างถนนใน collection `roads` — สคริปต์ map-garbage-communities.mjs เติมให้ตอนจับคู่ชื่อจุดกับถนน */
  roadId?: string | null;
  /** ชื่อชุมชนที่จุดนี้อยู่ — อ้างชื่อจาก geojsonfeatures.name (ห้ามใช้ garbage_communities ที่เลิกใช้แล้ว) */
  communityName?: string | null;
  /** "auto" = ระบบเดาจากถนน+polygon ยังไม่มีคนตรวจ · "manual" = เจ้าหน้าที่ยืนยันแล้ว */
  communitySource?: "auto" | "manual" | null;
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
  /**
   * เวลาที่บันทึกล่าสุด — ใช้เป็น optimistic lock ของฟอร์มแก้สาย (M6)
   * optional เพราะเอกสารที่ seed รุ่นแรกเขียนไว้อาจไม่มีฟิลด์นี้
   */
  updatedAt?: Date;
}

export interface StopTime {
  seq: number;
  /** เวลาที่รถถึงจุดนี้ — null = เก็บวันนี้แต่ยังไม่ระบุเวลา (เช่น รถยกภาชนะ) */
  atMin: Minutes | null;
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
  /**
   * เวลาที่บันทึกล่าสุด — ใช้เป็น optimistic lock ของฟอร์มแก้งาน (M6) เหมือน `Route.updatedAt`
   * optional เพราะเอกสารที่ seed รุ่นแรกเขียนไว้อาจไม่มีฟิลด์นี้
   */
  updatedAt?: Date;
}

/** ผลลัพธ์หลัง join แล้ว พร้อมส่งให้ UI */
export interface ResolvedAssignment {
  /** รหัสเอกสารในรูปสตริง — หน้าแอดมินใช้อ้างตอนแก้/ลบ; ว่างได้เมื่อสร้างจากข้อมูลที่ไม่มาจาก DB */
  id: string;
  /**
   * เวลาที่แก้ล่าสุดในรูป ISO string — ใช้เป็น optimistic lock token: ฟอร์มแก้งานต้องส่งค่านี้
   * กลับไปกับ PUT เพื่อให้เซิร์ฟเวอร์รู้ว่าฟอร์มค้างอยู่บนข้อมูลเก่าหรือไม่ (ไม่ตรง = 409)
   * จำเป็นเพราะการสลับลำดับจุดของสายไม่เปลี่ยนเซตของ seq เลย ฟอร์มเก่าจึงผ่านด่านอื่นได้หมด
   * แล้วเวลาไปติดผิดจุดแบบเงียบ ๆ · ว่างได้เมื่อสร้างจากข้อมูลที่ไม่มาจาก DB
   */
  updatedAt: string;
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
  /**
   * จุดทั้งหมดของสาย พร้อมสถานะรายวัน
   * served = วันนี้เก็บจุดนี้หรือไม่ (มาจากการมีอยู่ใน stopTimes)
   * atMin = เวลาที่ถึง · null ทั้งที่ served เป็น true แปลว่ายังไม่ระบุเวลา
   */
  stops: Array<RouteStop & { served: boolean; atMin: Minutes | null }>;
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
  /** PUT /api/garbage/settings เขียนให้ทุกครั้งที่บันทึก — optional เพราะ doc เก่าอาจไม่มี */
  updatedAt?: Date;
  /** เขียนครั้งเดียวตอน upsert สร้าง doc ($setOnInsert) */
  createdAt?: Date;
}

/** ผลค้นหาหนึ่งรายการจาก /api/garbage/search — ใช้ร่วมกันทั้งฝั่ง API และหน้าเว็บ */
export interface SearchHit {
  matchType: "stop" | "community";
  matchName: string;
  /**
   * ชื่อจุดเก็บจริงของ hit นี้ — สำหรับ matchType "stop" จะเท่ากับ matchName
   * แต่ matchType "community" ต้องมีด้วย ไม่งั้นผลค้นด้วยชื่อชุมชนจะเป็นแถวชื่อซ้ำกันทั้งหมด
   * แล้วชาวบ้านแยกไม่ออกว่าแถวไหนคือจุดใกล้บ้านตัวเอง
   */
  stopName: string;
  /** ลำดับจุดในสาย — คู่กับ routeCode เป็นคีย์ของจุดที่ติดตาม (`TrackedStop`) */
  seq: number;
  routeCode: string;
  routeName: string;
  weekday: number;
  weekdayName: string;
  truckNumber: number;
  /** สีรถของงานวันนั้น — ต้องมีเพื่อกดติดตามจากผลค้นหาได้โดยไม่ต้องยิง API ซ้ำ */
  truckColor: TruckColor;
  kind: AssignmentKind;
  coverForRouteCode: string | null;
  startMin: Minutes | null;
  endMin: Minutes | null;
  atMin: Minutes | null;
  /** วันนั้นเก็บจุดนี้จริงหรือไม่ — false = ชื่อจุดอยู่ในสาย แต่วันนั้นไม่เข้าเก็บ */
  served: boolean;
  /** ชื่อชุมชนของจุดนี้ (ถ้าระบุแล้ว) — ใช้แสดงประกอบผลค้นหา */
  communityName?: string | null;
}
