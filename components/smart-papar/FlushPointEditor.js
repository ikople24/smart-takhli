// ฟอร์มแก้ไข/เพิ่มหัวโบล์ (หลังบ้าน) — แผงขวาบนเดสก์ท็อป / แผ่นเต็มจอบนมือถือ
// state ของฟอร์ม (draft) อยู่ที่หน้าแม่ เพราะแผนที่ต้องย้ายหมุดใน draft เดียวกัน
// รหัสเปลี่ยนไม่ได้หลังสร้าง (FlushingLog เก็บ flushPointCode เป็นสำเนา)
import { useMemo, useRef, useState } from "react";
import { Camera, Check, Crosshair, History as HistoryIcon, LocateFixed, MapPin, Move, Trash2, X } from "lucide-react";
import { FLUSH_POINT_KIND_COLORS, FLUSH_POINT_KIND_LABELS, distanceM } from "@/lib/smart-papar/flushPoints";
import {
  FLUSH_POINT_FIELD_LABELS,
  FLUSH_POINT_KINDS,
  diffFlushPoint,
  nextFlushPointCode,
  roadNameOptions,
  validateFlushPointInput,
} from "@/lib/smart-papar/flushPointEdit";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import { resizeImage } from "@/lib/smart-papar/resizeImage";
import { cloudinaryThumb } from "@/lib/smart-papar/cloudinaryThumb";

const KIND_ORDER = ["tee_large", "tee_medium", "tee_small", "garland", "unknown"];
const NEAR_DUP_M = 5;

const inputCls =
  "h-12 w-full rounded-xl border-[1.5px] border-pp-line-2 bg-white px-3 text-base text-pp-ink focus:border-pp-water focus:outline-none focus:ring-4 focus:ring-pp-tint";

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function draftFromPoint(p) {
  if (!p) {
    return { code: "", name: "", roadName: "", kind: "unknown", lat: null, lng: null, photoUrl: "", active: true };
  }
  return {
    code: p.code,
    name: p.name || "",
    roadName: p.roadName || "",
    kind: p.kind || "unknown",
    lat: p.location?.coordinates?.[1] ?? null,
    lng: p.location?.coordinates?.[0] ?? null,
    photoUrl: p.photoUrl || "",
    active: p.active !== false,
  };
}

function Err({ msg }) {
  return msg ? <p className="mt-1 text-sm text-pp-danger">{msg}</p> : null;
}

function WasHint({ show, children }) {
  return show ? <p className="mt-1 text-xs text-pp-turbid-ink">{children}</p> : null;
}

