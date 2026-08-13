import { useEffect, useState } from "react";
import Link from "next/link";

interface LiveTruckLite {
  kind: string;
  live: { status: string };
}

/** การ์ดทางเข้าหน้า /garbage บนหน้าแรก — เพิ่มแบบ hardcode เพราะกริดเมนูดึงจาก backend ภายนอกและเปิดได้แค่ modal */
export default function GarbageHomeCard({ className = "" }: { className?: string }) {
  const [runningCount, setRunningCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/garbage/live");
        const json = await res.json();
        if (!alive || !res.ok) return;
        const trucks: LiveTruckLite[] = json?.trucks ?? [];
        setRunningCount(trucks.filter((t) => t.live?.status === "running").length);
      } catch {
        // เงียบไว้ — หน้าแรกไม่ควรมีกล่อง error
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link href="/garbage"
      className={"block rounded-xl shadow-md bg-white/30 backdrop-blur-md p-4 " +
        "hover:shadow-lg transition " + className}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">🚛</span>
        <div className="min-w-0">
          <div className="font-bold text-gray-700 text-sm">ตารางรถเก็บขยะ</div>
          <div className="text-xs text-gray-600 mt-0.5">
            {runningCount != null && runningCount > 0
              ? `ขณะนี้มีรถกำลังวิ่ง ${runningCount} คัน · กดดูตารางของคุณ`
              : "ค้นหาว่ารถเข้าถนนของคุณวันไหน"}
          </div>
        </div>
        <span aria-hidden className="ml-auto text-gray-400">›</span>
      </div>
    </Link>
  );
}
