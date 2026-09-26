// components/flood-relief/useFloodSummary.ts
// อ่าน GET /api/flood-relief/public/summary — ใช้ทั้งบล็อกหน้าแรกและหัวฟอร์ม (เบอร์ศูนย์ฯ)
// โหลดพลาด = null เงียบ ๆ (หน้าแรกไม่โชว์ error ตาม README)
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

export function useFloodSummary(): { summary: FloodSummary | null; loaded: boolean } {
  const [summary, setSummary] = useState<FloodSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/flood-relief/public/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setSummary(j))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);
  return { summary, loaded };
}
