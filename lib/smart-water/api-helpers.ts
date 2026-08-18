import type { NextApiRequest } from 'next';
import type { Document } from 'mongodb';
import type { BBox } from './service';

export function parseBBox(req: NextApiRequest): BBox | undefined {
  const raw = req.query.bbox;
  if (typeof raw !== 'string') return undefined;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return undefined;
  return parts as BBox;
}

export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function toFeatureCollection(docs: Document[]) {
  return {
    type: 'FeatureCollection',
    features: docs.map((d) => {
      const { geometry, _id, ...props } = d;
      return {
        type: 'Feature',
        id: String(_id),
        geometry,
        properties: { ...props, _id: String(_id) },
      };
    }),
  };
}

/** ดึง ZodError ออกจาก unknown อย่างปลอดภัย — คืน null ถ้าไม่ใช่ */
export function zodIssues(e: unknown): unknown[] | null {
  if (e && typeof e === 'object' && (e as { name?: string }).name === 'ZodError') {
    return (e as { issues: unknown[] }).issues;
  }
  return null;
}
