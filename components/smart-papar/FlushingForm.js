// ฟอร์มบันทึก/แก้ไขงานโบตะกอน — ออกแบบให้ใช้บนมือถือหน้างานเป็นหลัก
// เรียงตามลำดับงานจริง: ตำแหน่ง → รูปก่อน → ระยะเวลา/NTU → รูปหลัง → ผล → บันทึก
import { useEffect, useMemo, useRef, useState } from "react";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import { resizeImage } from "@/lib/smart-papar/resizeImage";
import { MAX_PHOTOS_PER_SLOT } from "@/lib/smart-papar/flushing";
import { FLUSH_POINT_KIND_LABELS, flushPointLabel, nearestFlushPoints } from "@/lib/smart-papar/flushPoints";

const NEAR_RADIUS_M = 150;

function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function initialState(log) {
  if (!log) {
    return {
      flushedAt: toLocalInputValue(new Date()),
      lat: null,
      lng: null,
      accuracy: null,
      locationName: "",
      flushPointId: "",
      durationMin: "",
      turbidityBeforeNtu: "",
      turbidityAfterNtu: "",
      result: "",
      note: "",
    };
  }
  return {
    flushedAt: toLocalInputValue(log.flushedAt),
    lat: log.location?.coordinates?.[1] ?? null,
    lng: log.location?.coordinates?.[0] ?? null,
    accuracy: null,
    locationName: log.locationName || "",
    flushPointId: log.flushPointId ? String(log.flushPointId) : "",
    durationMin: String(log.durationMin ?? ""),
    turbidityBeforeNtu: log.turbidityBeforeNtu ?? "",
    turbidityAfterNtu: log.turbidityAfterNtu ?? "",
    result: log.result || "",
    note: log.note || "",
  };
}

const toPhotoItems = (urls) => (urls || []).map((url) => ({ key: url, url, status: "done" }));

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="mt-1 text-sm text-rose-600">{msg}</p>;
}

function PhotoSlot({ label, items, setItems, error }) {
  const inputRef = useRef(null);

  const startUpload = async (key, file) => {
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, status: "uploading" } : p)));
    try {
      const small = await resizeImage(file);
      const url = await uploadImage(small);
      setItems((prev) => prev.map((p) => (p.key === key ? { ...p, url, status: "done" } : p)));
    } catch {
      setItems((prev) => prev.map((p) => (p.key === key ? { ...p, status: "error" } : p)));
    }
  };

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const room = MAX_PHOTOS_PER_SLOT - items.length;
    files.slice(0, room).forEach((file) => {
      const key = `${Date.now()}-${Math.random()}`;
      const preview = URL.createObjectURL(file);
      setItems((prev) => [...prev, { key, file, preview, url: "", status: "uploading" }]);
      startUpload(key, file);
    });
  };

  return (
    <div>
      <div className="mb-2 font-semibold text-slate-800">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((p) => (
          <div key={p.key} className="relative h-24 w-24 overflow-hidden rounded-xl border bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url || p.preview} alt="" className="h-full w-full object-cover" />
            {p.status === "uploading" && (
              <div className="absolute inset-0 grid place-items-center bg-black/40 text-xs text-white">
                กำลังอัปโหลด…
              </div>
            )}
            {p.status === "error" && (
              <button
                type="button"
                onClick={() => startUpload(p.key, p.file)}
                className="absolute inset-0 grid place-items-center bg-rose-600/80 text-xs font-semibold text-white"
              >
                ไม่สำเร็จ
                <br />
                แตะเพื่อลองใหม่
              </button>
            )}
            <button
              type="button"
              aria-label="ลบรูป"
              onClick={() => setItems((prev) => prev.filter((x) => x.key !== p.key))}
              className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-sm leading-6 text-white"
            >
              ×
            </button>
          </div>
        ))}
        {items.length < MAX_PHOTOS_PER_SLOT && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid h-24 w-24 place-items-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 text-sky-700"
          >
            <span className="text-center text-sm">
              <span className="block text-2xl">📷</span>
              ถ่ายรูป
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={onPick}
      />
      <FieldError msg={error} />
    </div>
  );
}