function RoadField({ value, onChange, options, error, was }) {
  const [open, setOpen] = useState(false);
  const q = value.trim();
  const matches = options.filter((o) => !q || o.name.includes(q)).slice(0, 6);
  const exact = options.some((o) => o.name === q);
  return (
    <div className="relative">
      <label htmlFor="fp-road" className="mb-1.5 block text-sm font-semibold">
        ถนน / ซอย
      </label>
      <input
        id="fp-road"
        className={inputCls}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="fp-road-list"
        placeholder="เช่น ถ.พหลโยธิน, ซอยเทศบาล 5"
        maxLength={120}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && (matches.length > 0 || (q && !exact)) && (
        <div
          id="fp-road-list"
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-pp-line bg-white shadow-lg"
        >
          {matches.map((o) => (
            <button
              key={o.name}
              type="button"
              role="option"
              aria-selected={o.name === q}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.name);
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-center justify-between border-b border-pp-line/60 px-3 text-left text-[15px] last:border-b-0 hover:bg-pp-tint-2"
            >
              {o.name}
              <span className="text-xs text-pp-muted">{o.count} หัว</span>
            </button>
          ))}
          {q && !exact && (
            <div className="px-3 py-2.5 text-sm text-pp-water">ใช้ชื่อใหม่ “{q}”</div>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-pp-muted">เลือกจากชื่อที่มีอยู่ เพื่อให้ค้นและสรุปตามถนนได้ตรงกัน</p>
      <WasHint show={was != null}>แก้จาก “{was || "ว่าง"}”</WasHint>
      <Err msg={error} />
    </div>
  );
}

export default function FlushPointEditor({
  draft,
  setDraft,
  original, // หัวเดิม (null = เพิ่มใหม่)
  points,
  errors = {},
  saving = false,
  moving = false,
  onStartMove,
  onCancel,
  onSave,
  onDelete, // ลบหัวนี้ (เฉพาะหัวเดิม) — หน้าแม่จัดการยืนยัน/กรณีมีบันทึกโบอ้างอยู่
  deleting = false,
}) {
  const isCreate = !original;
  const fileRef = useRef(null);
  const [photoState, setPhotoState] = useState("idle"); // idle | uploading | error
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [accuracy, setAccuracy] = useState(null);
  const [coordText, setCoordText] = useState("");
  const [showCoordInput, setShowCoordInput] = useState(false);

  // หัวใหม่: รหัสรันให้อัตโนมัติ (codeAuto) และเปลี่ยนอักษรตามชนิดที่เลือก จนกว่าจะพิมพ์รหัสเอง
  const set = (k, v) =>
    setDraft((d) => {
      const next = { ...d, [k]: v };
      if (k === "kind" && d.codeAuto) next.code = nextFlushPointCode((points || []).map((p) => p.code), v);
      return next;
    });
  const roads = useMemo(() => roadNameOptions(points), [points]);

  const validated = validateFlushPointInput(draft, { isCreate });
  const changes = useMemo(() => {
    if (isCreate || !validated.ok) return [];
    return diffFlushPoint(original, validated.value);
  }, [isCreate, validated.ok, validated.value, original]);
  const changed = Object.fromEntries(changes.map((c) => [c.field, c]));
  const dirty = isCreate || changes.length > 0;

  const nearestOther = useMemo(() => {
    if (draft.lat == null || draft.lng == null) return null;
    let best = null;
    for (const p of points) {
      if (original && String(p._id) === String(original._id)) continue;
      const [lng, lat] = p.location?.coordinates || [];
      if (lat == null) continue;
      const d = distanceM(draft.lat, draft.lng, lat, lng);
      if (!best || d < best.d) best = { p, d };
    }
    return best;
  }, [points, draft.lat, draft.lng, original]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocError("อุปกรณ์นี้ไม่รองรับการหาตำแหน่ง");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((d) => ({ ...d, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setAccuracy(pos.coords.accuracy);
        setLocating(false);
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "ยังไม่อนุญาตให้เข้าถึงตำแหน่ง — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์แล้วกดใหม่"
            : "หาตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง"
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const applyCoordText = () => {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(coordText);
    if (!m) {
      setLocError("รูปแบบพิกัดคือ lat, lng เช่น 15.25801, 100.34598");
      return;
    }
    setLocError("");
    setDraft((d) => ({ ...d, lat: Number(m[1]), lng: Number(m[2]) }));
    setShowCoordInput(false);
    setCoordText("");
  };

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoState("uploading");
    try {
      const url = await uploadImage(await resizeImage(file));
      set("photoUrl", url);
      setPhotoState("idle");
    } catch {
      setPhotoState("error");
    }
  };

  const hasLocation = draft.lat != null && draft.lng != null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-pp-ink">
      <div className="flex items-start gap-3 border-b border-pp-line px-4 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          {isCreate ? (
            <>
              <h2 className="font-tk-sans text-xl font-bold">เพิ่มหัวโบล์</h2>
              <p className="text-xs text-pp-muted">รหัสตั้งได้ครั้งเดียว แก้ภายหลังไม่ได้</p>
            </>
          ) : (
            <>
              <div className="text-xs text-pp-muted">รหัส (เปลี่ยนไม่ได้)</div>
              <div className="font-tk-mono text-[22px] leading-tight">{original.code}</div>
            </>
          )}
        </div>
        {!isCreate && changes.length > 0 && (
          <span className="mt-1 flex flex-none items-center gap-1.5 rounded-full bg-pp-turbid-wash px-2.5 py-1 text-xs text-pp-turbid-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-pp-turbid" />
            ยังไม่บันทึก {changes.length} ช่อง
          </span>
        )}
        <button
          type="button"
          onClick={onCancel}
          aria-label="ปิด"
          className="-mr-2 -mt-1 grid h-11 w-11 flex-none place-items-center rounded-xl text-pp-muted hover:bg-pp-ground"
        >
          <X size={22} aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {isCreate && (
          <div>
            <label htmlFor="fp-code" className="mb-1.5 block text-sm font-semibold">
              รหัสหัวโบล์
            </label>
            <input
              id="fp-code"
              className={`${inputCls} font-tk-mono uppercase`}
              value={draft.code}
              maxLength={20}
              placeholder="เช่น BP-210"
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase(), codeAuto: false }))}
            />
            {draft.codeAuto ? (
              <p className="mt-1 text-xs text-pp-muted">
                ระบบรันต่อจากเลขล่าสุดให้ อักษรหน้าเปลี่ยนตามประเภท (ตัวทีใหญ่ AT · พวงมาลัย BP · ตัวทีเล็ก/กลาง CN) — แก้เองได้
              </p>
            ) : null}
            <Err msg={errors.code || (draft.code && validated.errors.code)} />
          </div>
        )}

        <div>
          <label htmlFor="fp-name" className="mb-1.5 block text-sm font-semibold">
            ชื่อจุด
          </label>
          <input
            id="fp-name"
            className={inputCls}
            value={draft.name}
            maxLength={200}
            placeholder="เช่น หน้าตลาดสดเทศบาล"
            onChange={(e) => set("name", e.target.value)}
          />
          <WasHint show={Boolean(changed.name)}>แก้จาก “{changed.name?.from || "ว่าง"}”</WasHint>
          <Err msg={errors.name} />
        </div>

        <RoadField
          value={draft.roadName}
          onChange={(v) => set("roadName", v)}
          options={roads}
          error={errors.roadName}
          was={changed.roadName ? changed.roadName.from : null}
        />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">ประเภทหัวโบล์</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {KIND_ORDER.filter((k) => FLUSH_POINT_KINDS.includes(k)).map((k) => {
              const on = draft.kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("kind", k)}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm ${
                    on ? "border-2 border-pp-water bg-pp-tint-2 font-semibold" : "border-[1.5px] border-pp-line bg-white"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={
                      k === "unknown"
                        ? { border: `2px solid ${FLUSH_POINT_KIND_COLORS.unknown}` }
                        : { background: FLUSH_POINT_KIND_COLORS[k] }
                    }
                  />
                  {FLUSH_POINT_KIND_LABELS[k]}
                </button>
              );
            })}
          </div>
          {changed.kind && (
            <p className="mt-1.5 text-xs leading-relaxed text-pp-turbid-ink">
              เปลี่ยนจาก “{FLUSH_POINT_KIND_LABELS[changed.kind.from] || "-"}” · รหัสยังเป็น {original.code} เหมือนเดิม
              บันทึกโบเก่ายังอ้างถึงหัวนี้ได้
            </p>
          )}
          <Err msg={errors.kind} />
        </fieldset>

        <div className="space-y-2">
          <span className="block text-sm font-semibold">ตำแหน่ง</span>
          <div className="flex items-center gap-2.5 rounded-xl bg-pp-ground px-3 py-2.5">
            <MapPin size={20} className="flex-none text-pp-water" aria-hidden />
            {hasLocation ? (
              <span className="flex-1 font-tk-mono text-sm">
                {Number(draft.lat).toFixed(6)}, {Number(draft.lng).toFixed(6)}
              </span>
            ) : (
              <span className="flex-1 text-sm text-pp-muted">ยังไม่มีตำแหน่ง — แตะบนแผนที่หรือใช้ตำแหน่งปัจจุบัน</span>
            )}
          </div>
          {(changed.location || accuracy != null) && (
            <p className="text-xs text-pp-clear-ink">
              {changed.location && `ย้ายจากเดิม ${changed.location.movedM} ม.`}
              {changed.location && accuracy != null && " · "}
              {accuracy != null && `GPS แม่นยำ ±${Math.round(accuracy)} ม.`}
            </p>
          )}
          {nearestOther && nearestOther.d < NEAR_DUP_M && (
            <p className="text-xs text-pp-turbid-ink">
              อยู่ห่าง {nearestOther.p.code} เพียง {Math.round(nearestOther.d)} ม. — ตรวจว่าไม่ใช่หัวเดียวกัน
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={onStartMove}
              disabled={moving}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-pp-water text-sm font-semibold text-pp-water disabled:opacity-50"
            >
              <Move size={18} aria-hidden />
              {moving ? "กำลังย้ายบนแผนที่" : "ย้ายหมุดบนแผนที่"}
            </button>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-pp-line-2 text-sm font-semibold disabled:opacity-60"
            >
              <LocateFixed size={18} aria-hidden />
              {locating ? "กำลังหา…" : "ตำแหน่งที่ยืนอยู่"}
            </button>
          </div>
          {showCoordInput ? (
            <div className="flex gap-1.5">
              <label htmlFor="fp-coord" className="sr-only">
                พิกัด lat, lng
              </label>
              <input
                id="fp-coord"
                className={`${inputCls} h-11 font-tk-mono text-sm`}
                placeholder="15.25801, 100.34598"
                value={coordText}
                onChange={(e) => setCoordText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyCoordText()}
              />
              <button type="button" onClick={applyCoordText} className="h-11 rounded-xl bg-pp-water px-4 text-sm font-semibold text-white">
                ใช้
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCoordInput(true)}
              className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-pp-water"
            >
              <Crosshair size={16} aria-hidden />
              วางพิกัดเอง
            </button>
          )}
          <Err msg={locError || errors.location || (!isCreate && validated.errors.location)} />
        </div>

        <div className="flex items-center gap-3">
          {draft.photoUrl ? (
            <a href={draft.photoUrl} target="_blank" rel="noreferrer" className="flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cloudinaryThumb(draft.photoUrl, 200)} alt="รูปหัวโบล์" className="h-16 w-16 rounded-xl object-cover" />
            </a>
          ) : (
            <span className="h-16 w-16 flex-none rounded-xl bg-pp-ground" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">รูปหัวโบล์</span>
            <span className="block text-xs text-pp-muted">
              {photoState === "uploading"
                ? "กำลังอัปโหลด…"
                : photoState === "error"
                ? "อัปโหลดไม่สำเร็จ ลองใหม่"
                : changed.photoUrl
                ? "เปลี่ยนรูปแล้ว (ยังไม่บันทึก)"
                : draft.photoUrl
                ? "แตะรูปเพื่อดูเต็ม"
                : "ยังไม่มีรูป"}
            </span>
          </span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoState === "uploading"}
            className="flex h-11 flex-none items-center gap-1.5 rounded-xl border-[1.5px] border-pp-line-2 px-3 text-sm disabled:opacity-60"
          >
            <Camera size={18} aria-hidden />
            {draft.photoUrl ? "เปลี่ยนรูป" : "เพิ่มรูป"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
        </div>

        <label className="flex items-center gap-3 border-t border-pp-line pt-3">
          <span className="flex-1">
            <span className="block text-sm font-semibold">ใช้งานอยู่</span>
            <span className="block text-xs text-pp-muted">ปิด = ไม่แสดงในรายการหัวใกล้คุณของฟอร์มภาคสนาม</span>
          </span>
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => set("active", e.target.checked)}
            className="h-6 w-6 accent-[#0E6E86]"
          />
        </label>

        {!isCreate && original.history?.length > 0 && (
          <details className="rounded-xl bg-pp-ground px-3 py-2 text-sm">
            <summary className="flex min-h-9 cursor-pointer items-center gap-1.5 font-semibold">
              <HistoryIcon size={16} aria-hidden />
              ประวัติการแก้ไข
            </summary>
            <ol className="mt-1 space-y-2 pb-1">
              {[...original.history].reverse().map((h, i) => (
                <li key={i} className="text-xs leading-relaxed">
                  <span className="font-semibold">{fmtDateTime(h.at)}</span> · {h.byName || "-"}
                  <span className="block text-pp-muted">
                    {h.action === "create"
                      ? "เพิ่มหัวโบล์"
                      : (h.changes || [])
                          .map((c) =>
                            c.field === "location"
                              ? `ย้ายตำแหน่ง ${c.movedM} ม.`
                              : c.field === "kind"
                              ? `ประเภท: ${FLUSH_POINT_KIND_LABELS[c.from] || "-"} → ${FLUSH_POINT_KIND_LABELS[c.to] || "-"}`
                              : c.field === "photoUrl"
                              ? "เปลี่ยนรูป"
                              : c.field === "active"
                              ? c.to
                                ? "เปิดใช้งาน"
                                : "ปิดใช้งาน"
                              : `${FLUSH_POINT_FIELD_LABELS[c.field] || c.field}: “${c.from || "ว่าง"}” → “${c.to || "ว่าง"}”`
                          )
                          .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>

      <div className="space-y-2 border-t border-pp-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        {!isCreate && original.updatedByName && (
          <p className="text-xs text-pp-muted">
            แก้ล่าสุด {fmtDateTime(original.updatedAt)} โดย {original.updatedByName}
          </p>
        )}
        {errors.form && <p className="text-sm text-pp-danger">{errors.form}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-xl border-[1.5px] border-pp-line-2 px-4 font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving || moving || photoState === "uploading" || !validated.ok}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-pp-water font-semibold text-white disabled:bg-pp-water/40"
          >
            <Check size={18} strokeWidth={2.6} aria-hidden />
            {saving ? "กำลังบันทึก…" : isCreate ? "เพิ่มหัวโบล์" : "บันทึกการแก้ไข"}
          </button>
        </div>
        {moving && <p className="text-xs text-pp-muted">ยืนยันตำแหน่งบนแผนที่ก่อน แล้วจึงบันทึก</p>}
        {!isCreate && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting || saving}
            className="flex w-full items-center justify-center gap-1.5 pt-1 text-sm font-semibold text-pp-danger disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden />
            {deleting ? "กำลังลบ…" : "ลบหัวโบล์นี้"}
          </button>
        )}
      </div>
    </div>
  );
}
