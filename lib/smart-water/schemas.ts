import { z } from 'zod';
import { PIPE_STATUSES, NODE_TYPES, PIPE_MATERIALS, type MaterialCode } from './constants';

/** ฟอร์มส่ง "" มาเมื่อไม่กรอก — แปลงเป็น undefined กันค่าว่างเข้า unique index และกลุ่มรายงาน */
const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const MATERIAL_CODES = Object.values(PIPE_MATERIALS).map((m) => m.code) as [
  MaterialCode,
  ...MaterialCode[]
];

const lngLat = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const LineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(lngLat).min(2, 'ต้องมีอย่างน้อย 2 จุด'),
});

export const PointSchema = z.object({
  type: z.literal('Point'),
  coordinates: lngLat,
});

/**
 * ⚠️ ฟิลด์ที่มี .default() จะถูกรีเซ็ตถ้าเอา schema นี้ parse ข้อมูลบางส่วน (partial)
 * — ฝั่ง PATCH ต้อง merge เอกสารเดิมกับ payload ให้ครบก่อนแล้วค่อย parse ทั้งก้อนเสมอ
 */
export const PipeInputSchema = z.object({
  _id: z.string().optional(),
  material: z.enum(MATERIAL_CODES),
  diameter: z.object({
    value: z.number().positive('ขนาดท่อต้องมากกว่า 0'),
    unit: z.enum(['inch', 'mm', 'cm']),
  }),
  status: z.enum(PIPE_STATUSES).default('existing'),
  roadName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  zone: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  installedYear: z.number().int().min(2400).max(2700).optional(),
  ownership: z.enum(['municipality', 'pwa', 'private']).default('municipality'),
  geometry: LineStringSchema,
  surveyedLengthM: z.number().positive().optional(),
  lengthSource: z.enum(['computed', 'surveyed', 'as-built']).default('computed'),
  sourceDoc: z
    .object({
      pdfName: z.string().optional(),
      page: z.number().int().optional(),
      confidence: z.enum(['high', 'medium', 'low']).default('low'),
    })
    .optional(),
  note: z.string().max(1000).optional(),
});

export const NodeInputSchema = z.object({
  _id: z.string().optional(),
  type: z.enum(
    Object.keys(NODE_TYPES) as [keyof typeof NODE_TYPES, ...Array<keyof typeof NODE_TYPES>]
  ),
  geometry: PointSchema,
  onPipeId: z.string().optional(),
  hydrantNo: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  size: z.string().trim().max(50).optional(),
  condition: z
    .enum(['ok', 'leaking', 'blocked', 'damaged', 'missing', 'unknown'])
    .default('unknown'),
  accessNote: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

export type PipeInput = z.infer<typeof PipeInputSchema>;
export type NodeInput = z.infer<typeof NodeInputSchema>;
