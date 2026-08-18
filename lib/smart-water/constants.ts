/**
 * ตารางชนิดท่อตามสัญลักษณ์ในแบบแปลนเทศบาลเมืองตาคลี
 * unit ต่างกันตามชนิด — ห้ามสมมติว่าเป็นนิ้วทั้งหมด
 * basis: RCP ระบุเป็น ศก.ภายใน ที่เหลือเป็นขนาดระบุ (nominal)
 * หมายเหตุ: ไม่มีฟิลด์สีที่นี่ — สีในแบบจริงผูกกับ "รหัส" (ขนาด) ไม่ใช่ชนิด ดู CODE_COLORS ท้ายไฟล์
 */
export const PIPE_MATERIALS = {
  A: { code: 'AC',   nameTh: 'ท่อซีเมนต์ใยหิน',    unit: 'inch', basis: 'nominal' },
  G: { code: 'GS',   nameTh: 'ท่อเหล็กชุบสังกะสี',  unit: 'inch', basis: 'nominal' },
  H: { code: 'HDPE', nameTh: 'ท่อ HDPE',           unit: 'mm',   basis: 'nominal' },
  P: { code: 'PVC',  nameTh: 'ท่อ PVC',            unit: 'inch', basis: 'nominal' },
  S: { code: 'SP',   nameTh: 'ท่อเหล็กเหนียว',      unit: 'mm',   basis: 'nominal' },
  R: { code: 'RCP',  nameTh: 'ท่อระบายคอนกรีต',     unit: 'cm',   basis: 'internal' },
} as const;

export type MaterialLetter = keyof typeof PIPE_MATERIALS;
export type MaterialCode = (typeof PIPE_MATERIALS)[MaterialLetter]['code'];
export type DiameterUnit = 'inch' | 'mm' | 'cm';

export const NODE_TYPES = {
  gate_valve:  { nameTh: 'ประตูน้ำลิ้นแบบเปิด' },
  hydrant:     { nameTh: 'หัวดับเพลิง / ท่อธาร' },
  tap:         { nameTh: 'จุดจ่อ' },
  end_cap:     { nameTh: 'END CAP' },
  water_meter: { nameTh: 'มาตรวัดน้ำ' },
  blow_off:    { nameTh: 'จุดระบายตะกอน' },
} as const;

export type NodeType = keyof typeof NODE_TYPES;

export const PIPE_STATUSES = ['existing', 'new', 'abandoned', 'planned'] as const;
export type PipeStatus = (typeof PIPE_STATUSES)[number];

/**
 * สีตามรหัสท่อ อ่านจากแบบร่าง 2568 เพื่อให้ตรงกับที่กองการประปาคุ้นเคย
 * สีในแบบผูกกับ "รหัส" (ชนิด+ขนาด) ไม่ใช่ชนิดวัสดุ — ห้ามระบายสีตาม material
 * (สีแดงถูกใช้ซ้ำ 3 รหัส: P1.5 / P6 / A4 — AutoCAD ใช้ layer color ไม่ได้เป๊ะตามขนาด
 *  แยกกันบนแผนที่ด้วยความหนาเส้นตาม diameterMm แทน)
 * รหัสที่ไม่อยู่ในแบบ (เช่น S400, H110, R30) ใช้ FALLBACK_COLOR
 */
export const CODE_COLORS: Record<string, string> = {
  P1: '#00BFFF', 'P1.5': '#FF0000', P2: '#DD3700', P4: '#00FF00',
  P6: '#FF0000', P8: '#00FFFF', P10: '#FF7FBF', P16: '#FF00FF',
  A12: '#FF7F00', A4: '#FF0000',
};
export const FALLBACK_COLOR = '#666666';
