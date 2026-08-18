import { describe, it, expect } from 'vitest';
import { PipeInputSchema, NodeInputSchema } from './schemas';

const validPipe = {
  material: 'PVC',
  diameter: { value: 4, unit: 'inch' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [100.35, 15.26],
      [100.36, 15.26],
    ],
  },
};

const validNode = {
  type: 'hydrant',
  geometry: { type: 'Point', coordinates: [100.35, 15.26] },
};

describe('PipeInputSchema', () => {
  it('รับข้อมูลขั้นต่ำและเติม default', () => {
    const r = PipeInputSchema.parse(validPipe);
    expect(r.status).toBe('existing');
    expect(r.ownership).toBe('municipality');
    expect(r.lengthSource).toBe('computed');
  });

  it('แปลง roadName ว่างเป็น undefined', () => {
    const r = PipeInputSchema.parse({ ...validPipe, roadName: '   ' });
    expect(r.roadName).toBeUndefined();
  });

  it('ปฏิเสธ material นอกตาราง', () => {
    expect(PipeInputSchema.safeParse({ ...validPipe, material: 'XX' }).success).toBe(false);
  });

  it('ปฏิเสธ geometry จุดเดียว', () => {
    const bad = {
      ...validPipe,
      geometry: { type: 'LineString', coordinates: [[100.35, 15.26]] },
    };
    expect(PipeInputSchema.safeParse(bad).success).toBe(false);
  });

  it('ปฏิเสธ _id ที่ไม่ใช่ ObjectId hex', () => {
    expect(PipeInputSchema.safeParse({ ...validPipe, _id: 'abc' }).success).toBe(false);
    expect(PipeInputSchema.safeParse({ ...validPipe, _id: '' }).success).toBe(false);
  });
});

describe('NodeInputSchema', () => {
  it('แปลง hydrantNo ว่างเป็น undefined — กันชนกับ unique index', () => {
    const r = NodeInputSchema.parse({ ...validNode, hydrantNo: '' });
    expect(r.hydrantNo).toBeUndefined();
  });

  it('เก็บ hydrantNo ที่มีค่าจริงไว้', () => {
    const r = NodeInputSchema.parse({ ...validNode, hydrantNo: ' HD-001 ' });
    expect(r.hydrantNo).toBe('HD-001');
  });
});
