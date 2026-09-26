// components/flood-relief/LocationPicker.tsx
// ขั้น 2 ของฟอร์ม: ขอ GPS → แผนที่ย่อ + ชื่อชุมชนที่ระบบเติมให้ · ปฏิเสธ/หมดเวลา → ปักหมุดเองบนแผนที่ (ศูนย์กลางเทศบาล)
// ชื่อชุมชนมาจาก reverse-geocode ฝั่ง server (basemap ชุมชนเดิม) — client ไม่เดาเอง
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Crosshair, LoaderCircle, MapPin } from "lucide-react";
import { accuracyTier, formatCoords, TAKHLI_CENTER, type LatLng } from "@/lib/flood-relief/geo";

const MiniMap = dynamic(() => import("./MiniMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#E6ECF4]" />,
});

export type PickedLocation = { point: LatLng; accuracyM: number | null };

type GpsState = "idle" | "locating" | "denied";

export default function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation | null;
  onChange: (v: PickedLocation | null) => void;
}) {
  const [gps, setGps] = useState<GpsState>("idle");
  const [manual, setManual] = useState(false); // เปิดแผนที่ให้ปักเองโดยยังไม่มีพิกัด
  const [expanded, setExpanded] = useState(false);
  const [community, setCommunity] = useState<string | null | undefined>(undefined); // undefined = กำลังหา

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGps("denied");
      setManual(true);
      return;
    }
    setGps("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps("idle");
        onChange({
          point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracyM: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
        });
      },
      () => {
        setGps("denied");
        setManual(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [onChange]);

  // ย้ายหมุดเอง = ความแม่นยำ GPS เดิมไม่มีความหมายแล้ว
  const move = useCallback((p: LatLng) => onChange({ point: p, accuracyM: null }), [onChange]);

  // เติมชื่อชุมชน — หน่วงเล็กน้อยกันยิงถี่ตอนลากหมุด
  const lat = value?.point.lat;
  const lng = value?.point.lng;
  useEffect(() => {
    if (lat == null || lng == null) return;
    setCommunity(undefined);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/flood-relief/public/reverse-geocode?lat=${lat}&lng=${lng}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setCommunity(j?.communityName ?? null))
        .catch(() => {});
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [lat, lng]);

  const showMap = value != null || manual;

  if (!showMap) {
    return (
      <div id="flood-location">
        <button
          type="button"
          onClick={locate}
          disabled={gps === "locating"}
          className="mt-2.5 flex h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl bg-tk-flood text-[15.5px] font-bold text-white shadow-tk-flood-btn disabled:opacity-80"
        >
          {gps === "locating" ? (
            <LoaderCircle size={22} className="animate-spin" aria-hidden />
          ) : (
            <Crosshair size={22} aria-hidden />
          )}
          {gps === "locating" ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบันของฉัน"}
        </button>
        <p className="mt-2 text-center text-[11.5px] text-tk-ink-4">
          ระบบจะขออนุญาตใช้ GPS · หรือ{" "}
          <button type="button" onClick={() => setManual(true)} className="font-semibold text-tk-flood underline">
            ปักหมุดบนแผนที่เอง
          </button>
        </p>
      </div>
    );
  }

  const tier = accuracyTier(value?.accuracyM);
  const center = value?.point ?? TAKHLI_CENTER;
  const height = expanded || !value ? 260 : 150;

  return (
    <div id="flood-location">
      {gps === "denied" && !value && (
        <p className="mt-2.5 rounded-xl bg-tk-due-soft px-3 py-2 text-[12px] leading-normal text-tk-due-ink">
          ใช้ GPS ไม่ได้ — แตะบนแผนที่ตรงจุดที่ต้องการความช่วยเหลือ
        </p>
      )}
      <div className="mt-2.5 overflow-hidden rounded-2xl border border-tk-flood-line bg-white shadow-tk-md">
        <div className="relative" style={{ height }}>
          <MiniMap point={center} accuracyM={value?.accuracyM ?? null} height={height} onMove={move} />
          {value && tier !== "manual" && (
            <span
              className={`pointer-events-none absolute left-2.5 top-2.5 z-[400] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold ${
                tier === "good" ? "text-tk-done-ink" : "text-tk-due-ink"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tier === "good" ? "bg-tk-done" : "bg-tk-due"}`} />
              GPS {tier === "good" ? "แม่นยำ" : "โดยประมาณ"} ± {value.accuracyM} ม.
            </span>
          )}
          {!value && (
            <span className="pointer-events-none absolute left-2.5 top-2.5 z-[400] rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold text-tk-flood">
              แตะแผนที่เพื่อปักหมุด
            </span>
          )}
          {value && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="absolute bottom-2.5 right-2.5 z-[400] min-h-8 rounded-full bg-white/95 px-3 text-[11px] font-semibold text-tk-flood shadow"
            >
              {expanded ? "เสร็จแล้ว" : "ขยับหมุด"}
            </button>
          )}
        </div>
        {value && (
          <div className="flex items-start gap-2.5 px-3.5 pb-3 pt-2.5">
            <MapPin size={18} className="mt-0.5 shrink-0 text-tk-flood" aria-hidden />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-[1.3]">
                {community === undefined ? "กำลังหาชื่อชุมชน…" : community ? `ชุมชน${community}` : "นอกเขตชุมชนที่ระบบรู้จัก"}
              </div>
              <div className="font-tk-mono text-[11px] leading-[1.4] text-tk-ink-4">
                {formatCoords(value.point)}
                <span className="font-tk-sans"> · ระบบเติมชื่อชุมชนจากพิกัดให้อัตโนมัติ</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {tier === "poor" && (
        <p className="mt-2 rounded-xl bg-tk-due-soft px-3 py-2 text-[12px] leading-normal text-tk-due-ink">
          ตำแหน่งอาจคลาดเคลื่อน ลองกด &ldquo;ขยับหมุด&rdquo; แล้วลากไปตรงบ้าน
        </p>
      )}
      {value && (
        <button type="button" onClick={locate} className="mt-2 min-h-9 text-[12px] font-semibold text-tk-flood underline">
          {gps === "locating" ? "กำลังหาตำแหน่ง…" : "หาตำแหน่งจาก GPS ใหม่"}
        </button>
      )}
    </div>
  );
}
