import {
  PIPE_MATERIALS,
  type MaterialLetter,
  type MaterialCode,
  type DiameterUnit,
} from './constants';

const CODE_RE = /^([AGHPSR])(\d+(?:\.\d+)?)$/;

export type ParseResult =
  | {
      ok: true;
      material: MaterialCode;
      diameter: { value: number; unit: DiameterUnit };
      diameterMm: number;
      diameterBasis: 'nominal' | 'internal';
    }
  | { ok: false; error: string };

export function toMm(value: number, unit: DiameterUnit): number {
  if (unit === 'inch') return Number((value * 25.4).toFixed(1));
  if (unit === 'cm') return value * 10;
  return value;
}

export function parsePipeCode(raw: string): ParseResult {
  const m = CODE_RE.exec(String(raw ?? '').trim().toUpperCase());
  if (!m) return { ok: false, error: `รหัสท่อไม่ถูกต้อง: "${raw}"` };

  const spec = PIPE_MATERIALS[m[1] as MaterialLetter];
  const value = Number(m[2]);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `ขนาดท่อไม่ถูกต้อง: "${raw}"` };
  }

  return {
    ok: true,
    material: spec.code,
    diameter: { value, unit: spec.unit },
    diameterMm: toMm(value, spec.unit),
    diameterBasis: spec.basis,
  };
}

export function buildPipeCode(material: MaterialCode, value: number): string {
  const entry = Object.entries(PIPE_MATERIALS).find(
    ([, v]) => v.code === material
  );
  if (!entry) throw new Error(`ไม่รู้จักชนิดท่อ: ${material}`);
  // String(6.0) === "6" อยู่แล้ว จึงไม่ต้องแยกกรณีจำนวนเต็ม
  return `${entry[0]}${String(value)}`;
}

export function materialSpec(material: MaterialCode) {
  const entry = Object.values(PIPE_MATERIALS).find((v) => v.code === material);
  if (!entry) throw new Error(`ไม่รู้จักชนิดท่อ: ${material}`);
  return entry;
}
