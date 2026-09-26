// components/flood-relief/RequestForm.tsx
// ฟอร์มขอความช่วยเหลือ 3 ขั้น (หน้าจอ 2) — บังคับแค่ ประเภท · พิกัด · เบอร์โทร ที่เหลือไม่บังคับ
// ส่งสำเร็จ → เก็บ {ticket,key} ลง localStorage แล้วไปหน้าสถานะ
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Camera, LoaderCircle, Send } from "lucide-react";
import PhotoUploader from "@/components/citizen/report/PhotoUploader";
import {
  defaultUrgencyForType,
  isRequestType,
  REQUEST_TYPE_META,
  REQUEST_TYPES,
  URGENCIES,
  URGENCY_META,
  type RequestType,
  type Urgency,
} from "@/lib/flood-relief/status";
import { isValidPhone } from "@/lib/flood-relief/phone";
import { addLocalTicket, LOCAL_TICKETS_KEY, parseLocalTickets } from "@/lib/flood-relief/localTickets";
import { telHref } from "@/lib/flood-relief/settings";
import { TypeIcon } from "./icons";
import LocationPicker, { type PickedLocation } from "./LocationPicker";

const URGENCY_STYLE: Record<Urgency, { on: string; off: string }> = {
  critical: { on: "border-tk-overdue-ink bg-tk-overdue-ink text-white", off: "border-tk-overdue-line bg-tk-overdue-soft text-tk-overdue-ink" },
  urgent: { on: "border-tk-due-ink bg-tk-due-ink text-white", off: "border-[#F5DDA6] bg-tk-due-soft text-tk-due-ink" },
  normal: { on: "border-tk-ink-3 bg-tk-ink-3 text-white", off: "border-tk-line bg-white text-tk-ink-3" },
};

const INPUT =
  "mt-1.5 h-[46px] w-full rounded-[14px] border border-tk-line bg-white px-3.5 text-[14px] text-tk-ink-strong placeholder:text-tk-ink-6 focus:border-tk-flood focus:outline-none";

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-tk-flood text-[12px] font-bold text-white">
        {n}
      </span>
      <h2 className="text-[15px] font-bold">{children}</h2>
    </div>
  );
}

