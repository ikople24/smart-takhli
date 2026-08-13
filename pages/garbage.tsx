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
  // สองก้อนนี้ต้องพังแยกกันจริง: settings ล่ม (เช่น proxy คืน HTML 502 ทำให้ .json() reject)
  // ต้องไม่ทำให้แถบบอกวันที่รอข้อมูลหายไป เพราะกฎของโมดูลคือต้องบอกตรง ๆ ว่าวันไหนยังไม่มีตาราง
  useEffect(() => {
    let alive = true;

    const loadWeek = async () => {
      try {
        const res = await fetch("/api/garbage/week");
        const json = await res.json();
        if (!alive || !res.ok || !Array.isArray(json?.days)) return;
        setEmptyWeekdays(
          (json.days as ResolvedDaySchedule[])
            .filter((d) => d.assignments.length === 0)
            .map((d) => d.weekday)
        );
      } catch {
        // โหลดไม่ได้ก็ไม่แสดงแถบ — ช่องค้นหายังใช้งานได้ปกติ
      }
    };

    const loadSettings = async () => {
      try {
        const res = await fetch("/api/garbage/settings");
        const json = await res.json();
        if (!alive || !res.ok) return;
        setSettings({
          contactPhone: json?.contactPhone ?? null,
          contactNote: json?.contactNote ?? null,
        });
      } catch {
        // ไม่มีเบอร์ก็แสดงแถบได้ตามปกติ
      }
    };

    // แต่ละตัวมี try ของตัวเอง จึง reject ไม่ได้ — Promise.all ตรงนี้แค่ยิงขนานกัน
    Promise.all([loadWeek(), loadSettings()]);
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
