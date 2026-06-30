// ParcelCode = ZONE(2 ตัวเลข) + BLOCK(1 อักษร) + SEQ(ตัวเลข) + suffix /NNN /NN /N (pure)
export interface ParsedCode { zone: string; block: string; seq: string; suffixes: string[]; }

export function parseParcelCode(code: string | null | undefined): ParsedCode | null {
  if (!code || typeof code !== "string") return null;
  const m = code.match(/^(\d{2})([A-Za-z])(\d+)((?:\/[^/]+)*)$/);
  if (!m) return null;
  const suffixes = m[4] ? m[4].split("/").filter(Boolean) : [];
  return { zone: m[1], block: m[2].toUpperCase(), seq: m[3], suffixes };
}

// seq ถัดไปในบล็อก (เช่น "02B"); นับ base seq รวมรหัสที่มี suffix ด้วย (02B120/001 = 120 ถูกใช้แล้ว); คืน "02B121"
export function nextBlockSeq(zoneBlock: string, existingCodes: string[]): string {
  const re = new RegExp(`^${zoneBlock}(\\d+)`);
  let max = 0;
  for (const c of existingCodes) {
    const m = c.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `${zoneBlock}${String(next).padStart(3, "0")}`;
}

// suffix ของชั้น: parent ไม่มี "/" → 3 หลัก, มี 1 "/" → 2 หลัก, มี 2 "/" → 1 หลัก
function suffixWidth(parentCode: string): number {
  const slashes = (parentCode.match(/\//g) || []).length;
  return slashes === 0 ? 3 : slashes === 1 ? 2 : 1;
}

// รหัสลูกถัดไปใต้ parent (direct child เท่านั้น)
export function nextSuffix(parentCode: string, existingChildCodes: string[]): string {
  const width = suffixWidth(parentCode);
  const prefix = parentCode + "/";
  let max = 0;
  for (const c of existingChildCodes) {
    if (!c.startsWith(prefix)) continue;
    const rest = c.slice(prefix.length);
    if (rest.includes("/")) continue; // ลูกตรงเท่านั้น
    const n = parseInt(rest, 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${parentCode}/${String(max + 1).padStart(width, "0")}`;
}
