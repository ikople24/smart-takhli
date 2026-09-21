import { describe, expect, it } from 'vitest';
import Satisfaction from '@/models/Satisfaction';

describe('Satisfaction schema', () => {
  it('มีฟิลด์ source ค่า default เป็น public และรับได้แค่ public|line', () => {
    const path = Satisfaction.schema.path('source');
    expect(path).toBeDefined();
    expect(path.options.default).toBe('public');
    expect(path.options.enum).toEqual(['public', 'line']);
  });

  it('มีฟิลด์ lineUserId ค่า default เป็น null', () => {
    const path = Satisfaction.schema.path('lineUserId');
    expect(path).toBeDefined();
    expect(path.options.default).toBeNull();
  });

  it('มี partial unique index กันให้คะแนนซ้ำ 1 LINE user ต่อ 1 เรื่อง', () => {
    const found = Satisfaction.schema.indexes().find(
      ([fields]) => fields.complaintId === 1 && fields.lineUserId === 1
    );
    expect(found).toBeDefined();
    const [, options] = found;
    expect(options.unique).toBe(true);
    expect(options.partialFilterExpression).toEqual({ lineUserId: { $type: 'string' } });
  });
});
