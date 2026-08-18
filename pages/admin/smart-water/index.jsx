// ทะเบียนท่อประปา (กองการประปา) — แผนที่แนวท่อ + อุปกรณ์ อ่านอย่างเดียวในเฟส 1
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import PermissionGuard from "@/components/PermissionGuard";
import PipeLegend from "@/components/smart-water/PipeLegend";

// มี leaflet ข้างใน — โหลดเฉพาะฝั่ง client
const WaterMap = dynamic(() => import("@/components/smart-water/WaterMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-slate-500">
      กำลังโหลดแผนที่...
    </div>
  ),
});

export default function SmartWaterPage() {
  const [pipes, setPipes] = useState(null);
  const [nodes, setNodes] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pRes, nRes] = await Promise.all([
          fetch("/api/smart-water/pipes?format=geojson"),
          fetch("/api/smart-water/nodes?format=geojson"),
        ]);
        if (!pRes.ok || !nRes.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ");
        const [p, n] = await Promise.all([pRes.json(), nRes.json()]);
        if (cancelled) return;
        setPipes(p);
        setNodes(n);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("โหลดข้อมูลไม่สำเร็จ");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loaded = pipes && nodes;

  return (
    <PermissionGuard>
      <Head>
        <title>ทะเบียนท่อประปา | Smart Takhli</title>
      </Head>
      <div className="flex h-screen flex-col">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              🚰 ทะเบียนท่อประปา
            </h1>
            <p className="text-xs text-slate-500">
              เทศบาลเมืองตาคลี · กองการประปา
              {loaded &&
                ` · ท่อ ${pipes.features.length} เส้น · อุปกรณ์ ${nodes.features.length} จุด`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/smart-water/report"
              className="rounded-md bg-teal-600 px-3 py-1.5 text-sm text-white hover:bg-teal-700"
            >
              รายงานความยาวท่อ
            </Link>
            <Link
              href="/admin/dashboard"
              className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← กลับ
            </Link>
          </div>
        </header>
        <div className="relative flex-1">
          {error && (
            <div className="flex h-full items-center justify-center text-red-600">
              {error}
            </div>
          )}
          {!error && !loaded && (
            <div className="flex h-full items-center justify-center text-slate-500">
              กำลังโหลดข้อมูล...
            </div>
          )}
          {!error && loaded && <WaterMap pipes={pipes} nodes={nodes} />}
          <PipeLegend />
        </div>
      </div>
    </PermissionGuard>
  );
}
