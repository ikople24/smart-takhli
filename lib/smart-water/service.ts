import { ObjectId, type Filter, type Document } from 'mongodb';
import { pipes, nodes } from './db';
import { buildPipeCode, toMm } from './pipe-code';
import { computeLengthM, bboxOf, type LngLat } from './geo';
import { PipeInputSchema, NodeInputSchema, type PipeInput } from './schemas';

/** โยนเมื่อพยายามเขียนทับเอกสารที่ถูก soft delete — route จับไปตอบ 409 */
export class DeletedDocError extends Error {
  constructor() {
    super('เอกสารนี้ถูกลบแล้ว แก้ไขไม่ได้');
    this.name = 'DeletedDocError';
  }
}

/** pure — เทสต์ได้โดยไม่ต้องต่อ DB */
export function derivePipeFields(input: PipeInput) {
  const coords = input.geometry.coordinates as LngLat[];
  return {
    // code สร้างจาก value ตรง ๆ — ผู้เรียกต้องส่ง unit ตามชนิดท่อ (PIPE_MATERIALS[x].unit)
    // ไม่งั้นได้ code กำกวม เช่น PVC 110mm → "P110" ที่ระบบอ่านเป็นนิ้ว
    code: buildPipeCode(input.material, input.diameter.value),
    diameterMm: toMm(input.diameter.value, input.diameter.unit),
    lengthM: computeLengthM(coords),
    bbox: bboxOf(coords),
  };
}

/** แยก key ที่เป็น undefined ออกเป็นรายการ $unset — เคลียร์ค่าได้จริง และไม่เขียน null ลง DB */
export function splitUndefined<T extends Record<string, unknown>>(
  obj: T
): { defined: Partial<T>; unsetKeys: string[] } {
  const defined: Record<string, unknown> = {};
  const unsetKeys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) unsetKeys.push(k);
    else defined[k] = v;
  }
  return { defined: defined as Partial<T>, unsetKeys };
}

export async function savePipe(raw: unknown) {
  const input = PipeInputSchema.parse(raw);
  const derived = derivePipeFields(input);
  const { _id, ...rest } = input;
  const id = _id ? new ObjectId(_id) : new ObjectId();
  const now = new Date();

  const col = await pipes();
  if (_id) {
    const prev = await col.findOne({ _id: id }, { projection: { deletedAt: 1 } });
    if (prev && prev.deletedAt) throw new DeletedDocError();
  }
  const { defined, unsetKeys } = splitUndefined(rest);
  await col.updateOne(
    { _id: id },
    {
      $set: { ...defined, ...derived, updatedAt: now },
      $setOnInsert: { createdAt: now, deletedAt: null },
      ...(unsetKeys.length
        ? { $unset: Object.fromEntries(unsetKeys.map((k) => [k, true])) }
        : {}),
    },
    { upsert: true }
  );
  return col.findOne({ _id: id });
}

export async function saveNode(raw: unknown) {
  const input = NodeInputSchema.parse(raw);
  const { _id, onPipeId, ...rest } = input;
  const id = _id ? new ObjectId(_id) : new ObjectId();
  const now = new Date();

  const col = await nodes();
  if (_id) {
    const prev = await col.findOne({ _id: id }, { projection: { deletedAt: 1 } });
    if (prev && prev.deletedAt) throw new DeletedDocError();
  }
  const { defined, unsetKeys } = splitUndefined(rest);
  await col.updateOne(
    { _id: id },
    {
      $set: {
        ...defined,
        onPipeId: onPipeId ? new ObjectId(onPipeId) : null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now, deletedAt: null },
      ...(unsetKeys.length
        ? { $unset: Object.fromEntries(unsetKeys.map((k) => [k, true])) }
        : {}),
    },
    { upsert: true }
  );
  return col.findOne({ _id: id });
}

export type BBox = [number, number, number, number];

function bboxFilter(bbox?: BBox): Filter<Document> {
  if (!bbox) return {};
  const [w, s, e, n] = bbox;
  // bbox เพี้ยน (NaN/กลับด้าน/พื้นที่ศูนย์) → ไม่กรองดีกว่าปล่อยให้ Mongo โยน error ตอน query
  if (![w, s, e, n].every(Number.isFinite) || !(w < e) || !(s < n)) return {};
  return {
    geometry: {
      $geoIntersects: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      },
    },
  };
}

export async function listPipes(opts: {
  bbox?: BBox;
  material?: string;
  status?: string;
  roadName?: string;
  limit?: number;
}) {
  const filter: Filter<Document> = {
    deletedAt: null,
    ...bboxFilter(opts.bbox),
  };
  if (opts.material) filter.material = opts.material;
  if (opts.status) filter.status = opts.status;
  if (opts.roadName) filter.roadName = opts.roadName;

  const col = await pipes();
  // ข้อมูลจริงจากแบบมี 2,096 เส้น — default ต้องสูงกว่านั้น ไม่งั้นแผนที่ขาดหายเงียบ ๆ
  return col
    .find(filter)
    .limit(Math.min(Math.max(opts.limit ?? 5000, 1), 10000))
    .toArray();
}

export async function listNodes(opts: {
  bbox?: BBox;
  type?: string;
  limit?: number;
}) {
  const filter: Filter<Document> = {
    deletedAt: null,
    ...bboxFilter(opts.bbox),
  };
  if (opts.type) filter.type = opts.type;

  const col = await nodes();
  return col
    .find(filter)
    .limit(Math.min(Math.max(opts.limit ?? 3000, 1), 8000))
    .toArray();
}

export async function softDeletePipe(id: string) {
  const col = await pipes();
  return col.updateOne(
    { _id: new ObjectId(id), deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
}

export async function softDeleteNode(id: string) {
  const col = await nodes();
  // tombstone hydrantNo ใน update เดียวกับ deletedAt (atomic) — เลขหัวดับเพลิงเดิม
  // ต้อง reuse ได้หลังลบ เพราะ uniq_hydrant_no ครอบเอกสารที่ถูก soft delete ด้วย
  // (aggregation pipeline update — MongoDB 4.2+)
  return col.updateOne({ _id: new ObjectId(id), deletedAt: null }, [
    {
      $set: {
        deletedAt: '$$NOW',
        hydrantNo: {
          $cond: [
            { $eq: [{ $type: '$hydrantNo' }, 'string'] },
            {
              $concat: ['$hydrantNo', '~deleted~', { $toString: { $toLong: '$$NOW' } }],
            },
            '$hydrantNo',
          ],
        },
      },
    },
  ]);
}
