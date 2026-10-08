// ฟอร์มบันทึก/แก้ไขงานโบตะกอน — ออกแบบให้ใช้บนมือถือหน้างานเป็นหลัก
// เรียงตามลำดับงานจริง: ตำแหน่ง → รูปก่อน → ระยะเวลา/NTU → รูปหลัง → ผล → บันทึก
// ดีไซน์: แถบความคืบหน้า 5 ขั้นด้านบน + แถบบันทึกด้านล่างบอกว่ายังขาดอะไร (โทเคน pp-* ใน globals.css)
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Camera, Check, Clock, MapPin, Minus, Plus, RotateCw, TriangleAlert, X } from "lucide-react";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import { resizeImage } from "@/lib/smart-papar/resizeImage";
import { MAX_PHOTOS_PER_SLOT, ntuChangePct } from "@/lib/smart-papar/flushing";
import { FLUSH_POINT_KIND_LABELS, flushPointLabel, nearestFlushPoints } from "@/lib/smart-papar/flushPoints";

const NEAR_RADIUS_M = 150;
const DURATION_STEP = 5;
const QUICK_DURATIONS = [5, 10, 15, 30];

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

const inputCls =
  "w-full rounded-xl border-[1.5px] border-pp-line-2 bg-white px-3.5 py-3 text-base text-pp-ink focus:border-pp-water focus:outline-none focus:ring-4 focus:ring-pp-tint";

function FieldError({ msg }) {
  if (!msg) return null;
  return <p className="mt-1 text-sm text-pp-danger">{msg}</p>;
}

function Section({ step, title, aside, done, children }) {
  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(11,34,51,0.06)]">
      <div className="flex items-center gap-2.5">
        {step != null && (
          <span
            className={`grid h-7 w-7 flex-none place-items-center rounded-full text-sm font-semibold ${
              done ? "bg-pp-water text-white" : "border-2 border-pp-water text-pp-water"
            }`}
          >
            {done ? <Check size={15} strokeWidth={3} aria-hidden /> : step}
          </span>
        )}
        <h3 className="flex-1 font-tk-sans text-lg font-semibold text-pp-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PhotoSlot({ step, label, items, setItems, error }) {
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

  const done = items.some((p) => p.status === "done");

  return (
    <Section
      step={step}
      title={label}
      done={done}
      aside={<span className="text-sm text-pp-muted">{items.length}/{MAX_PHOTOS_PER_SLOT}</span>}
    >
      <div className="grid grid-cols-3 gap-2">
        {items.map((p) => (
          <div key={p.key} className="relative aspect-square overflow-hidden rounded-xl bg-pp-ground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url || p.preview} alt="" className="h-full w-full object-cover" />
            {p.status === "uploading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-pp-ink/55 text-xs text-white">
                <span className="h-1 w-3/5 overflow-hidden rounded-full bg-white/30">
                  <span className="block h-full w-1/2 animate-pulse bg-white" />
                </span>
                กำลังอัปโหลด
              </div>
            )}
            {p.status === "error" && (
              <button
                type="button"
                onClick={() => startUpload(p.key, p.file)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-pp-danger/90 p-1 text-center text-xs font-semibold text-white"
              >
                <RotateCw size={18} aria-hidden />
                ไม่สำเร็จ
                <br />
                แตะลองใหม่
              </button>
            )}
            <button
              type="button"
              aria-label="ลบรูป"
              onClick={() => setItems((prev) => prev.filter((x) => x.key !== p.key))}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-pp-ink/60 text-white"
            >
              <X size={14} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        ))}
        {items.length < MAX_PHOTOS_PER_SLOT && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-pp-dash bg-pp-tint-2 text-sm font-semibold text-pp-water"
          >
            <Camera size={26} aria-hidden />
            ถ่ายรูป
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
    </Section>
  );
}

