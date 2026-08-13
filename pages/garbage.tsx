import { useEffect, useState } from "react";
import Head from "next/head";
import type { ResolvedDaySchedule } from "@/types/garbage";
import GarbageSearchPanel from "@/components/garbage/GarbageSearchPanel";
import TodayTruckPanel from "@/components/garbage/TodayTruckPanel";
import CoverageNote from "@/components/garbage/CoverageNote";

interface Settings {
  contactPhone: string | null;
  contactNote: string | null;
}

export default function GarbagePage() {
  const [emptyWeekdays, setEmptyWeekdays] = useState<number[]>([]);
  const [settings, setSettings] = useState<Settings>({ contactPhone: null, contactNote: null });

  // ยิงครั้งเดียวตอนเปิด — ใช้รู้ว่าวันไหน "ไม่มีตารางเลย" (จาก /search อย่างเดียวแยกไม่ออก)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const [weekRes, settingsRes] = await Promise.all([
          fetch("/api/garbage/week"),
          fetch("/api/garbage/settings"),
        ]);
        const weekJson = await weekRes.json();
        const settingsJson = await settingsRes.json();
        if (!alive) return;
        if (weekRes.ok && Array.isArray(weekJson?.days)) {
          setEmptyWeekdays(
            (weekJson.days as ResolvedDaySchedule[])
              .filter((d) => d.assignments.length === 0)
              .map((d) => d.weekday)
          );
        }
        if (settingsRes.ok) {
          setSettings({
            contactPhone: settingsJson?.contactPhone ?? null,
            contactNote: settingsJson?.contactNote ?? null,
          });
        }
      } catch {
        // โหลดข้อมูลประกอบไม่ได้ก็ไม่เป็นไร — ช่องค้นหายังใช้งานได้ปกติ
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <Head>
        <title>ตารางรถเก็บขยะ | เทศบาลเมืองตาคลี</title>
        <meta name="description" content="ค้นหาว่ารถเก็บขยะเข้าถนนหรือชุมชนของคุณวันไหน เวลาไหน" />
      </Head>

      <div className="max-w-screen-sm mx-auto w-full space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">ตารางรถเก็บขยะ</h1>
          <p className="text-xs text-slate-500 mt-0.5">เทศบาลเมืองตาคลี · กองสาธารณสุขและสิ่งแวดล้อม</p>
        </div>

        <GarbageSearchPanel />
        <TodayTruckPanel />
        <CoverageNote
          emptyWeekdays={emptyWeekdays}
          contactPhone={settings.contactPhone}
          contactNote={settings.contactNote}
        />
      </div>
    </>
  );
}
