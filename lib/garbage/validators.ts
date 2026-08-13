import { z } from "zod";

const minutes = z
  .number()
  .int("นาทีต้องเป็นจำนวนเต็ม")
  .min(0, "นาทีต้องอยู่ระหว่าง 0–1439")
  .max(1439, "นาทีต้องอยู่ระหว่าง 0–1439");

export const stopSchema = z.object({
  seq: z.number().int().positive(),
  name: z.string().min(1).max(200),
  mode: z.enum(["truck", "walk"]),
  roadId: z.string().max(50).nullable().optional(),
}).strict();

export const routeSchema = z.object({
  code: z.string().regex(/^R\d+$/u, "รหัสสายต้องเป็นรูปแบบ R1, R2, …"),
  name: z.string().min(1).max(200),
  defaultTruckNumber: z.number().int().min(1).max(99),
  stops: z.array(stopSchema).min(1),
  communityNames: z.array(z.string().min(1)).min(1),
  source: z.string().optional(),
  needsVerification: z.boolean().optional(),
}).strict();

export const stopTimeSchema = z.object({
  seq: z.number().int().positive(),
  atMin: minutes,
}).strict();

export const communityWindowSchema = z.object({
  communityNames: z.array(z.string().min(1)).min(1),
  startMin: minutes,
  endMin: minutes,
  note: z.string().optional(),
}).strict();

export const assignmentSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  shiftNo: z.number().int().positive(),
  truckNumber: z.number().int().min(1).max(99),
  routeCode: z.string().regex(/^R\d+$/u, "รหัสสายต้องเป็นรูปแบบ R1, R2, …").nullable(),
  kind: z.enum(["normal", "substitute", "day_off", "special"]),
  coverForRouteCode: z.string().regex(/^R\d+$/u, "รหัสสายต้องเป็นรูปแบบ R1, R2, …").nullable(),
  startMin: minutes.nullable(),
  endMin: minutes.nullable(),
  stopTimes: z.array(stopTimeSchema),
  communityWindows: z.array(communityWindowSchema),
  label: z.string().nullable(),
}).strict()
  .refine((a) => a.kind !== "day_off" || a.routeCode === null, {
    message: "วันหยุดต้องไม่มี routeCode",
  })
  .refine((a) => a.kind !== "substitute" || a.coverForRouteCode !== null, {
    message: "การแทนเบอร์ต้องระบุ coverForRouteCode",
  })
  // resolver join จุดเก็บผ่าน routeCode เท่านั้น — substitute ที่ไม่มี routeCode จะ render เป็นศูนย์จุดแบบเงียบ ๆ
  .refine((a) => a.kind !== "substitute" || a.routeCode !== null, {
    message: "การแทนเบอร์ต้องมี routeCode ของสายที่วิ่งจริง",
  })
  .refine((a) => a.kind === "day_off" || (a.startMin !== null && a.endMin !== null), {
    message: "ต้องระบุเวลาเริ่มและสิ้นสุด ยกเว้นวันหยุด",
  })
  // หมายเหตุ: kind "special" อนุญาต routeCode null ได้ (เช่น รถ 7 วิ่งตลาดนัดพิเศษไม่มีสายประจำ)
  .refine((a) => a.kind !== "normal" || a.routeCode !== null, {
    message: "งานปกติต้องระบุ routeCode",
  })
  .refine((a) => a.kind === "substitute" || a.coverForRouteCode === null, {
    message: "coverForRouteCode ใช้ได้เฉพาะการแทนเบอร์",
  })
  .refine((a) => a.kind !== "day_off" || (a.startMin === null && a.endMin === null), {
    message: "วันหยุดต้องไม่มีเวลา",
  })
  // เวลาเท่ากันถือว่าผ่าน (จุดจอดเดียวเริ่ม-จบพร้อมกัน เช่น 1200/1200 มีในข้อมูลจริง)
  .refine((a) => a.startMin === null || a.endMin === null || a.endMin >= a.startMin, {
    message: "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม",
  })
  // เรียงตาม seq แล้วเวลาต้องไม่ย้อนกลับ (เวลาเท่ากันถือว่าผ่าน — จุดติดกันเวลาเดียวกันมีในข้อมูลจริง)
  .refine(
    (a) => {
      const sorted = [...a.stopTimes].sort((x, y) => x.seq - y.seq);
      return sorted.every((s, i) => i === 0 || s.atMin >= sorted[i - 1].atMin);
    },
    { message: "เวลาใน stopTimes ต้องไม่ย้อนกลับตามลำดับจุด" }
  );