// createEndpoint: หน้าแอดมินใช้ค่า default · หน้าภาคสนาม (ไม่ล็อกอิน) ส่ง /api/smart-papar/field/flushing
// onSaved(data, submitted) — submitted = สิ่งที่ส่งไป (+ flushPointCode) ให้หน้าภาคสนามโชว์สรุปได้
// เพราะ API ภาคสนามคืนแค่ _id
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

  const setDuration = (n) => setForm((f) => ({ ...f, durationMin: String(Math.min(600, Math.max(1, n))) }));
  const stepDuration = (delta) => {
    const cur = parseInt(form.durationMin, 10);
    const base = Number.isFinite(cur) ? cur : 0;
    setDuration(delta > 0 ? base + delta : Math.max(1, base + delta));
  };

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
  const uploadingCount = allPhotos.filter((p) => p.status === "uploading").length;
  const uploading = uploadingCount > 0;
  const failed = allPhotos.some((p) => p.status === "error");
  const ntuPct = ntuChangePct(form.turbidityBeforeNtu, form.turbidityAfterNtu);

  // ความคืบหน้า 5 ขั้น (แค่ช่วยนำสายตา — ตัวตรวจจริงคือ validateFlushingInput ฝั่ง server)
  const steps = [
    { label: "ตำแหน่ง", done: form.lat != null && form.locationName.trim() !== "" },
    { label: "รูปก่อน", done: photosBefore.some((p) => p.status === "done") },
    { label: "ค่าวัด", done: parseInt(form.durationMin, 10) > 0 },
    { label: "รูปหลัง", done: photosAfter.some((p) => p.status === "done") },
    { label: "ผล", done: Boolean(form.result) },
  ];
  const missing = [];
  if (form.lat == null) missing.push("ตำแหน่ง");
  else if (!form.locationName.trim()) missing.push("ชื่อจุด");
  if (!(parseInt(form.durationMin, 10) > 0)) missing.push("ระยะเวลา");
  if (!allPhotos.some((p) => p.status === "done" || p.status === "uploading")) missing.push("รูปอย่างน้อย 1 รูป");
  if (!form.result) missing.push("ผลหลังโบ");

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
      onSaved(data.data, { ...payload, flushPointCode: selectedPoint?.code || "" });
    } catch {
      setErrors({ form: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ข้อมูลยังอยู่ — ลองกดบันทึกอีกครั้ง" });
    } finally {
      setSaving(false);
    }
  };

  const hint = uploading
    ? `รอรูปอัปโหลดอีก ${uploadingCount} รูป`
    : missing.length
    ? `ยังขาด: ${missing.join(" · ")}`
    : "";

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-pp-ink/45 sm:items-center">
      <div className="flex max-h-[100dvh] w-full flex-col bg-pp-ground sm:max-h-[92vh] sm:max-w-lg sm:overflow-hidden sm:rounded-3xl">
        <div className="space-y-3 border-b border-pp-line bg-white px-5 pb-3.5 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-tk-sans text-xl font-bold text-pp-ink">
              {isEdit ? "แก้ไขบันทึกโบตะกอน" : "บันทึกโบตะกอน"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="-mr-2 grid h-11 w-11 place-items-center rounded-xl text-pp-muted hover:bg-pp-ground"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <ol className="grid grid-cols-5 gap-1.5" aria-label="ความคืบหน้า">
            {steps.map((s) => (
              <li key={s.label} className="flex flex-col gap-1">
                <span className={`h-1 rounded-full ${s.done ? "bg-pp-water" : "bg-pp-line-2"}`} />
                <span className={`text-[11px] ${s.done ? "font-semibold text-pp-water" : "text-pp-muted"}`}>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
          {/* 1. ตำแหน่ง */}
          <Section step={1} title="จุดที่โบตะกอน" done={steps[0].done}>
            {form.lat == null ? (
              <button
                type="button"
                onClick={locate}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pp-water py-3.5 text-base font-semibold text-white disabled:opacity-60"
              >
                <MapPin size={20} aria-hidden />
                {locating ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-pp-tint py-2.5 pl-3.5 pr-2.5">
                <MapPin size={22} className="flex-none text-pp-water" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-tk-mono text-sm text-pp-ink">
                    {Number(form.lat).toFixed(5)}, {Number(form.lng).toFixed(5)}
                  </span>
                  {form.accuracy != null && (
                    <span className="text-[13px] text-pp-clear-ink">แม่นยำ ±{Math.round(form.accuracy)} ม.</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={locate}
                  disabled={locating}
                  className="h-11 rounded-xl border-[1.5px] border-pp-water bg-white px-3.5 text-sm font-semibold text-pp-water disabled:opacity-60"
                >
                  {locating ? "กำลังหา…" : "อัปเดต"}
                </button>
              </div>
            )}
            <FieldError msg={errors.location} />

            {form.lat != null && flushPoints && (
              <div className="space-y-2">
                {nearby.length > 0 ? (
                  <>
                    <div className="text-sm text-pp-muted">หัวโบล์ใกล้คุณ — แตะเพื่อเลือก</div>
                    {nearby.map(({ point, distanceM }) => {
                      const on = form.flushPointId === String(point._id);
                      return (
                        <button
                          key={point._id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => pickPoint(on ? null : point)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left ${
                            on ? "border-2 border-pp-water bg-pp-tint-2" : "border-[1.5px] border-pp-line bg-white"
                          }`}
                        >
                          {on ? (
                            <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-pp-water text-white">
                              <Check size={14} strokeWidth={3} aria-hidden />
                            </span>
                          ) : (
                            <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-pp-line-2" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block font-tk-mono text-[15px] text-pp-ink">{point.code}</span>
                            <span className="block truncate text-[13px] text-pp-muted">
                              {[point.name || point.roadName, FLUSH_POINT_KIND_LABELS[point.kind]].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className={`flex-none text-sm ${on ? "font-semibold text-pp-water" : "text-pp-muted"}`}>
                            {distanceM} ม.
                          </span>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="rounded-xl bg-pp-ground px-3 py-2 text-sm text-pp-muted">
                    ไม่พบหัวโบล์ในรัศมี {NEAR_RADIUS_M} ม. — พิมพ์ชื่อจุดเองได้เลย
                  </div>
                )}
                {selectedPoint && !nearby.some((n) => String(n.point._id) === form.flushPointId) && (
                  <div className="flex items-center justify-between rounded-xl bg-pp-tint px-3 py-2 text-sm text-pp-deep">
                    <span>เลือกไว้: {flushPointLabel(selectedPoint)}</span>
                    <button type="button" onClick={() => pickPoint(null)} className="underline">
                      ยกเลิก
                    </button>
                  </div>
                )}
              </div>
            )}
            <FieldError msg={errors.flushPointId} />
            <div>
              <label htmlFor="flushing-location-name" className="mb-1.5 block text-sm font-semibold text-pp-ink">
                ชื่อจุด / ถนน
              </label>
              <input
                id="flushing-location-name"
                className={inputCls}
                placeholder="เช่น หัวดับเพลิงหน้าตลาดสด"
                value={form.locationName}
                onChange={set("locationName")}
                maxLength={200}
              />
              <FieldError msg={errors.locationName} />
            </div>
          </Section>

          {/* 2. รูปก่อน */}
          <PhotoSlot step={2} label="รูปก่อนโบ" items={photosBefore} setItems={setPhotosBefore} />

          {/* 3. ระยะเวลา + NTU */}
          <Section step={3} title="ระยะเวลาและความขุ่น" done={steps[2].done}>
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-pp-ink">ระยะเวลาที่โบ</span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label={`ลด ${DURATION_STEP} นาที`}
                  onClick={() => stepDuration(-DURATION_STEP)}
                  className="grid h-[52px] w-[52px] flex-none place-items-center rounded-xl border-[1.5px] border-pp-line-2 bg-white text-pp-ink"
                >
                  <Minus size={20} strokeWidth={2.4} aria-hidden />
                </button>
                <label className="flex h-[52px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-pp-ground px-2">
                  <span className="sr-only">ระยะเวลาที่โบ (นาที)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={600}
                    placeholder="–"
                    value={form.durationMin}
                    onChange={set("durationMin")}
                    className="w-20 bg-transparent text-center font-tk-sans text-3xl font-bold text-pp-ink focus:outline-none"
                  />
                  <span className="text-[15px] text-pp-muted">นาที</span>
                </label>
                <button
                  type="button"
                  aria-label={`เพิ่ม ${DURATION_STEP} นาที`}
                  onClick={() => stepDuration(DURATION_STEP)}
                  className="grid h-[52px] w-[52px] flex-none place-items-center rounded-xl border-[1.5px] border-pp-line-2 bg-white text-pp-ink"
                >
                  <Plus size={20} strokeWidth={2.4} aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_DURATIONS.map((n) => {
                  const on = String(n) === String(form.durationMin);
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDuration(n)}
                      className={`h-10 rounded-full border-[1.5px] text-sm ${
                        on ? "border-pp-water bg-pp-water font-semibold text-white" : "border-pp-line bg-white text-pp-ink"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <FieldError msg={errors.durationMin} />
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-semibold text-pp-ink">
                ค่าความขุ่น NTU <span className="font-normal text-pp-muted">(ถ้ามีเครื่องวัด)</span>
              </span>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="flushing-ntu-before" className="mb-1 block text-[13px] text-pp-muted">ก่อนโบ</label>
                  <input
                    id="flushing-ntu-before"
                    className={`${inputCls} text-lg font-semibold !text-pp-turbid-ink`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.turbidityBeforeNtu}
                    onChange={set("turbidityBeforeNtu")}
                  />
                </div>
                <ArrowRight size={22} className="mb-3.5 flex-none text-pp-muted" aria-hidden />
                <div className="flex-1">
                  <label htmlFor="flushing-ntu-after" className="mb-1 block text-[13px] text-pp-muted">หลังโบ</label>
                  <input
                    id="flushing-ntu-after"
                    className={`${inputCls} text-lg font-semibold !text-pp-clear-ink`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.turbidityAfterNtu}
                    onChange={set("turbidityAfterNtu")}
                  />
                </div>
              </div>
              <FieldError msg={errors.turbidityBeforeNtu || errors.turbidityAfterNtu} />
              {ntuPct != null && (
                <div
                  className={`flex items-center gap-1.5 text-[13px] ${
                    ntuPct >= 0 ? "text-pp-clear-ink" : "text-pp-turbid-ink"
                  }`}
                >
                  {ntuPct >= 0 ? <ArrowDown size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}
                  {ntuPct >= 0 ? `ความขุ่นลดลง ${ntuPct}%` : `ความขุ่นเพิ่มขึ้น ${Math.abs(ntuPct)}%`}
                </div>
              )}
            </div>
          </Section>

          {/* 4. รูปหลัง */}
          <PhotoSlot
            step={4}
            label="รูปหลังโบ"
            items={photosAfter}
            setItems={setPhotosAfter}
            error={errors.photos}
          />

          {/* 5. ผล */}
          <Section step={5} title="ผลหลังโบตะกอน" done={steps[4].done}>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  v: "clear",
                  label: "ใสแล้ว",
                  Icon: Check,
                  ink: "text-pp-clear-ink",
                  tile: "bg-pp-clear-tint",
                  on: "border-pp-clear bg-pp-clear-tint",
                },
                {
                  v: "still_turbid",
                  label: "ยังขุ่น",
                  Icon: TriangleAlert,
                  ink: "text-pp-turbid-ink",
                  tile: "bg-pp-turbid-tint",
                  on: "border-pp-turbid bg-pp-turbid-tint",
                },
              ].map(({ v, label, Icon, ink, tile, on }) => {
                const active = form.result === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setForm((f) => ({ ...f, result: v }))}
                    className={`flex h-28 flex-col items-center justify-center gap-2 rounded-2xl border-2 font-tk-sans text-[19px] font-bold ${ink} ${
                      active ? on : "border-pp-line bg-white"
                    }`}
                  >
                    <span className={`grid h-11 w-11 place-items-center rounded-full ${active ? "bg-white" : tile}`}>
                      <Icon size={24} strokeWidth={2.5} aria-hidden />
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
            <FieldError msg={errors.result} />
          </Section>

          {/* วันเวลา + หมายเหตุ */}
          <Section title="รายละเอียดเพิ่มเติม">
            <div className="flex flex-wrap items-center gap-3">
              <Clock size={20} className="text-pp-muted" aria-hidden />
              <label htmlFor="flushing-at" className="flex-1 text-sm text-pp-muted">
                วันเวลาที่โบ
              </label>
              <input
                id="flushing-at"
                className="h-11 rounded-xl border-[1.5px] border-pp-line px-2.5 text-[15px] text-pp-ink focus:border-pp-water focus:outline-none"
                type="datetime-local"
                value={form.flushedAt}
                onChange={set("flushedAt")}
              />
            </div>
            <FieldError msg={errors.flushedAt} />
            {showNote ? (
              <div>
                <label htmlFor="flushing-note" className="mb-1.5 block text-sm font-semibold text-pp-ink">
                  หมายเหตุ
                </label>
                <textarea
                  id="flushing-note"
                  className={`${inputCls} resize-none`}
                  rows={3}
                  maxLength={1000}
                  value={form.note}
                  onChange={set("note")}
                />
                <FieldError msg={errors.note} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-pp-water"
              >
                <Plus size={18} strokeWidth={2.4} aria-hidden />
                เพิ่มหมายเหตุ
              </button>
            )}
          </Section>
        </div>

        <div className="space-y-2 border-t border-pp-line bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-6px_16px_rgba(11,34,51,0.06)]">
          {errors.form && <p className="text-sm text-pp-danger">{errors.form}</p>}
          {hint && !errors.form && (
            <p className="flex items-center gap-1.5 text-[13px] text-pp-turbid-ink">
              <TriangleAlert size={16} aria-hidden />
              {hint}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={uploading || saving}
            className="h-14 w-full rounded-2xl bg-pp-water font-tk-sans text-[19px] font-bold text-white disabled:bg-pp-water/50"
          >
            {saving ? "กำลังบันทึก…" : uploading ? "รอรูปอัปโหลดให้เสร็จ…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
