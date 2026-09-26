// pages/flood/index.tsx — หน้าติดตามสถานการณ์น้ำท่วมสาธารณะ (โมดูล flood-relief)
// ลิงก์สั้นให้หน่วยงานอื่น/ผู้สนใจติดตาม · ไม่ต้องล็อกอิน · **ห้ามเปลี่ยน path** หลังแชร์ออกไปแล้ว
// แสดงเฉพาะระดับ/โซนชุมชน/ตัวเลขรวม — ไม่มีหมุดหรือรายละเอียดคำขอรายบ้าน
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Camera, ChevronLeft, LoaderCircle, Navigation, Phone, Share2, TriangleAlert, X } from "lucide-react";
import CitizenShell from "@/components/citizen/CitizenShell";
import BaseMapToggle, { type BaseMap } from "@/components/flood-relief/BaseMapToggle";
import { TypeIcon } from "@/components/flood-relief/icons";
import PublicPointForm from "@/components/flood-relief/PublicPointForm";
import type { PublicGauge, PublicZone } from "@/components/flood-relief/PublicZoneMap";
import { POINT_KIND_META } from "@/lib/flood-relief/gauge";
import { googleMapsDirUrl, type LatLng } from "@/lib/flood-relief/geo";
import type { PublicStats } from "@/lib/flood-relief/publicStats";
import { DEFAULT_FLOOD_SETTINGS, telHref } from "@/lib/flood-relief/settings";
import { REQUEST_TYPE_META, REQUEST_TYPES } from "@/lib/flood-relief/status";
import { thaiWhen } from "@/lib/flood-relief/time";
import { SITUATION_META, ZONE_LEVELS, ZONE_META, type SituationLevel, type ZoneLevel } from "@/lib/flood-relief/zones";

const PublicZoneMap = dynamic(() => import("@/components/flood-relief/PublicZoneMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#E6ECF4]" />,
});

const REFRESH_MS = 60_000;

type Situation = {
  centerOpen: boolean;
  level: SituationLevel;
  updatedAt: string | null;
  hotline: string;
  announcement: string;
  zones: PublicZone[];
  stats: PublicStats;
  gauges: PublicGauge[];
};

