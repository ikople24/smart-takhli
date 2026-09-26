// pages/admin/flood-relief.tsx — แดชบอร์ดศูนย์ช่วยเหลือผู้ประสบภัยน้ำท่วม (โมดูล flood-relief · หน้าจอ 4)
// รายการคำขอ (ซ้าย) ↔ แผนที่ (กลาง) ↔ รายละเอียด (ขวา) sync ผ่าน useFloodReliefStore · โพลทุก 30 วิ
// < 1024px: สลับแท็บ รายการ/แผนที่ และรายละเอียดเปิดเป็นแผ่นเต็มจอ
// ?ticket=FL-0001 (ลิงก์จากการ์ด LINE) = เลือกคำขอนั้นให้ทันที
import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { List, Map as MapIcon } from "lucide-react";
import PermissionGuard from "@/components/PermissionGuard";
import KpiBar from "@/components/flood-relief/admin/KpiBar";
import RequestList from "@/components/flood-relief/admin/RequestList";
import RequestDetail from "@/components/flood-relief/admin/RequestDetail";
import type { AdminRequest, AdminTeam, AdminZone, FloodKpi, Me } from "@/components/flood-relief/admin/types";
import { useFloodReliefStore } from "@/stores/useFloodReliefStore";

const AdminMap = dynamic(() => import("@/components/flood-relief/admin/AdminMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#E9EEF5]" />,
});

const POLL_MS = 30_000;
const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export default function FloodReliefDashboard() {
  const router = useRouter();
  const { selectedId, select, mobileTab, setMobileTab } = useFloodReliefStore();
  const [items, setItems] = useState<AdminRequest[]>([]);
  const [kpi, setKpi] = useState<FloodKpi | null>(null);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [zones, setZones] = useState<AdminZone[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [centerOpen, setCenterOpen] = useState<boolean | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const pickedFromQuery = useRef(false);

  const load = useCallback(async () => {
    try {
      const [r, t, z] = await Promise.all([
        fetch("/api/flood-relief/requests"),
        fetch("/api/flood-relief/teams"),
        fetch("/api/flood-relief/zones"),
      ]);
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setError(j?.error || "โหลดรายการไม่สำเร็จ");
        return;
      }
      setItems(j.items ?? []);
      setKpi(j.kpi ?? null);
      setMe(j.me ?? null);
      setCenterOpen(Boolean(j.centerOpen));
      setLastAt(j.serverTime ?? new Date().toISOString());
      setError(null);
      if (t.ok) setTeams((await t.json()).teams ?? []);
      if (z.ok) setZones((await z.json()).zones ?? []);
    } catch {
      setError("เชื่อมต่อไม่ได้ — จะลองใหม่อัตโนมัติ");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // เปิดจากลิงก์ในการ์ด LINE (?ticket=)
  useEffect(() => {
    if (pickedFromQuery.current || !router.isReady || items.length === 0) return;
    const t = typeof router.query.ticket === "string" ? router.query.ticket.toUpperCase() : "";
    const hit = t ? items.find((r) => r.ticket === t) : null;
    if (hit) select(hit.id);
    pickedFromQuery.current = true;
  }, [router.isReady, router.query.ticket, items, select]);

  return (
    <PermissionGuard>
      <Head>
        <title>ศูนย์ช่วยเหลือน้ำท่วม · แดชบอร์ด</title>
      </Head>
      <div className="flex h-full min-h-0 flex-col bg-tk-bg font-tk-sans text-tk-ink">
        {/* Header */}
        <header className="flex min-h-[60px] shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-tk-line bg-white px-5 py-2">
          <Image src="/logoTK.png" alt="ตราเทศบาลเมืองตาคลี" width={36} height={36} className="object-contain" />
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-[1.2]">ศูนย์ช่วยเหลือผู้ประสบภัยน้ำท่วม</h1>
            <p className="text-[11px] text-tk-ink-4">แดชบอร์ดประสานงาน · เทศบาลเมืองตาคลี</p>
          </div>
          {centerOpen != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                centerOpen ? "bg-tk-overdue-soft text-tk-overdue-ink" : "bg-tk-unclaimed-soft text-tk-ink-3"
              }`}
            >
              <span className={`h-[7px] w-[7px] rounded-full ${centerOpen ? "bg-tk-overdue" : "bg-tk-ink-6"}`} />
              {centerOpen ? "เปิดศูนย์ฯ · รับคำขอทางเว็บ" : "ศูนย์ฯ ปิด · ไม่รับคำขอทางเว็บ"}
            </span>
          )}
          <span className="text-[11.5px] text-tk-ink-4">
            อัปเดตอัตโนมัติทุก 30 วิ{lastAt ? ` · ล่าสุด ${clockFmt.format(new Date(lastAt))}` : ""}
          </span>
          {error && <span className="text-[11.5px] font-semibold text-tk-overdue-ink">{error}</span>}
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/flood`;
              navigator.clipboard?.writeText(url).then(
                () => setLinkCopied(true),
                () => window.prompt("คัดลอกลิงก์นี้", url)
              );
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            title="หน้าติดตามสถานการณ์สาธารณะ — ส่งให้หน่วยงานอื่น/ผู้สนใจ (ไม่มีข้อมูลรายบ้าน)"
            className="ml-auto inline-flex h-9 items-center rounded-full bg-tk-unclaimed-soft px-3.5 text-[12.5px] font-semibold text-tk-ink-2"
          >
            {linkCopied ? "คัดลอกแล้ว" : "คัดลอกลิงก์สาธารณะ"}
          </button>
          {me?.isSuperAdmin && (
            <Link
              href="/admin/superadmin/flood-relief"
              className="inline-flex h-9 items-center rounded-full border-[1.5px] border-tk-flood px-3.5 text-[12.5px] font-bold text-tk-flood"
            >
              ตั้งค่าศูนย์ฯ
            </Link>
          )}
        </header>

        <KpiBar kpi={kpi} />

        {/* แท็บมือถือ */}
        <div className="flex shrink-0 gap-1 border-b border-tk-line bg-white p-1.5 lg:hidden">
          {(
            [
              ["list", "รายการ", List],
              ["map", "แผนที่", MapIcon],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={mobileTab === k}
              onClick={() => setMobileTab(k)}
              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-bold ${
                mobileTab === k ? "bg-tk-flood text-white" : "text-tk-ink-3"
              }`}
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1">
          <aside
            className={`${mobileTab === "list" ? "flex" : "hidden"} w-full shrink-0 flex-col border-r border-tk-line lg:flex lg:w-[340px]`}
          >
            <RequestList items={items} />
          </aside>

          <div className={`${mobileTab === "map" ? "block" : "hidden"} relative min-w-0 flex-1 lg:block`}>
            <AdminMap
              items={items}
              teams={teams}
              zones={zones}
              canEditZones={Boolean(me?.isSuperAdmin)}
              onZonesChanged={load}
            />
          </div>

          {/* แผงขวา — เดสก์ท็อปเป็นคอลัมน์ · มือถือเป็นแผ่นเต็มจอ */}
          {selectedId && (
            <aside className="fixed inset-0 z-[1000] overflow-y-auto bg-white lg:static lg:z-auto lg:w-[360px] lg:shrink-0 lg:border-l lg:border-tk-line">
              <RequestDetail key={selectedId} id={selectedId} me={me} onClose={() => select(null)} onChanged={load} />
            </aside>
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}
