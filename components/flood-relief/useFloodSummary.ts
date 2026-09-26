// components/flood-relief/useFloodSummary.ts
// อ่าน GET /api/flood-relief/public/summary — ใช้ทั้งบล็อกหน้าแรกและหัวฟอร์ม (เบอร์ศูนย์ฯ)
// โหลดพลาด = คงค่าเดิม/null เงียบ ๆ (หน้าแรกไม่โชว์ error ตาม README)
//
// ดึงใหม่เองเมื่อ: กลับมาที่แท็บ · กลับมาด้วยปุ่ม Back (bfcache คืนหน้าเก่าโดยไม่รัน effect ใหม่) · ทุก 60 วิ
// ระดับสถานการณ์/เปิด-ปิดศูนย์ฯ ต้องเห็นผลโดยไม่ต้องให้ประชาชนกดรีเฟรชเอง
import { useEffect, useState } from "react";
import type { SituationLevel } from "@/lib/flood-relief/zones";

export type FloodSummary = {
  centerOpen: boolean;
  level: SituationLevel;
  updatedAt: string | null;
  hotline: string;
  callbackSlaMin: number;
  announcement: string;
};

const REFRESH_MS = 60_000;

export function useFloodSummary(): { summary: FloodSummary | null; loaded: boolean } {
  const [summary, setSummary] = useState<FloodSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/flood-relief/public/summary", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (alive && j) setSummary(j);
        })
        .catch(() => {})
        .finally(() => alive && setLoaded(true));

    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    const onPageShow = (e: PageTransitionEvent) => e.persisted && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return { summary, loaded };
}