export default function RequestForm({ hotline }: { hotline: string }) {
  const router = useRouter();
  const [type, setType] = useState<RequestType | null>(null);
  const [urgency, setUrgency] = useState<Urgency>("urgent");
  const [urgencyTouched, setUrgencyTouched] = useState(false);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [landmark, setLandmark] = useState("");
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState("");
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  // prefill จากปุ่มหน้าแรก ?type=evac → ขั้น 1 ผ่านทันที
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.type;
    if (isRequestType(q)) setType(q);
  }, [router.isReady, router.query.type]);

  // ความเร่งด่วนตั้งต้นตามประเภท จนกว่าผู้ใช้จะเลือกเอง
  useEffect(() => {
    if (type && !urgencyTouched) setUrgency(defaultUrgencyForType(type));
  }, [type, urgencyTouched]);

  const phoneOk = isValidPhone(phone);
  const ready = type != null && location != null && phoneOk && !uploading;

  const scrollToMissing = useCallback(() => {
    const id = !type ? "flood-type" : !location ? "flood-location" : "flood-phone";
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (id === "flood-phone") phoneRef.current?.focus({ preventScroll: true });
  }, [type, location]);

  const submit = async () => {
    setTriedSubmit(true);
    setError(null);
    if (!ready || !type || !location) {
      scrollToMissing();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/flood-relief/public/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          urgency,
          lat: location.point.lat,
          lng: location.point.lng,
          accuracyM: location.accuracyM,
          landmark,
          phone,
          peopleCount: people === "" ? null : Number(people),
          reporterName: name,
          detail,
          images,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ticket) throw new Error(json?.error || `ส่งไม่สำเร็จ กรุณาโทร ${hotline}`);
      try {
        const list = parseLocalTickets(window.localStorage.getItem(LOCAL_TICKETS_KEY));
        window.localStorage.setItem(
          LOCAL_TICKETS_KEY,
          JSON.stringify(addLocalTicket(list, { ticket: json.ticket, key: json.key ?? "", at: new Date().toISOString() }))
        );
      } catch {
        /* โหมดส่วนตัว — ยังไปหน้าสถานะได้ด้วยกุญแจใน URL */
      }
      router.push(`/flood/status/${json.ticket}?k=${encodeURIComponent(json.key ?? "")}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : `ส่งไม่สำเร็จ กรุณาโทร ${hotline}`);
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-[14px] border border-tk-overdue-line bg-tk-overdue-soft px-3 py-2.5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B92544" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
          <path d="M12 3.5 21.5 20h-19Z" />
          <path d="M12 10v4.5" />
          <path d="M12 17.3h.01" />
        </svg>
        <p className="text-[12px] leading-[1.45] text-tk-overdue-ink-2">
          <b>มีผู้ป่วยติดเตียง / คนติดในบ้าน?</b>{" "}
          <a href={telHref(hotline)} className="font-semibold underline">
            โทร {hotline}
          </a>{" "}
          ก่อน แล้วค่อยกรอกฟอร์ม
        </p>
      </div>

      {/* ขั้น 1 */}
      <section id="flood-type" className="mx-4 mt-3.5">
        <StepTitle n={1}>ต้องการความช่วยเหลือเรื่องอะไร</StepTitle>
        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          {REQUEST_TYPES.map((t) => {
            const on = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={on}
                className={`flex min-h-[66px] items-center gap-2.5 rounded-2xl border-[1.5px] px-3 py-2.5 text-left ${
                  on ? "border-tk-flood bg-tk-flood text-white shadow-tk-flood-btn" : "border-tk-line bg-white text-tk-ink-strong"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    on ? "bg-white/15 text-white" : "bg-tk-flood-soft text-tk-flood"
                  }`}
                >
                  <TypeIcon type={t} size={24} />
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="text-[13.5px] font-bold leading-[1.25]">{REQUEST_TYPE_META[t].label}</span>
                  <span className="text-[10.5px] leading-[1.3] opacity-80">{REQUEST_TYPE_META[t].description}</span>
                </span>
              </button>
            );
          })}
        </div>
        {triedSubmit && !type && <p className="mt-1.5 text-[12px] text-tk-overdue-ink">กรุณาเลือกเรื่องที่ต้องการความช่วยเหลือ</p>}
      </section>

      {/* ขั้น 2 */}
      <section className="mx-4 mt-[18px]">
        <StepTitle n={2}>จุดที่ต้องการความช่วยเหลือ</StepTitle>
        <LocationPicker value={location} onChange={setLocation} />
        {triedSubmit && !location && <p className="mt-1.5 text-[12px] text-tk-overdue-ink">กรุณาระบุตำแหน่ง</p>}
        <label htmlFor="flood-landmark" className="mt-2.5 block text-[12px] font-semibold text-tk-ink-3">
          บ้านเลขที่ / จุดสังเกต <span className="font-normal text-tk-ink-6">(ถ้ามี)</span>
        </label>
        <input
          id="flood-landmark"
          type="text"
          value={landmark}
          maxLength={200}
          onChange={(e) => setLandmark(e.target.value)}
          placeholder="เช่น บ้านเลขที่ 42 ตรงข้ามร้านขายของชำ"
          className={INPUT}
        />
      </section>

      {/* ขั้น 3 */}
      <section className="mx-4 mt-[18px]">
        <StepTitle n={3}>ติดต่อกลับ</StepTitle>
        <label htmlFor="flood-phone" className="mt-2.5 block text-[12px] font-semibold text-tk-ink-3">
          เบอร์โทรศัพท์ <span className="text-tk-overdue-ink">*</span>
        </label>
        <input
          id="flood-phone"
          ref={phoneRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          maxLength={16}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08x-xxx-xxxx"
          aria-invalid={triedSubmit && !phoneOk}
          className="mt-1.5 h-[52px] w-full rounded-[14px] border-[1.5px] border-tk-flood bg-white px-3.5 text-[18px] font-semibold tracking-[1px] text-tk-ink-strong placeholder:font-normal placeholder:text-tk-ink-6 focus:outline-none"
        />
        {triedSubmit && !phoneOk && <p className="mt-1.5 text-[12px] text-tk-overdue-ink">กรุณากรอกเบอร์โทร 9–10 หลัก</p>}

        <div className="mt-3 text-[12px] font-semibold text-tk-ink-3">ความเร่งด่วน</div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {URGENCIES.map((u) => {
            const on = urgency === u;
            return (
              <button
                key={u}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setUrgency(u);
                  setUrgencyTouched(true);
                }}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[14px] border-[1.5px] px-1 py-1.5 ${
                  on ? URGENCY_STYLE[u].on : URGENCY_STYLE[u].off
                }`}
              >
                <span className="text-[13px] font-bold leading-[1.2]">{URGENCY_META[u].label}</span>
                <span className="text-[10px] leading-[1.3] opacity-85">{URGENCY_META[u].description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="flood-people" className="block text-[12px] font-semibold text-tk-ink-3">
              จำนวนคนในบ้าน
            </label>
            <input
              id="flood-people"
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={people}
              onChange={(e) => setPeople(e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="เช่น 4"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="flood-name" className="block text-[12px] font-semibold text-tk-ink-3">
              ชื่อผู้แจ้ง <span className="font-normal text-tk-ink-6">(ถ้ามี)</span>
            </label>
            <input
              id="flood-name"
              type="text"
              autoComplete="name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อ-สกุล"
              className={INPUT}
            />
          </div>
        </div>

        <label htmlFor="flood-detail" className="mt-3 block text-[12px] font-semibold text-tk-ink-3">
          รายละเอียดเพิ่มเติม <span className="font-normal text-tk-ink-6">(ถ้ามี)</span>
        </label>
        <textarea
          id="flood-detail"
          rows={2}
          value={detail}
          maxLength={1000}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="เช่น น้ำสูงถึงเข่า มีผู้สูงอายุ 1 คน เดินไม่ได้"
          className="mt-1.5 w-full resize-none rounded-[14px] border border-tk-line bg-white px-3.5 py-[11px] text-[14px] leading-[1.45] text-tk-ink-strong placeholder:text-tk-ink-6 focus:border-tk-flood focus:outline-none"
        />

        {showPhotos ? (
          <div className="mt-2.5">
            <PhotoUploader value={images} onChange={setImages} onUploadingChange={setUploading} maxImages={3} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPhotos(true)}
            className="mt-2.5 flex h-[46px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-tk-unclaimed-line bg-white text-[13px] font-semibold text-tk-ink-3"
          >
            <Camera size={18} aria-hidden />
            ถ่ายรูปสถานการณ์ (ถ้ามี)
          </button>
        )}
      </section>

      <div className="h-6" />

      {/* ปุ่มส่ง sticky ล่าง */}
      <div className="sticky bottom-0 z-[500] border-t border-tk-line bg-white/95 px-4 pb-6 pt-3 shadow-[0_-6px_20px_rgba(60,40,100,0.08)] backdrop-blur">
        {error && (
          <p role="alert" className="mb-2 rounded-xl bg-tk-overdue-soft px-3 py-2 text-[12.5px] font-semibold text-tk-overdue-ink">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          aria-disabled={!ready}
          className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-[17px] font-bold text-white ${
            ready ? "bg-tk-emergency shadow-tk-emergency" : "bg-tk-ink-7"
          }`}
        >
          {submitting ? <LoaderCircle size={20} className="animate-spin" aria-hidden /> : <Send size={20} aria-hidden />}
          {submitting ? "กำลังส่ง…" : uploading ? "รอรูปอัปโหลดเสร็จ…" : "ส่งคำขอความช่วยเหลือ"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-[1.45] text-tk-ink-4">
          ข้อมูลส่งถึงศูนย์ฯ ทันที เจ้าหน้าที่จะโทรกลับตามเบอร์ที่ให้ไว้
          <br />
          เบอร์โทรใช้ติดต่อกลับเท่านั้น ไม่เปิดเผยสาธารณะ
        </p>
      </div>
    </>
  );
}
