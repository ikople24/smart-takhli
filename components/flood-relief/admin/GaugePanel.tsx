// components/flood-relief/admin/GaugePanel.tsx — หน้าต่างจุดบนแผนที่ (วัดน้ำ / แจกน้ำดื่ม / รับบริจาค): รูปล่าสุด · ส่งรูปใหม่ · ประวัติ
// ส่งรูปได้ admin ทุกคน (ถ่ายจากมือถือหน้างานได้เลย) · ลบจุดได้เฉพาะ superadmin
import { useRef, useState } from "react";
import Image from "next/image";
import Swal from "sweetalert2";
import { Camera, ImageUp, LoaderCircle, Trash2, X } from "lucide-react";
import { uploadToCloudinary } from "@/utils/uploadToCloudinary";
import { POINT_KIND_META } from "@/lib/flood-relief/gauge";
import { thaiWhen } from "@/lib/flood-relief/time";
import type { AdminGauge } from "./types";

async function send(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  const res = await fetch(`/api/flood-relief/gauges/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || "บันทึกไม่สำเร็จ");
}

export default function GaugePanel({
  gauge,
  canDelete,
  onClose,
  onChanged,
}: {
  gauge: AdminGauge;
  canDelete: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  // 2 ช่อง: กล้อง (capture) กับอัลบั้ม — ช่องที่ใส่ capture มือถือจะเปิดกล้องทันทีโดยไม่ให้เลือกรูปเดิม (เจ้าของแจ้ง 2026-09-26)
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = POINT_KIND_META[gauge.kind] ?? POINT_KIND_META.gauge;
  const isGauge = gauge.kind === "gauge";

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadToCloudinary(file);
      if (!url) throw new Error("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
      await send("POST", `${gauge.id}/photos`, { url, levelCm: level === "" ? null : Number(level), note });
      pick(null);
      setLevel("");
      setNote("");
      onChanged();
      Swal.fire({ icon: "success", title: "ส่งรูประดับน้ำแล้ว", timer: 1200, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: "error", title: "ส่งรูปไม่สำเร็จ", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await Swal.fire({
      icon: "warning",
      title: `ลบ${meta.label} "${gauge.name}"?`,
      text: "ลบพร้อมประวัติรูปทั้งหมด — ถ้าแค่ไม่ใช้ชั่วคราวให้ปิดใช้งานแทน",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#B92544",
    });
    if (!ok.isConfirmed) return;
    try {
      await send("DELETE", gauge.id);
      onChanged();
      onClose();
    } catch (e) {
      Swal.fire({ icon: "error", title: "ลบไม่สำเร็จ", text: e instanceof Error ? e.message : String(e) });
    }
  };

  const toggleActive = async () => {
    try {
      await send("PATCH", gauge.id, { active: !gauge.active });
      onChanged();
    } catch (e) {
      Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`${meta.label} ${gauge.name}`}>
      <div className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl bg-white font-tk-sans text-tk-ink shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 z-[1] flex items-center gap-2 border-b border-tk-line bg-white px-4 py-3">
          <span className="text-[18px]" aria-hidden>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-bold">{gauge.name}</h2>
            <p className="text-[11px] font-semibold" style={{ color: meta.color }}>
              {meta.label}
              {gauge.source === "public" && <span className="ml-1.5 rounded-full bg-tk-due-soft px-1.5 py-px text-tk-due-ink">ปักโดยประชาชน — ตรวจสอบก่อนใช้</span>}
            </p>
            {gauge.note && <p className="truncate text-[11.5px] text-tk-ink-4">{gauge.note}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-8 w-8 items-center justify-center rounded-full bg-tk-unclaimed-soft">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="p-4">
          {/* รูปล่าสุด */}
          {gauge.lastPhotoUrl ? (
            <figure>
              <a href={gauge.lastPhotoUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-tk-bg">
                <Image src={gauge.lastPhotoUrl} alt={`ระดับน้ำล่าสุดที่ ${gauge.name}`} fill sizes="520px" className="object-cover" />
              </a>
              <figcaption className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px]">
                <b className={gauge.stale ? "text-tk-ink-4" : "text-tk-flood"}>ล่าสุด {thaiWhen(gauge.lastPhotoAt)}</b>
                {gauge.lastLevelCm != null && <span className="font-bold">· ระดับน้ำ {gauge.lastLevelCm} ซม.</span>}
                {gauge.stale && <span className="text-tk-due-ink">· เกิน 6 ชม. ควรส่งรูปใหม่</span>}
                {gauge.lastFromPublic && <span className="text-tk-due-ink">· ภาพจากประชาชน</span>}
                {gauge.lastNote && <span className="w-full text-tk-ink-3">{gauge.lastNote}</span>}
              </figcaption>
            </figure>
          ) : (
            <p className="rounded-xl bg-tk-bg px-3 py-6 text-center text-[12.5px] text-tk-ink-4">
              ยังไม่มีรูป{isGauge ? " — ส่งรูปแรกด้านล่าง" : " (ไม่บังคับ)"}
            </p>
          )}

          {/* ส่งรูปใหม่ */}
          <section className="mt-4 rounded-xl border-[1.5px] border-tk-flood bg-tk-flood-tint p-3">
            <h3 className="text-[13px] font-bold text-tk-flood-dark">{isGauge ? "ส่งรูประดับน้ำตอนนี้" : "อัปเดตรูปจุดนี้"}</h3>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0] ?? null);
                e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้
              }}
            />
            <input
              ref={albumRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {preview ? (
              <div className="relative mt-2 aspect-[4/3] overflow-hidden rounded-lg bg-tk-bg">
                {/* eslint-disable-next-line @next/next/no-img-element -- พรีวิว blob: ของไฟล์ในเครื่อง next/image ใช้ไม่ได้ */}
                <img src={preview} alt="รูปที่จะส่ง" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => pick(null)}
                  aria-label="เอารูปออก"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-tk-flood-line bg-white text-[13px] font-semibold text-tk-flood"
                >
                  <Camera size={18} aria-hidden />
                  ถ่ายรูป
                </button>
                <button
                  type="button"
                  onClick={() => albumRef.current?.click()}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-tk-flood-line bg-white text-[13px] font-semibold text-tk-flood"
                >
                  <ImageUp size={18} aria-hidden />
                  เลือกจากอัลบั้ม
                </button>
              </div>
            )}
            <div className={`mt-2 grid gap-2 ${isGauge ? "grid-cols-[110px_1fr]" : "grid-cols-1"}`}>
              <label className={isGauge ? "block" : "hidden"}>
                <span className="text-[11px] font-semibold text-tk-ink-3">ระดับน้ำ (ซม.)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1000}
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  placeholder="ไม่บังคับ"
                  className="mt-1 h-10 w-full rounded-lg border border-tk-line px-2 text-[13px] focus:border-tk-flood focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-tk-ink-3">หมายเหตุ</span>
                <input
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={isGauge ? "เช่น น้ำเริ่มลด รถเล็กผ่านได้" : "เช่น น้ำดื่มหมดแล้ว / รับถึง 18:00"}
                  className="mt-1 h-10 w-full rounded-lg border border-tk-line px-2 text-[13px] focus:border-tk-flood focus:outline-none"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!file || busy}
              onClick={submit}
              className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-tk-flood text-[14px] font-bold text-white disabled:opacity-50"
            >
              {busy && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
              {busy ? "กำลังส่ง…" : "ส่งรูป"}
            </button>
            <p className="mt-1.5 text-[10.5px] leading-normal text-tk-ink-4">
              รูปจะแสดงบนหน้าสถานการณ์สาธารณะ — ถ่ายให้เห็นระดับน้ำ หลีกเลี่ยงหน้าคนและบ้านเลขที่
            </p>
          </section>

          {/* ประวัติ */}
          {gauge.photos.length > 1 && (
            <section className="mt-4">
              <h3 className="text-[12px] font-bold text-tk-ink-4">ประวัติรูป</h3>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {gauge.photos.slice(1).map((p) => (
                  <a key={`${p.url}-${p.at}`} href={p.url} target="_blank" rel="noopener noreferrer" className="block">
                    <span className="relative block aspect-square overflow-hidden rounded-lg bg-tk-bg">
                      <Image src={p.url} alt={`ระดับน้ำ ${thaiWhen(p.at)}`} fill sizes="160px" className="object-cover" />
                    </span>
                    <span className="mt-0.5 block text-[10.5px] leading-tight text-tk-ink-4">
                      {thaiWhen(p.at)}
                      {p.levelCm != null ? ` · ${p.levelCm} ซม.` : ""}
                      {p.by ? <br /> : null}
                      {p.by}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-tk-line pt-3 text-[12px]">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" className="toggle toggle-sm" checked={gauge.active} onChange={toggleActive} />
              {gauge.active ? "แสดงบนแผนที่" : "ปิดใช้งาน (ซ่อน)"}
            </label>
            {canDelete && (
              <button type="button" onClick={remove} className="inline-flex items-center gap-1 font-semibold text-tk-overdue-ink">
                <Trash2 size={14} aria-hidden />
                ลบจุดนี้
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
