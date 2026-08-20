import { describe, it, expect } from 'vitest';
import { buildLengthPipeline } from './reports';

// return type เป็น Document[] ของ mongodb (มี index signature) — เข้าถึง stage ได้ตรง ๆ
// โดยไม่ต้องประกาศ any เอง (เลี่ยง no-explicit-any ของ eslint)

describe('buildLengthPipeline', () => {
  it('group ตาม material เป็นค่า default', () => {
    const p = buildLengthPipeline({});
    const group = p.find((s) => s.$group)!;
    expect(group.$group._id).toHaveProperty('material');
    expect(group.$group._id).toHaveProperty('diameterValue');
  });

  it('group ตามถนนได้', () => {
    const p = buildLengthPipeline({ groupBy: 'road' });
    const group = p.find((s) => s.$group)!;
    expect(group.$group._id).toHaveProperty('roadName');
  });

  it('group ตามปีที่วางได้', () => {
    const p = buildLengthPipeline({ groupBy: 'year' });
    const group = p.find((s) => s.$group)!;
    expect(group.$group._id).toEqual({ installedYear: '$installedYear' });
  });

  it('group ตามสถานะได้', () => {
    const p = buildLengthPipeline({ groupBy: 'status' });
    const group = p.find((s) => s.$group)!;
    expect(group.$group._id).toEqual({ status: '$status' });
  });

  it('ตัดท่อที่ถูกลบและท่อยกเลิกออก', () => {
    const p = buildLengthPipeline({});
    const match = p.find((s) => s.$match)!;
    expect(match.$match.deletedAt).toBeNull();
    expect(match.$match.status).toEqual({ $ne: 'abandoned' });
  });

  it('รวมท่อยกเลิกได้ถ้าสั่ง', () => {
    const p = buildLengthPipeline({ includeAbandoned: true });
    const match = p.find((s) => s.$match)!;
    expect(match.$match.status).toBeUndefined();
  });

  it('กรองตามถนนได้', () => {
    const p = buildLengthPipeline({ roadName: 'ถ.หัสนัย' });
    const match = p.find((s) => s.$match)!;
    expect(match.$match.roadName).toBe('ถ.หัสนัย');
  });
});