// createEndpoint: หน้าแอดมินใช้ค่า default · หน้าภาคสนาม (ไม่ล็อกอิน) ส่ง /api/smart-papar/field/flushing
export default function FlushingForm({
  log,
  onClose,
  onSaved,
  createEndpoint = "/api/smart-papar/flushing",
}) {
  const isEdit = Boolean(log?._id);
  const [form, setForm] = useState(() => initialState(log));
  const [photosBefore, setPhotosBefore] = useState(() => toPhotoItems(log?.photosBefore));
  const [photosAfter, setPhotosAfter] = useState(() => toPhotoItems(log?.photosAfter));
  const [errors, setErrors] = useState({});
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNote, setShowNote] = useState(Boolean(log?.note));
  const [flushPoints, setFlushPoints] = useState(null); // null = กำลังโหลด/โหลดไม่ได้

  // ทะเบียนหัวโบล์ (หลักร้อยจุด) โหลดครั้งเดียวแล้วหาตัวใกล้สุดฝั่ง client
  useEffect(() => {
    let alive = true;
    fetch("/api/smart-papar/flush-points")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && Array.isArray(d?.data)) setFlushPoints(d.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const nearby = useMemo(
    () => nearestFlushPoints(flushPoints || [], form.lat, form.lng, { limit: 3, maxM: NEAR_RADIUS_M }),
    [flushPoints, form.lat, form.lng]
  );
  const selectedPoint = (flushPoints || []).find((p) => String(p._id) === form.flushPointId) || null;

  const pickPoint = (p) =>
    setForm((f) =>
      p
        ? { ...f, flushPointId: String(p._id), locationName: flushPointLabel(p) }
        : { ...f, flushPointId: "" }
    );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const locate = () => {
    if (!navigator.geolocation) {
      setErrors((x) => ({ ...x, location: "อุปกรณ์นี้ไม่รองรับการหาตำแหน่ง" }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }));
        setErrors((x) => ({ ...x, location: undefined }));
        setLocating(false);
      },
      (err) => {
        setErrors((x) => ({
          ...x,
          location:
            err.code === err.PERMISSION_DENIED
              ? "ยังไม่อนุญาตให้เข้าถึงตำแหน่ง — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์ในตั้งค่ามือถือ แล้วกดใหม่"
              : "หาตำแหน่งไม่สำเร็จ ลองออกไปที่โล่งแล้วกดใหม่",
        }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const allPhotos = [...photosBefore, ...photosAfter];
  const uploading = allPhotos.some((p) => p.status === "uploading");
  const failed = allPhotos.some((p) => p.status === "error");

  const submit = async () => {
    if (uploading || saving) return;
    if (failed) {
      setErrors((x) => ({ ...x, photos: "มีรูปที่อัปโหลดไม่สำเร็จ — แตะรูปเพื่อลองใหม่ หรือลบรูปนั้นออก" }));
      return;
    }
    setSaving(true);
    setErrors({});
    const flushedAt = new Date(form.flushedAt);
    const payload = {
      flushedAt: Number.isNaN(flushedAt.getTime()) ? "" : flushedAt.toISOString(),
      lat: form.lat,
      lng: form.lng,
      locationName: form.locationName,
      flushPointId: form.flushPointId || null,
      durationMin: form.durationMin,
      turbidityBeforeNtu: form.turbidityBeforeNtu,
      turbidityAfterNtu: form.turbidityAfterNtu,
      result: form.result,
      photosBefore: photosBefore.map((p) => p.url),
      photosAfter: photosAfter.map((p) => p.url),
      note: form.note,
    };
    try {
      const res = await fetch(
        isEdit ? `/api/smart-papar/flushing/${log._id}` : createEndpoint,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setErrors(data?.errors || { form: data?.message || "บันทึกไม่สำเร็จ" });
        return;
      }
      onSaved(data.data);
    } catch {
      setErrors({ form: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ข้อมูลยังอยู่ — ลองกดบันทึกอีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base focus:border-sky-500 focus:outline-none";

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[100dvh] w-full flex-col bg-white sm:max-h-[92vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold">{isEdit ? "แก้ไขบันทึกโบตะกอน" : "บันทึกโบตะกอน"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100">
            ปิด
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* 1. ตำแหน่ง */}
          <div>
            <div className="mb-2 font-semibold text-slate-800">1. จุดที่โบตะกอน</div>
            <button
              type="button"
              onClick={locate}
              disabled={locating}
              className="w-full rounded-xl bg-sky-600 py-3 text-base font-semibold text-white disabled:opacity-60"
            >
              {locating ? "กำลังหาตำแหน่ง…" : form.lat != null ? "📍 อัปเดตตำแหน่งปัจจุบัน" : "📍 ใช้ตำแหน่งปัจจุบัน"}
            </button>
            {form.lat != null && (
              <p className="mt-1 text-sm text-emerald-700">
                ✓ {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
                {form.accuracy != null && ` (แม่นยำ ±${Math.round(form.accuracy)} ม.)`}
              </p>
            )}
            <FieldError msg={errors.location} />
            {form.lat != null && flushPoints && (
              <div className="mt-2 space-y-1.5">
                {nearby.length > 0 ? (
                  <>
                    <div className="text-sm text-slate-600">หัวโบล์ใกล้คุณ — แตะเพื่อเลือก</div>
                    {nearby.map(({ point, distanceM }) => {
                      const on = form.flushPointId === String(point._id);
                      return (
                        <button
                          key={point._id}
                          type="button"
                          onClick={() => pickPoint(point)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-left ${
                            on ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-900">
                              {on && "✓ "}
                              {point.code}
                            </span>
                            <span className="block truncate text-sm text-slate-600">
                              {[point.name || point.roadName, FLUSH_POINT_KIND_LABELS[point.kind]].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="flex-none text-sm text-slate-500">{distanceM} ม.</span>
                        </button>
                      );
                    })}
                    {form.flushPointId && (
                      <button type="button" onClick={() => pickPoint(null)} className="text-sm text-slate-500 underline">
                        ไม่ใช่หัวในรายการ (พิมพ์ชื่อจุดเอง)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-slate-500">ไม่พบหัวโบล์ในรัศมี {NEAR_RADIUS_M} ม. — พิมพ์ชื่อจุดเองได้เลย</div>
                )}
                {selectedPoint && !nearby.some((n) => String(n.point._id) === form.flushPointId) && (
                  <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">
                    <span>เลือกไว้: {flushPointLabel(selectedPoint)}</span>
                    <button type="button" onClick={() => pickPoint(null)} className="underline">
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            )}
            <FieldError msg={errors.flushPointId} />
            <input
              className={`${inputCls} mt-2`}
              placeholder="ชื่อจุด/ถนน เช่น หัวดับเพลิงหน้าตลาดสด"
              value={form.locationName}
              onChange={set("locationName")}
              maxLength={200}
            />
            <FieldError msg={errors.locationName} />
          </div>

          {/* 2. รูปก่อน */}
          <PhotoSlot label="2. รูปก่อนโบ" items={photosBefore} setItems={setPhotosBefore} />

          {/* 3. ระยะเวลา + NTU */}
          <div>
            <div className="mb-2 font-semibold text-slate-800">3. ระยะเวลาและค่าความขุ่น</div>
            <label className="text-sm text-slate-600">ระยะเวลาที่โบ (นาที)</label>
            <input
              className={inputCls}
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={form.durationMin}
              onChange={set("durationMin")}
            />
            <FieldError msg={errors.durationMin} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm text-slate-600">NTU ก่อน (ถ้ามี)</label>
                <input
                  className={inputCls}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.turbidityBeforeNtu}
                  onChange={set("turbidityBeforeNtu")}
                />
                <FieldError msg={errors.turbidityBeforeNtu} />
              </div>
              <div>
                <label className="text-sm text-slate-600">NTU หลัง (ถ้ามี)</label>
                <input
                  className={inputCls}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.turbidityAfterNtu}
                  onChange={set("turbidityAfterNtu")}
                />
                <FieldError msg={errors.turbidityAfterNtu} />
              </div>
            </div>
          </div>

          {/* 4. รูปหลัง */}
          <PhotoSlot
            label="4. รูปหลังโบ"
            items={photosAfter}
            setItems={setPhotosAfter}
            error={errors.photos}
          />

          {/* 5. ผล */}
          <div>
            <div className="mb-2 font-semibold text-slate-800">5. ผลหลังโบตะกอน</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "clear", label: "✅ ใสแล้ว", on: "border-emerald-500 bg-emerald-50 text-emerald-800" },
                { v: "still_turbid", label: "⚠️ ยังขุ่น", on: "border-orange-500 bg-orange-50 text-orange-800" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, result: o.v }))}
                  className={`rounded-xl border-2 py-4 text-base font-semibold ${
                    form.result === o.v ? o.on : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <FieldError msg={errors.result} />
          </div>

          {/* วันเวลา + หมายเหตุ */}
          <div>
            <label className="text-sm text-slate-600">วันเวลาที่โบ</label>
            <input className={inputCls} type="datetime-local" value={form.flushedAt} onChange={set("flushedAt")} />
            <FieldError msg={errors.flushedAt} />
          </div>
          {showNote ? (
            <div>
              <label className="text-sm text-slate-600">หมายเหตุ</label>
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                maxLength={1000}
                value={form.note}
                onChange={set("note")}
              />
              <FieldError msg={errors.note} />
            </div>
          ) : (
            <button type="button" onClick={() => setShowNote(true)} className="text-sm text-sky-700 underline">
              + เพิ่มหมายเหตุ
            </button>
          )}
        </div>

        <div className="border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {errors.form && <p className="mb-2 text-sm text-rose-600">{errors.form}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={uploading || saving}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-lg font-bold text-white disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก…" : uploading ? "รอรูปอัปโหลดให้เสร็จ…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
