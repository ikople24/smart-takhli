import { z } from 'zod';
import { PIPE_STATUSES, NODE_TYPES } from './constants';

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

export const PipeInputSchema = z.object({
  _id: z.string().optional(),
  material: z.enum(['AC', 'GS', 'HDPE', 'PVC', 'SP', 'RCP']),
  diameter: z.object({
    value: z.number().positive('ขนาดท่อต้องมากกว่า 0'),
    unit: z.enum(['inch', 'mm', 'cm']),
  }),
  status: z.enum(PIPE_STATUSES).default('existing'),
  roadName: z.string().trim().max(200).optional(),
  zone: z.string().trim().max(100).optional(),
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
  hydrantNo: z.string().trim().max(50).optional(),
  size: z.string().trim().max(50).optional(),
  condition: z
    .enum(['ok', 'leaking', 'blocked', 'damaged', 'missing', 'unknown'])
    .default('unknown'),
  accessNote: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
});

export type PipeInput = z.infer<typeof PipeInputSchema>;
export type NodeInput = z.infer<typeof NodeInputSchema>;