/** key หลักของไฟล์ seed — key อื่นต้องขึ้นต้นด้วย $ เท่านั้น (กัน typo เช่น "assigments" เงียบหาย) */
const SEED_KNOWN_KEYS = new Set(["trucks", "communities", "routes", "assignments"]);

// seed script เป็นคนเติม effectiveFrom/effectiveTo/active และ default ของ aliases ตอนเขียนลง DB
export const seedFileSchema = z.object({
  trucks: z.array(
    z.object({
      number: z.number().int().min(1).max(99),
      color: z.enum(["yellow", "green"]),
      status: z.enum(["active", "maintenance", "retired"]),
    }).strict()
  ),
  communities: z.array(
    z.object({
      name: z.string().min(1),
      aliases: z.array(z.string().min(1)).optional(),
    }).strict()
  ),
  routes: z.array(routeSchema),
  assignments: z.array(assignmentSchema),
}).passthrough() // ยอมให้มี key ที่ขึ้นต้นด้วย $ สำหรับคำอธิบายในไฟล์
  .superRefine((obj, ctx) => {
    for (const key of Object.keys(obj)) {
      if (!SEED_KNOWN_KEYS.has(key) && !key.startsWith("$")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `key "${key}" ไม่รู้จัก — key เสริมต้องขึ้นต้นด้วย $`,
        });
      }
    }
  });

/**
 * ฟอร์มตั้งค่าจากหน้าแอดมิน — ค่าว่างถือเป็น null (ล้างค่า)
 * trim ก่อน max เพื่อไม่ให้ข้อความที่มีช่องว่าง/ขึ้นบรรทัดต่อท้ายถูกปฏิเสธว่า "ยาวเกิน"
 */
const optionalTrimmed = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .optional()
    .transform((v) => {
      const s = typeof v === "string" ? v.trim() : v;
      return s == null || s === "" ? null : s;
    });

// อักขระที่ยอมให้มีในช่องเบอร์ติดต่อ — ตัวเลข เว้นวรรค - ( ) + , / และอักษรไทย (สำหรับคำว่า "ต่อ")
// รูปแบบจริงของเทศบาลที่ต้องรับได้: "056-801234 ต่อ 105", "056-801234, 056-801235", "056-801234/5", "1132"
const PHONE_ALLOWED_RE = /^[0-9+\-()/,\s\u0E00-\u0E7F]+$/u;
// ต้องมีตัวเลขจริงอย่างน้อย 4 ตัว — กันค่าที่ผ่านคลาสอักขระแต่โทรไม่ได้ เช่น "((((((" หรือ "------"
// (เบอร์สั้น 4 หลักอย่าง 1132 ต้องผ่าน จึงไม่บังคับความยาวขั้นต่ำ 6 ตัวอักษร)
const PHONE_MIN_DIGITS = 4;

export const garbageSettingsInputSchema = z
  .object({
    contactPhone: optionalTrimmed(30, "เบอร์ติดต่อยาวเกิน 30 ตัวอักษร").refine(
      (v) =>
        v == null ||
        (PHONE_ALLOWED_RE.test(v) && (v.match(/\d/gu) ?? []).length >= PHONE_MIN_DIGITS),
      "เบอร์ติดต่อต้องมีตัวเลขอย่างน้อย 4 ตัว และใช้ได้เฉพาะตัวเลข เว้นวรรค - ( ) + , / และคำว่า “ต่อ”"
    ),
    contactNote: optionalTrimmed(200, "หมายเหตุยาวเกิน 200 ตัวอักษร"),
  })
  .strict();

/**
 * ข้อมูลงานมอบหมายที่รับจากฟอร์มแอดมิน
 * ไม่มี effectiveFrom/effectiveTo — เซิร์ฟเวอร์เติมจาก BASELINE_EFFECTIVE_FROM เอง
 * กฎภายในเอกสารทั้งหมดใช้ชุดเดียวกับ assignmentSchema (ยืมผ่าน .innerType ไม่ได้เพราะมี refine)
 */
