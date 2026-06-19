// lib/liff.ts
// LINE LIFF (LINE Front-end Framework) utility
//
// ใช้ dynamic import เพราะ:
//   1. LIFF SDK ใหญ่ (~500KB) — lazy-load เฉพาะเมื่อต้องการ
//   2. ต้องรัน client-side เท่านั้น (window ต้องพร้อม)
//
// ENV ที่ต้องตั้งใน .env.local:
//   NEXT_PUBLIC_LIFF_ID — LIFF ID จาก LINE Developers Console
//
// การใช้งาน:
//   import { initLiff, isLiffLoggedIn, getLiffProfile, liffLogin } from '@/lib/liff'
//
//   const ok = await initLiff()
//   if (ok && isLiffLoggedIn()) {
//     const profile = await getLiffProfile()
//     // { userId, displayName, pictureUrl }
//   } else {
//     liffLogin()  // redirect ไป LINE Login
//   }

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl: string;
  statusMessage?: string;
}

let liffInstance: typeof import('@line/liff')['default'] | null = null;
let initialized = false;

/**
 * โหลดและ initialize LIFF SDK
 * - ถ้า init แล้วจะ return true ทันที (no-op)
 * - ถ้า NEXT_PUBLIC_LIFF_ID ไม่ได้ตั้ง → return false
 */
export async function initLiff(): Promise<boolean> {
  if (initialized && liffInstance) return true;
  if (typeof window === 'undefined') return false;

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    console.warn('[LIFF] NEXT_PUBLIC_LIFF_ID is not set — LIFF disabled');
    return false;
  }

  try {
    const liffModule = await import('@line/liff');
    liffInstance = liffModule.default;
    await liffInstance.init({ liffId });
    initialized = true;
    return true;
  } catch (err) {
    console.error('[LIFF] init failed:', err);
    return false;
  }
}

/**
 * ตรวจสอบว่า user login LINE แล้วหรือยัง
 * ต้องเรียก initLiff() ก่อน
 */
export function isLiffLoggedIn(): boolean {
  return liffInstance?.isLoggedIn() ?? false;
}

/**
 * ตรวจสอบว่าเปิดจากใน LINE app หรือไม่
 * ต้องเรียก initLiff() ก่อน
 */
export function isInLineApp(): boolean {
  return liffInstance?.isInClient() ?? false;
}

/**
 * ดึง LINE profile ของ user ที่ login แล้ว
 * ต้องเรียก initLiff() และ isLiffLoggedIn() === true ก่อน
 */
export async function getLiffProfile(): Promise<LiffProfile | null> {
  if (!liffInstance || !liffInstance.isLoggedIn()) return null;
  try {
    const profile = await liffInstance.getProfile();
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? '',
      statusMessage: profile.statusMessage,
    };
  } catch (err) {
    console.error('[LIFF] getProfile failed:', err);
    return null;
  }
}

/**
 * เริ่ม LINE Login flow (redirect ไป LINE OAuth แล้วกลับมา)
 * เรียกหลัง initLiff() เสมอ
 */
export function liffLogin(): void {
  if (!liffInstance) {
    console.warn('[LIFF] liffLogin called before initLiff()');
    return;
  }
  liffInstance.login();
}
