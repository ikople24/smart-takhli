// components/flood-relief/PublicPointForm.tsx — ฟอร์มประชาชนบนหน้า /flood: ปักจุดวัดน้ำใหม่ หรือส่งรูปอัปเดตเข้าจุดเดิม
// รูปบังคับ (จุดไม่มีรูปไม่มีประโยชน์ + กันสแปม) · กล้อง/อัลบั้มแยกปุ่ม (capture ทำให้เลือกอัลบั้มไม่ได้)
// รูปขึ้นสาธารณะทันทีพร้อมป้าย "ภาพจากประชาชน"
import { useRef, useState } from "react";
import { Camera, ImageUp, LoaderCircle, X } from "lucide-react";
import { uploadToCloudinary } from "@/utils/uploadToCloudinary";
import type { LatLng } from "@/lib/flood-relief/geo";

type Props =
  | { mode: "new"; point: LatLng; onClose: () => void; onDone: () => void }
  | { mode: "photo"; gaugeId: string; gaugeName: string; onClose: () => void; onDone: () => void };

export default function PublicPointForm(props: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    setError(null);
  };
  const ready = !!file && (props.mode === "photo" || name.trim().length > 0);

  const submit = async () => {
    if (!ready || !file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadToCloudinary(file);
      if (!url) throw new Error("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
      const levelCm = level === "" ? null : Number(level);
      const res =
        props.mode === "new"
          ? await fetch("/api/flood-relief/public/gauges", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: name.trim(),
                lat: props.point.lat,
                lng: props.point.lng,
                url,
                levelCm,
                photoNote: note,
              }),
            })
          : await fetch(`/api/flood-relief/public/gauges/${props.gaugeId}/photos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url, levelCm, note }),
            });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "ส่งไม่สำเร็จ");
      props.onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "h-11 w-full rounded-xl border border-tk-line px-3 text-[14px] focus:border-tk-flood focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ส่งรูประดับน้ำ"
    >
      <div className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-[16px] font-bold">
            {props.mode === "new" ? "📷 ปักจุดวัดระดับน้ำ" : `📷 ส่งรูปอัปเดต · ${props.gaugeName}`}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="ปิด"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-tk-unclaimed-soft"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {props.mode === "new" && (
          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-tk-ink-3">ชื่อจุด *</span>
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ถนนหน้าตลาด / สะพานข้ามคลอง"
              className={`mt-1 ${input}`}
            />
          </label>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0] ?? null);
            e.target.value = "";
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
        <div className="mt-3 text-[12px] font-semibold text-tk-ink-3">รูประดับน้ำ *</div>
        {preview ? (
          <div className="relative mt-1 aspect-[4/3] overflow-hidden rounded-xl bg-tk-bg">
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
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-tk-flood-line text-[13px] font-semibold text-tk-flood"
            >
              <Camera size={18} aria-hidden />
              ถ่ายรูป
            </button>
            <button
              type="button"
              onClick={() => albumRef.current?.click()}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-tk-flood-line text-[13px] font-semibold text-tk-flood"
            >
              <ImageUp size={18} aria-hidden />
              เลือกจากอัลบั้ม
            </button>
          </div>
        )}

        <div className="mt-3 grid grid-cols-[110px_1fr] gap-2">
          <label className="block">
            <span className="text-[12px] font-semibold text-tk-ink-3">ระดับน้ำ (ซม.)</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="ไม่บังคับ"
              className={`mt-1 ${input}`}
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-semibold text-tk-ink-3">หมายเหตุ</span>
            <input
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ท่วมถึงเข่า รถเล็กผ่านไม่ได้"
              className={`mt-1 ${input}`}
            />
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-tk-overdue-soft px-3 py-2 text-[12.5px] font-semibold text-tk-overdue-ink"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!ready || busy}
          onClick={submit}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-tk-flood text-[15px] font-bold text-white disabled:opacity-50"
        >
          {busy && <LoaderCircle size={18} className="animate-spin" aria-hidden />}
          {busy ? "กำลังส่ง…" : "ส่งรูป"}
        </button>
        <p className="mt-2 text-[11px] leading-normal text-tk-ink-4">
          รูปจะแสดงบนหน้านี้ทันทีพร้อมป้าย &ldquo;ภาพจากประชาชน&rdquo; · ถ่ายให้เห็นระดับน้ำ
          หลีกเลี่ยงหน้าคนและบ้านเลขที่ · ต้องการความช่วยเหลือ ใช้ปุ่ม &ldquo;ขอความช่วยเหลือ&rdquo; แทน
        </p>
      </div>
    </div>
  );
}
