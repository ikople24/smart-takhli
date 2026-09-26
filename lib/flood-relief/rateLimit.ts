// lib/flood-relief/rateLimit.ts
// กันสแปมฟอร์มสาธารณะ (ไม่มี captcha เพราะผู้ประสบภัยต้องส่งได้เร็วที่สุด): ต่อ IP + ต่อเบอร์ ≤ 5 คำขอ/ชม.
// นับจาก flood_requests ตรง ๆ (index clientIp/phone + createdAt) — ไม่ต้องมี store แยก และรอด restart

export const RATE_LIMIT = Object.freeze({ max: 5, windowMin: 60 });

type HeaderBag = Record<string, string | string[] | undefined>;

/**
 * IP ของผู้ส่ง: ตัวแรกของ x-forwarded-for (Railway proxy ใส่ให้) → x-real-ip → socket
 * ตัดพอร์ต/prefix IPv6-mapped ให้ IP เดียวกันนับรวมกัน
 */
export function clientIp(headers: HeaderBag, socketAddress?: string | null): string {
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const raw = pick(headers["x-forwarded-for"]).split(",")[0].trim() || pick(headers["x-real-ip"]).trim() || socketAddress || "";
  return raw.replace(/^::ffff:/, "").replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
}

export function rateLimitSince(now: Date = new Date()): Date {
  return new Date(now.getTime() - RATE_LIMIT.windowMin * 60 * 1000);
}

/** IP ว่าง (หาไม่ได้) ไม่นับ — ไม่งั้นทุกคนที่หา IP ไม่ได้จะถูกรวมเป็นคนเดียว */
export function isRateLimited(counts: { byIp: number; byPhone: number }, ipKnown = true): boolean {
  return (ipKnown && counts.byIp >= RATE_LIMIT.max) || counts.byPhone >= RATE_LIMIT.max;
}
