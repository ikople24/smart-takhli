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