export const assignmentInputSchema = assignmentSchema;

/** ข้อความเดียวกันทั้งกรณีไม่ส่งมาและส่งมาเป็นค่าว่าง — ผู้ใช้เห็นอะไรก็ทำแบบเดียวกันคือเปิดฟอร์มใหม่ */
const assignmentLockToken = z
  .string({ required_error: "ต้องส่ง updatedAt ของงานที่โหลดมา" })
  .min(1, "ต้องส่ง updatedAt ของงานที่โหลดมา");

/**
 * ข้อมูลงานมอบหมายสำหรับ **PUT เท่านั้น** = ข้อมูลงานทั้งชุด + `updatedAt` ที่ฟอร์มโหลดมา (optimistic lock)
 * POST ไม่ต้องมีเพราะยังไม่มีเอกสารให้ชนกัน
 *
 * ต้องแยกคีย์ `updatedAt` ออกก่อนแล้วค่อยส่งที่เหลือให้ `assignmentSchema` —
 * ใช้ `assignmentSchema.and(...)` ไม่ได้ เพราะ intersection จะ parse ทั้งสองฝั่งด้วย input ก้อนเดียวกัน
 * แล้วฝั่ง `.strict()` จะตีว่า `updatedAt` เป็นคีย์แปลกปลอม → 400 ทุกครั้งแม้ข้อมูลถูกต้อง (พิสูจน์แล้วด้วย probe)
 * รูปแบบนี้ `.strict()` ยังทำงานเหมือนเดิม (คีย์แปลกปลอมตัวอื่นยังถูกปฏิเสธ) และข้อความ error ของกฎเดิมไม่เปลี่ยน
 */
export const assignmentUpdateSchema = z
  .object({ updatedAt: assignmentLockToken })
  .passthrough()
  .transform(({ updatedAt, ...rest }) => ({ updatedAt, assignment: rest }))
  .pipe(z.object({ updatedAt: assignmentLockToken, assignment: assignmentSchema }));

/** จุดเก็บที่ส่งมาจากฟอร์มแก้สาย — ไม่รับ seq เพราะเซิร์ฟเวอร์เป็นคนกำหนด */
export const stopDraftSchema = z
  .object({
    prevSeq: z.number().int().positive().nullable(),
    name: z.string().trim().min(1, "ชื่อจุดเก็บต้องไม่ว่าง").max(200, "ชื่อจุดเก็บยาวเกิน 200 ตัวอักษร"),
    mode: z.enum(["truck", "walk"]),
    roadId: z.string().max(50).nullable().optional(),
  })
  .strict();

export const routeUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "ชื่อสายต้องไม่ว่าง").max(200, "ชื่อสายยาวเกิน 200 ตัวอักษร"),
    needsVerification: z.boolean(),
    stops: z.array(stopDraftSchema).min(1, "สายต้องมีจุดเก็บอย่างน้อย 1 จุด"),
    /**
     * ค่า updatedAt ของสายตอนที่ฟอร์มโหลดข้อมูล (ISO string จาก GET /api/garbage/routes)
     * — optimistic lock กันฟอร์มค้าง: ถ้ามีคนอื่นบันทึกสายนี้ไปก่อน เซิร์ฟเวอร์จะปฏิเสธด้วย 409
     * จำเป็นเพราะการ "สลับลำดับจุดล้วน" ไม่เปลี่ยนเซตของ seq เลย การตรวจ prevSeq จึงจับไม่ได้
     * (สายที่ยังไม่มี updatedAt ในฐานข้อมูล ส่งค่าอะไรมาก็ได้ที่ไม่ว่าง — เซิร์ฟเวอร์ข้ามการเทียบ)
     */
    updatedAt: z
      .string({ required_error: "ต้องส่ง updatedAt ของสายที่โหลดมา" })
      .min(1, "ต้องส่ง updatedAt ของสายที่โหลดมา"),
  })
  .strict()
  .refine(
    (r) => {
      const prev = r.stops.map((s) => s.prevSeq).filter((s): s is number => s != null);
      return new Set(prev).size === prev.length;
    },
    { message: "ส่งจุดเดิมซ้ำกัน (prevSeq ซ้ำ)" }
  );
