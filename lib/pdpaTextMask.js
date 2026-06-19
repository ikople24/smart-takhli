/**
 * PDPA ข้อความ — ใช้ช่วงที่เจ้าหน้าที่ระบุ (ลากเลือกแล้วซ่อน) ไม่มี dependency ฝั่งเซิร์ฟเวอร์
 */

/**
 * รวมช่วงที่ทับซ้อน และจำกัดให้อยู่ในความยาวข้อความ
 * @param {Array<{ start: number, end: number }>} redactions
 * @param {number} detailLength
 */
export function normalizeDetailRedactions(redactions, detailLength) {
  const len = Math.max(0, Math.floor(Number(detailLength)) || 0);
  if (!Array.isArray(redactions) || len === 0) return [];

  const raw = redactions
    .map((r) => ({
      start: Math.floor(Number(r?.start)),
      end: Math.floor(Number(r?.end)),
    }))
    .filter(
      (r) =>
        Number.isFinite(r.start) &&
        Number.isFinite(r.end) &&
        r.end > r.start
    )
    .map((r) => ({
      start: Math.max(0, Math.min(r.start, len)),
      end: Math.max(0, Math.min(r.end, len)),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged = [];
  for (const r of raw) {
    if (!merged.length) {
      merged.push({ ...r });
      continue;
    }
    const prev = merged[merged.length - 1];
    if (r.start <= prev.end) prev.end = Math.max(prev.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/**
 * แทนที่ช่วงที่ระบุด้วย * (แก้จากท้ายไปหน้าเพื่อไม่ให้ index เพี้ยน)
 */
export function applyDetailRedactions(detail, redactions) {
  if (detail == null || typeof detail !== "string") return detail;
  const merged = normalizeDetailRedactions(redactions, detail.length);
  if (!merged.length) return detail;

  let result = detail;
  for (let i = merged.length - 1; i >= 0; i--) {
    const { start, end } = merged[i];
    const span = end - start;
    const stars = "*".repeat(Math.min(Math.max(span, 4), 48));
    result = result.slice(0, start) + stars + result.slice(end);
  }
  return result;
}

/** @deprecated ใช้การซ่อนคำแบบเลือกช่วงแทน — เก็ไว้เผื่อเรียกใช้ที่อื่น */
const DEFAULT_MASK_WORDS = ["ควย", "เหี้ย", "สัส", "fuck", "shit"];

function parseCommaList(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,|]/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export function getMaskWordList() {
  const fromServer = parseCommaList(process.env.PDPA_MASK_WORDS);
  const fromPublic = parseCommaList(process.env.NEXT_PUBLIC_PDPA_MASK_WORDS);
  return [...new Set([...DEFAULT_MASK_WORDS, ...fromServer, ...fromPublic])];
}

export function maskSensitiveWords(text, words = getMaskWordList()) {
  if (text == null || typeof text !== "string" || !words.length) return text;
  let result = text;
  for (const word of words) {
    if (!word) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      result = result.replace(
        new RegExp(escaped, "gi"),
        (m) => "*".repeat(Math.max(4, Math.min(m.length, 12)))
      );
    } catch {
      /* ignore */
    }
  }
  return result;
}