export default function FloodSituationPage() {
  const [data, setData] = useState<Situation | null>(null);
  const [error, setError] = useState(false);
  const [baseMap, setBaseMap] = useState<BaseMap>("satellite");
  const [copied, setCopied] = useState(false);
  const [gaugeOpen, setGaugeOpen] = useState<PublicGauge | null>(null);
  // ประชาชนช่วยปักจุดวัดน้ำ: picking = รอแตะแผนที่ · newPoint = ได้ตำแหน่งแล้ว เปิดฟอร์ม · photoFor = ส่งรูปเข้าจุดเดิม
  const [picking, setPicking] = useState(false);
  const [newPoint, setNewPoint] = useState<LatLng | null>(null);
  const [photoFor, setPhotoFor] = useState<PublicGauge | null>(null);
  const [thanks, setThanks] = useState(false);
  const afterSubmit = () => {
    setNewPoint(null);
    setPhotoFor(null);
    setGaugeOpen(null);
    setThanks(true);
    setTimeout(() => setThanks(false), 3000);
    load();
  };

  const load = useCallback(() => {
    fetch("/api/flood-relief/public/situation", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        setData(j);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const hotline = data?.hotline ?? DEFAULT_FLOOD_SETTINGS.hotline;
  const situation = SITUATION_META[data?.level ?? "normal"] ?? SITUATION_META.normal;

  const share = async () => {
    const url = `${window.location.origin}/flood`;
    const text = "ติดตามสถานการณ์น้ำท่วม เทศบาลเมืองตาคลี";
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
      } catch {
        /* ผู้ใช้ยกเลิก */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("คัดลอกลิงก์นี้", url);
    }
  };

  const zonesByLevel = ZONE_LEVELS.map((l) => ({
    level: l,
    names: (data?.zones ?? []).filter((z) => z.level === l).map((z) => z.name).sort((a, b) => a.localeCompare(b, "th")),
  })).filter((g) => g.names.length > 0);

  return (
    <>
      <Head>
        <title>สถานการณ์น้ำท่วม · เทศบาลเมืองตาคลี</title>
        <meta name="description" content="ติดตามสถานการณ์น้ำท่วมเทศบาลเมืองตาคลี แผนที่ระดับน้ำรายชุมชนและการช่วยเหลือ อัปเดตอัตโนมัติ" />
        <meta property="og:title" content="สถานการณ์น้ำท่วม · เทศบาลเมืองตาคลี" />
        <meta property="og:description" content="แผนที่ระดับน้ำรายชุมชนและการช่วยเหลือผู้ประสบภัย อัปเดตอัตโนมัติ" />
      </Head>
      <CitizenShell hideNav>
        {/* หัวแดงฉุกเฉิน */}
        <div className="bg-tk-emergency px-4 pb-4 pt-2 text-white">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="กลับหน้าแรก" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full">
              <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={share}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[12px] font-semibold"
            >
              <Share2 size={14} aria-hidden />
              {copied ? "คัดลอกลิงก์แล้ว" : "แชร์ลิงก์"}
            </button>
          </div>
          <h1 className="mt-1 text-[22px] font-bold leading-tight">สถานการณ์น้ำท่วม</h1>
          <p className="text-[12.5px] text-white/85">เทศบาลเมืองตาคลี · อัปเดตอัตโนมัติทุก 1 นาที</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-bold">
              <span className="relative inline-block h-2.5 w-2.5">
                <span className="flood-ring absolute inset-0 rounded-full" style={{ background: situation.dot }} />
                <span className="absolute inset-0 rounded-full ring-[1.5px] ring-white" style={{ background: situation.dot }} />
              </span>
              ระดับ{situation.label}
            </span>
            {data?.updatedAt && <span className="text-[11.5px] text-white/80">อัปเดต {thaiWhen(data.updatedAt)}</span>}
          </div>
          {data?.announcement && (
            <p className="mt-3 flex gap-2 rounded-xl bg-black/15 px-3 py-2 text-[12.5px] leading-normal">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {data.announcement}
            </p>
          )}
        </div>

        {!data ? (
          <div className="flex justify-center py-16 text-tk-flood">
            {error ? (
              <p className="text-[13px] text-tk-overdue-ink">โหลดข้อมูลไม่สำเร็จ — จะลองใหม่อัตโนมัติ</p>
            ) : (
              <LoaderCircle className="animate-spin" aria-label="กำลังโหลด" />
            )}
          </div>
        ) : (
          <>
            {/* แผนที่โซน */}
            <section className="mx-4 mt-4 overflow-hidden rounded-[20px] border border-tk-line bg-white shadow-tk-md">
              <div className="relative h-[340px]">
                <PublicZoneMap
                  zones={data.zones}
                  gauges={data.gauges ?? []}
                  baseMap={baseMap}
                  onGauge={setGaugeOpen}
                  onPick={
                    picking
                      ? (p) => {
                          setPicking(false);
                          setNewPoint(p);
                        }
                      : null
                  }
                />
                {data.centerOpen && (
                  <button
                    type="button"
                    onClick={() => setPicking((v) => !v)}
                    className={`absolute right-2.5 top-2.5 z-[400] inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold shadow ${
                      picking ? "bg-tk-ink-strong text-white" : "bg-tk-flood text-white"
                    }`}
                  >
                    <Camera size={15} aria-hidden />
                    {picking ? "ยกเลิก" : "ปักจุดวัดน้ำ"}
                  </button>
                )}
                {picking && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-3 z-[400] mx-auto w-fit rounded-full bg-tk-ink-strong px-3.5 py-1.5 text-[12px] font-semibold text-white shadow">
                    📍 แตะแผนที่ตรงจุดที่ถ่ายรูประดับน้ำ
                  </span>
                )}
                {thanks && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-3 z-[400] mx-auto w-fit rounded-full bg-tk-done px-3.5 py-1.5 text-[12px] font-semibold text-white shadow">
                    ขอบคุณที่ช่วยส่งข้อมูล 🙏
                  </span>
                )}
                <BaseMapToggle value={baseMap} onChange={setBaseMap} className="absolute left-2.5 top-2.5 z-[400] bg-white/95 shadow" />
                {data.zones.length === 0 && (
                  <span className="pointer-events-none absolute inset-x-0 top-12 z-[400] mx-auto w-fit rounded-full bg-white/95 px-3 py-1 text-[12px] font-semibold text-tk-done-ink shadow">
                    ยังไม่มีพื้นที่ประกาศเฝ้าระวัง
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-tk-line px-3.5 py-2.5 text-[11.5px] font-semibold">
                {ZONE_LEVELS.map((l) => (
                  <span key={l} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: ZONE_META[l].fill, opacity: 0.75 }} />
                    {ZONE_META[l].label}
                  </span>
                ))}
              </div>
            </section>

            {/* จุดวัดระดับน้ำ — รูปล่าสุดจากเจ้าหน้าที่ */}
            {(data.gauges ?? []).some((g) => g.kind === "gauge") && (
              <section className="mx-4 mt-3">
                <h2 className="text-[14px] font-bold">📷 ระดับน้ำล่าสุดจากจุดวัด</h2>
                <div className="mt-2 flex snap-x gap-2.5 overflow-x-auto pb-1">
                  {data.gauges.filter((g) => g.kind === "gauge").map((g) => (
                    <button
                      key={`${g.name}-${g.photoAt}`}
                      type="button"
                      onClick={() => setGaugeOpen(g)}
                      className="w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left shadow-tk-md"
                    >
                      <span className="relative block aspect-[4/3] bg-tk-bg">
                        {g.photoUrl ? (
                          <Image src={g.photoUrl} alt={`ระดับน้ำที่ ${g.name}`} fill sizes="150px" className="object-cover" />
                        ) : (
                          <span className="flex h-full items-center justify-center text-[11px] text-tk-ink-4">ยังไม่มีรูป</span>
                        )}
                        {g.levelCm != null && (
                          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-tk-flood px-2 py-0.5 text-[11px] font-bold text-white">
                            {g.levelCm} ซม.
                          </span>
                        )}
                        {g.photoFromPublic && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9.5px] font-semibold text-white">
                            ภาพจากประชาชน
                          </span>
                        )}
                      </span>
                      <span className="block px-2.5 py-2">
                        <span className="block truncate text-[12.5px] font-bold">{g.name}</span>
                        <span className={`block text-[10.5px] ${g.stale ? "text-tk-due-ink" : "text-tk-ink-4"}`}>
                          {g.photoAt ? thaiWhen(g.photoAt) : "-"}
                          {g.stale && g.photoAt ? " · อาจไม่ใช่ปัจจุบัน" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* จุดแจกน้ำดื่ม / จุดรับบริจาค — ปักโดยเจ้าหน้าที่เท่านั้น */}
            {(["water", "donation"] as const).map((k) => {
              const list = (data.gauges ?? []).filter((g) => g.kind === k);
              if (!list.length) return null;
              const meta = POINT_KIND_META[k];
              return (
                <section key={k} className="mx-4 mt-3 rounded-[20px] bg-white p-4 shadow-tk-md">
                  <h2 className="text-[14px] font-bold">
                    {meta.icon} {meta.label} ({list.length})
                  </h2>
                  <ul className="mt-2 flex flex-col gap-2">
                    {list.map((g) => (
                      <li key={g.id} className="flex items-center gap-3 rounded-xl bg-tk-bg px-3 py-2.5">
                        <button type="button" onClick={() => setGaugeOpen(g)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[13px] font-bold">{g.name}</span>
                          {(g.photoNote || g.note) && (
                            <span className="block text-[11.5px] leading-snug text-tk-ink-3">{g.photoNote || g.note}</span>
                          )}
                        </button>
                        {g.lat != null && g.lng != null && (
                          <a
                            href={googleMapsDirUrl({ lat: g.lat, lng: g.lng })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-bold text-white"
                            style={{ background: meta.color }}
                          >
                            <Navigation size={13} aria-hidden />
                            นำทาง
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {/* ตัวเลขรวม */}
            <section className="mx-4 mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  ["รอความช่วยเหลือ", data.stats.waiting, "bg-tk-overdue-soft text-tk-overdue-ink"],
                  ["กำลังช่วยเหลือ", data.stats.helping, "bg-tk-due-soft text-tk-due-ink"],
                  ["ช่วยเหลือแล้ว", data.stats.doneTotal, "bg-tk-done-soft text-tk-done-ink"],
                ] as const
              ).map(([label, n, cls]) => (
                <div key={label} className={`rounded-2xl px-3 py-3 text-center ${cls}`}>
                  <div className="text-[24px] font-bold leading-none tabular-nums">{n}</div>
                  <div className="mt-1 text-[11.5px] font-semibold">{label}</div>
                </div>
              ))}
            </section>
            <p className="mx-4 mt-1.5 text-right text-[11px] text-tk-ink-4">ช่วยเหลือเสร็จวันนี้ {data.stats.doneToday} ราย</p>

            <section className="mx-4 mt-2 rounded-[20px] bg-white p-4 shadow-tk-md">
              <h2 className="text-[14px] font-bold">คำขอที่ยังดำเนินการ แยกตามเรื่อง</h2>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {REQUEST_TYPES.map((t) => (
                  <div key={t} className="flex items-center gap-2.5 rounded-xl bg-tk-bg px-3 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tk-flood-soft text-tk-flood">
                      <TypeIcon type={t} size={20} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{REQUEST_TYPE_META[t].label}</span>
                    <span className="text-[16px] font-bold tabular-nums">{data.stats.openByType[t]}</span>
                  </div>
                ))}
              </div>
            </section>

            {zonesByLevel.length > 0 && (
              <section className="mx-4 mt-3 rounded-[20px] bg-white p-4 shadow-tk-md">
                <h2 className="text-[14px] font-bold">พื้นที่ตามระดับ</h2>
                <ul className="mt-2 flex flex-col gap-2">
                  {zonesByLevel.map((g) => (
                    <li key={g.level} className="text-[12.5px]">
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: ZONE_META[g.level as ZoneLevel].fill }} />
                        {ZONE_META[g.level as ZoneLevel].label}
                        <span className="font-normal text-tk-ink-4">· {ZONE_META[g.level as ZoneLevel].meaning}</span>
                      </span>
                      <div className="mt-0.5 leading-normal text-tk-ink-2">{g.names.join(" · ")}</div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mx-4 mb-8 mt-3 grid grid-cols-2 gap-2.5">
              <a
                href={telHref(hotline)}
                className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-tk-flood bg-white text-[13.5px] font-bold text-tk-flood"
              >
                <Phone size={18} aria-hidden />
                โทร {hotline}
              </a>
              {data.centerOpen ? (
                <Link
                  href="/flood/request"
                  className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-tk-emergency text-[13.5px] font-bold text-white shadow-tk-emergency"
                >
                  <TriangleAlert size={18} aria-hidden />
                  ขอความช่วยเหลือ
                </Link>
              ) : (
                <span className="flex h-[50px] items-center justify-center rounded-[14px] bg-tk-unclaimed-soft px-2 text-center text-[12px] font-semibold text-tk-ink-3">
                  ศูนย์ฯ ปิดรับทางเว็บ — โทรแทน
                </span>
              )}
            </section>
          </>
        )}
        {gaugeOpen && (
          <div
            className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`ระดับน้ำที่ ${gaugeOpen.name}`}
            onClick={() => setGaugeOpen(null)}
          >
            <div className="w-full max-w-[480px] overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[15px] font-bold">
                    {POINT_KIND_META[gaugeOpen.kind]?.icon ?? "📷"} {gaugeOpen.name}
                  </h2>
                  {gaugeOpen.note && <p className="truncate text-[11.5px] text-tk-ink-4">{gaugeOpen.note}</p>}
                </div>
                <button type="button" onClick={() => setGaugeOpen(null)} aria-label="ปิด" className="flex h-8 w-8 items-center justify-center rounded-full bg-tk-unclaimed-soft">
                  <X size={16} aria-hidden />
                </button>
              </div>
              {gaugeOpen.photoUrl ? (
                <div className="relative aspect-[4/3] bg-tk-bg">
                  <Image src={gaugeOpen.photoUrl} alt={`ระดับน้ำที่ ${gaugeOpen.name}`} fill sizes="480px" className="object-cover" />
                </div>
              ) : (
                <p className="bg-tk-bg px-4 py-10 text-center text-[13px] text-tk-ink-4">ยังไม่มีรูปจากจุดนี้</p>
              )}
              <div className="px-4 py-3 text-[12.5px]">
                <div className="flex flex-wrap items-center gap-x-2">
                  <b>{gaugeOpen.photoAt ? `ถ่ายเมื่อ ${thaiWhen(gaugeOpen.photoAt)}` : "ยังไม่มีข้อมูล"}</b>
                  {gaugeOpen.levelCm != null && <span className="font-bold text-tk-flood">· ระดับน้ำ {gaugeOpen.levelCm} ซม.</span>}
                </div>
                {gaugeOpen.stale && gaugeOpen.photoAt && (
                  <p className="mt-1 text-[11.5px] text-tk-due-ink">รูปนี้เกิน 6 ชั่วโมงแล้ว สภาพจริงอาจเปลี่ยนไป</p>
                )}
                {gaugeOpen.photoNote && <p className="mt-1 text-tk-ink-3">{gaugeOpen.photoNote}</p>}
                {gaugeOpen.photoFromPublic && <p className="mt-1 text-[11px] text-tk-ink-4">ภาพจากประชาชน</p>}
                <div className="mt-3 flex gap-2">
                  {gaugeOpen.kind === "gauge" && data?.centerOpen && (
                    <button
                      type="button"
                      onClick={() => setPhotoFor(gaugeOpen)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-tk-flood text-[13px] font-bold text-white"
                    >
                      <Camera size={16} aria-hidden />
                      ส่งรูปอัปเดต
                    </button>
                  )}
                  {gaugeOpen.lat != null && gaugeOpen.lng != null && (
                    <a
                      href={googleMapsDirUrl({ lat: gaugeOpen.lat, lng: gaugeOpen.lng })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-tk-flood text-[13px] font-bold text-tk-flood"
                    >
                      <Navigation size={15} aria-hidden />
                      นำทาง
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {newPoint && <PublicPointForm mode="new" point={newPoint} onClose={() => setNewPoint(null)} onDone={afterSubmit} />}
        {photoFor && (
          <PublicPointForm
            mode="photo"
            gaugeId={photoFor.id}
            gaugeName={photoFor.name}
            onClose={() => setPhotoFor(null)}
            onDone={afterSubmit}
          />
        )}
      </CitizenShell>
    </>
  );
}
