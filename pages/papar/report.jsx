// แจ้งน้ำประปาขุ่น / ไม่ไหล — ฟอร์มประชาชน (ไม่ต้องล็อกอิน) ทางเข้าจากการ์ดบนหน้า /papar
// ส่งไป POST /api/smart-papar/water-reports → บันทึก + การ์ด LINE เข้ากลุ่มเจ้าหน้าที่เดิม
// ใช้ CitizenShell — /papar/report ต้องอยู่ในรายการ citizen route ของ components/Layout.js
import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Camera, Check, ChevronLeft, Droplet, Droplets, LocateFixed, ShowerHead, Waves, Wind, X } from "lucide-react";
import CitizenShell from "@/components/citizen/CitizenShell";
import { uploadImage } from "@/lib/smart-light/uploadImage";
import { resizeImage } from "@/lib/smart-papar/resizeImage";
import { MAX_REPORT_PHOTOS, WATER_SINCE, WATER_SYMPTOMS, maskPhone, validateWaterReportInput } from "@/lib/smart-papar/waterReport";

const ReportLocationMap = dynamic(() => import("@/components/smart-papar/ReportLocationMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#EDEAF3]" />,
});

const SYMPTOM_UI = [
  { key: "turbid", hint: "มีตะกอน สีชา/สีส้ม", Icon: Droplets },
  { key: "no_water", hint: "เปิดก๊อกแล้วไม่มีน้ำ", Icon: ShowerHead },
  { key: "weak", hint: "ไหลเบากว่าปกติ", Icon: Waves },
  { key: "odd", hint: "กลิ่นคลอรีนแรง กลิ่นเหม็น", Icon: Wind },
];

const card = "space-y-3 rounded-[20px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]";
const inputCls =
  "h-[50px] w-full rounded-[14px] border-[1.5px] border-[#DCD5EC] bg-white px-3.5 text-base text-[#1B1830] focus:border-[#7C3AED] focus:outline-none";

function Err({ msg }) {
  return msg ? <p className="text-sm text-[#B91C1C]">{msg}</p> : null;
}

function SuccessView({ ticket, communityName, sent }) {
  const lineUrl = process.env.NEXT_PUBLIC_LINE_OA_URL;
  const symptoms = sent.symptoms.map((s) => WATER_SYMPTOMS[s]).join(" · ");
  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-5 px-5 pb-8 pt-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="grid h-[104px] w-[104px] place-items-center rounded-full bg-[#EDE5FD]">
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-[#7C3AED] text-white">
            <Check size={38} strokeWidth={2.8} aria-hidden />
          </span>
        </span>
        <h1 className="text-[28px] font-bold" aria-live="polite">
          ส่งเรื่องแล้ว
        </h1>
        <p className="max-w-[300px] text-[15px] leading-relaxed text-[#6B6880]">
          กองการประปาได้รับเรื่องแล้ว เจ้าหน้าที่จะตรวจสอบจุดของคุณ
        </p>
      </div>

      <div className="space-y-3 rounded-[20px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.06)]">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-[#6B6880]">เลขที่เรื่อง</span>
          <span className="text-lg font-bold tracking-wide">{ticket}</span>
        </div>
        <div className="h-px bg-[#F1F0F5]" />
        <dl className="grid grid-cols-[84px_1fr] gap-y-2 text-sm">
          <dt className="text-[#6B6880]">อาการ</dt>
          <dd>
            {symptoms} · เริ่ม{WATER_SINCE[sent.since]}
          </dd>
          <dt className="text-[#6B6880]">ตำแหน่ง</dt>
          <dd>{communityName ? `ชุมชน${communityName}` : "ตามหมุดที่ปักไว้"}</dd>
          <dt className="text-[#6B6880]">ผู้แจ้ง</dt>
          <dd>
            {sent.prefix}
            {sent.fullName} · {maskPhone(sent.phone)}
          </dd>
        </dl>
        <p className="text-xs text-[#6B6880]">จดเลขที่เรื่องไว้ หากโทรสอบถามกองการประปา</p>
      </div>

      {lineUrl && (
        <a
          href={lineUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-[#BBF7D0] bg-white px-4 py-3.5"
        >
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#06C755] text-xs font-bold text-white">LINE</span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">เพิ่มเพื่อน LINE เทศบาล</span>
            <span className="block text-[13px] text-[#6B6880]">ติดตามข่าวสารน้ำประปาและบริการอื่น ๆ</span>
          </span>
        </a>
      )}

      <div className="mt-auto">
        <Link
          href="/papar"
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#7C3AED] text-[17px] font-bold text-white"
        >
          กลับหน้าคุณภาพน้ำ
        </Link>
      </div>
    </div>
  );
}

export default function PaparReportPage() {
  const [symptoms, setSymptoms] = useState([]);
  const [since, setSince] = useState("");
  const [point, setPoint] = useState(null); // [lat, lng]
  const [accuracy, setAccuracy] = useState(null);
  const [community, setCommunity] = useState({ state: "idle", name: null }); // idle | loading | done
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [addressNote, setAddressNote] = useState("");
  const [photos, setPhotos] = useState([]); // { key, file, preview, url, status }
  const [prefix, setPrefix] = useState("นาย");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ticket, communityName, sent }
  const [plantNtu, setPlantNtu] = useState(null);
  const fileRef = useRef(null);

  // ค่าที่โรงกรองวันนี้ — ช่วยอธิบายว่าน้ำขุ่นที่บ้านอาจมาจากท่อในพื้นที่ (โหลดไม่ได้ก็ไม่แสดง)
  useEffect(() => {
    fetch("/api/smart-papar/water-quality/public-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const v = d?.data?.latest?.ntu;
        if (v !== null && v !== undefined) setPlantNtu(Number(v));
      })
      .catch(() => {});
  }, []);

  // ชุมชนจากพิกัด — หน่วง 600ms ระหว่างลากหมุด
  useEffect(() => {
    if (!point) return;
    setCommunity({ state: "loading", name: null });
    const t = setTimeout(() => {
      fetch(`/api/smart-papar/water-reports/locate?lat=${point[0]}&lng=${point[1]}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setCommunity({ state: "done", name: d?.data?.communityName || null }))
        .catch(() => setCommunity({ state: "done", name: null }));
    }, 600);
    return () => clearTimeout(t);
  }, [point]);

  const toggleSymptom = (k) =>
    setSymptoms((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const locate = () => {
    if (!navigator.geolocation) {
      setLocError("อุปกรณ์นี้ไม่รองรับการหาตำแหน่ง — แตะบนแผนที่เพื่อปักหมุดแทน");
      return;
    }
    setLocating(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
        setLocating(false);
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "ยังไม่อนุญาตให้เข้าถึงตำแหน่ง — เปิดสิทธิ์ในตั้งค่ามือถือ หรือแตะบนแผนที่เพื่อปักหมุดแทน"
            : "หาตำแหน่งไม่สำเร็จ — แตะบนแผนที่เพื่อปักหมุดแทน"
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const onMapChange = (lat, lng) => {
    setPoint([lat, lng]);
    setAccuracy(null); // ปรับเองแล้ว ความแม่นยำ GPS ไม่เกี่ยวแล้ว
  };

  const startUpload = async (key, file) => {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, status: "uploading" } : p)));
    try {
      const url = await uploadImage(await resizeImage(file));
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, url, status: "done" } : p)));
    } catch {
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, status: "error" } : p)));
    }
  };

  const onPick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    files.slice(0, MAX_REPORT_PHOTOS - photos.length).forEach((file) => {
      const key = `${Date.now()}-${Math.random()}`;
      setPhotos((prev) => [...prev, { key, file, preview: URL.createObjectURL(file), url: "", status: "uploading" }]);
      startUpload(key, file);
    });
  };

  const payload = {
    symptoms,
    since,
    lat: point?.[0],
    lng: point?.[1],
    accuracyM: accuracy,
    addressNote,
    photos: photos.filter((p) => p.status === "done").map((p) => p.url),
    prefix,
    fullName,
    phone,
    consent,
  };
  const check = validateWaterReportInput(payload);
  const uploading = photos.some((p) => p.status === "uploading");
  const firstMissing = ["symptoms", "since", "location", "fullName", "phone", "consent"].find((k) => check.errors[k]);

  const submit = async () => {
    if (!check.ok || uploading || submitting) {
      setErrors(check.errors);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/smart-papar/water-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setErrors(data?.errors || { form: data?.message || "ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้ง" });
        return;
      }
      setResult({ ...data.data, sent: check.value });
      window.scrollTo?.(0, 0);
    } catch {
      setErrors({ form: "เชื่อมต่อไม่ได้ ข้อมูลที่กรอกยังอยู่ — ลองกดส่งอีกครั้ง" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>แจ้งน้ำประปาขุ่น / ไม่ไหล | เทศบาลเมืองตาคลี</title>
        <meta name="description" content="แจ้งปัญหาน้ำประปาขุ่นหรือไม่ไหลถึงกองการประปาเทศบาลเมืองตาคลี" />
      </Head>
      <CitizenShell hideNav>
        {result ? (
          <SuccessView {...result} />
        ) : (
          <div className="flex min-h-full flex-col">
            <div className="flex items-start gap-1 border-b border-[#ECEAF2] bg-white pb-3.5 pl-2 pr-4 pt-2">
              <Link href="/papar" aria-label="กลับ" className="grid h-11 w-11 flex-none place-items-center text-[#1B1830]">
                <ChevronLeft size={22} aria-hidden />
              </Link>
              <div className="pt-1.5">
                <h1 className="text-xl font-bold leading-snug">แจ้งน้ำประปาขุ่น / ไม่ไหล</h1>
                <p className="text-[13px] text-[#6B6880]">ส่งตรงถึงกองการประปา · ใช้เวลาไม่ถึง 1 นาที</p>
              </div>
            </div>

            <div className="flex-1 space-y-3.5 px-4 pb-5 pt-3.5">
              {plantNtu !== null && plantNtu <= 5 && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-[#E6F1FE] px-3.5 py-3 text-[13px] leading-relaxed text-[#1E3A8A]">
                  <Droplet size={20} className="mt-0.5 flex-none text-[#2563EB]" aria-hidden />
                  <span>
                    ที่โรงกรองล่าสุดน้ำใส <b>{plantNtu.toFixed(2)} NTU</b> ถ้าที่บ้านขุ่น อาจเกิดจากท่อในพื้นที่
                    การแจ้งจุดช่วยให้เจ้าหน้าที่ไปโบตะกอนได้ตรงที่
                  </span>
                </div>
              )}

              <section className={card}>
                <div className="flex items-baseline justify-between">
                  <h2 className="font-bold">1. เกิดอะไรขึ้น</h2>
                  <span className="text-xs text-[#6B6880]">เลือกได้หลายข้อ</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SYMPTOM_UI.map(({ key, hint, Icon }) => {
                    const on = symptoms.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleSymptom(key)}
                        className={`flex min-h-[112px] flex-col items-start gap-1 rounded-2xl p-3 text-left ${
                          on ? "border-2 border-[#2563EB] bg-[#EFF6FF]" : "border-[1.5px] border-[#ECEAF2] bg-white"
                        }`}
                      >
                        <span
                          className={`mb-1 grid h-10 w-10 place-items-center rounded-xl ${
                            on ? "bg-[#2563EB] text-white" : "bg-[#E6F1FE] text-[#2563EB]"
                          }`}
                        >
                          <Icon size={22} aria-hidden />
                        </span>
                        <span className="text-[15px] font-semibold">{WATER_SYMPTOMS[key]}</span>
                        <span className="text-xs text-[#6B6880]">{hint}</span>
                      </button>
                    );
                  })}
                </div>
                <Err msg={errors.symptoms} />
              </section>

              <section className={card}>
                <h2 className="font-bold">2. เริ่มเป็นตั้งแต่เมื่อไหร่</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(WATER_SINCE).map(([k, label]) => {
                    const on = since === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSince(k)}
                        className={`h-11 rounded-full px-4 text-sm ${
                          on
                            ? "border-[1.5px] border-[#7C3AED] bg-[#7C3AED] font-semibold text-white"
                            : "border-[1.5px] border-[#ECEAF2] bg-white"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <Err msg={errors.since} />
              </section>

              <section className={card}>
                <h2 className="font-bold">3. บ้านอยู่ตรงไหน</h2>
                <div className="relative h-[190px] overflow-hidden rounded-[14px]">
                  <ReportLocationMap point={point} onChange={onMapChange} className="h-full w-full" />
                  <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-[500] rounded-lg bg-[#1B1830]/75 px-2 py-1 text-xs text-white">
                    {point ? "ลากหมุดให้ตรงบ้าน" : "แตะบนแผนที่เพื่อปักหมุด"}
                  </span>
                </div>
                {point ? (
                  <div className="flex items-center gap-2.5 rounded-[14px] bg-[#F6F5FA] px-3 py-2.5">
                    <Check size={20} strokeWidth={2.6} className="flex-none text-[#15803D]" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        ได้ตำแหน่งแล้ว
                        {community.state === "loading"
                          ? " · กำลังหาชุมชน…"
                          : community.name
                          ? ` · ชุมชน${community.name}`
                          : ""}
                      </span>
                      {accuracy != null && (
                        <span className="block text-xs text-[#6B6880]">แม่นยำ ±{Math.round(accuracy)} ม.</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={locate}
                      disabled={locating}
                      className="h-10 rounded-xl border-[1.5px] border-[#DCD5EC] bg-white px-3 text-[13px] font-semibold text-[#6D28D9] disabled:opacity-60"
                    >
                      {locating ? "กำลังหา…" : "ใหม่"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={locate}
                    disabled={locating}
                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2563EB] font-semibold text-white disabled:opacity-60"
                  >
                    <LocateFixed size={20} aria-hidden />
                    {locating ? "กำลังหาตำแหน่ง…" : "ใช้ตำแหน่งปัจจุบัน"}
                  </button>
                )}
                <Err msg={locError || errors.location} />
                <div className="space-y-1.5">
                  <label htmlFor="wr-address" className="block text-sm font-semibold">
                    บ้านเลขที่ / จุดสังเกต <span className="font-normal text-[#6B6880]">(ไม่บังคับ)</span>
                  </label>
                  <input
                    id="wr-address"
                    className={inputCls}
                    maxLength={200}
                    placeholder="เช่น 45/2 ซอยข้างวัด บ้านรั้วสีเขียว"
                    value={addressNote}
                    onChange={(e) => setAddressNote(e.target.value)}
                  />
                </div>
              </section>

              <section className={card}>
                <div className="flex items-baseline justify-between">
                  <h2 className="font-bold">4. รูปน้ำ</h2>
                  <span className="text-xs text-[#6B6880]">ไม่บังคับ · สูงสุด {MAX_REPORT_PHOTOS} รูป</span>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {photos.map((p) => (
                    <div key={p.key} className="relative h-24 w-24 overflow-hidden rounded-[14px] bg-[#F1F0F5]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url || p.preview} alt="รูปน้ำ" className="h-full w-full object-cover" />
                      {p.status === "uploading" && (
                        <div className="absolute inset-0 grid place-items-center bg-black/45 text-xs text-white">กำลังอัปโหลด</div>
                      )}
                      {p.status === "error" && (
                        <button
                          type="button"
                          onClick={() => startUpload(p.key, p.file)}
                          className="absolute inset-0 grid place-items-center bg-[#B91C1C]/85 px-1 text-center text-xs font-semibold text-white"
                        >
                          ไม่สำเร็จ แตะลองใหม่
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="ลบรูป"
                        onClick={() => setPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#1B1830]/60 text-white"
                      >
                        <X size={14} strokeWidth={2.6} aria-hidden />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_REPORT_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-[#C4B5FD] bg-[#FAF7FF] text-[13px] font-semibold text-[#6D28D9]"
                    >
                      <Camera size={24} aria-hidden />
                      ถ่ายรูป
                    </button>
                  )}
                  {photos.length === 0 && (
                    <span className="min-w-0 flex-1 text-xs leading-relaxed text-[#6B6880]">
                      เคล็ดลับ: รองน้ำใส่แก้วใส ถ่ายข้างหน้าต่างให้เห็นสีน้ำ
                    </span>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onPick} />
              </section>

              <section className={card}>
                <h2 className="font-bold">5. ติดต่อกลับ</h2>
                <div className="flex gap-2">
                  <div className="w-24 flex-none space-y-1.5">
                    <label htmlFor="wr-prefix" className="block text-sm font-semibold">
                      คำนำหน้า
                    </label>
                    <select id="wr-prefix" className={`${inputCls} px-2.5`} value={prefix} onChange={(e) => setPrefix(e.target.value)}>
                      <option>นาย</option>
                      <option>นาง</option>
                      <option>นางสาว</option>
                    </select>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label htmlFor="wr-name" className="block text-sm font-semibold">
                      ชื่อ–นามสกุล
                    </label>
                    <input
                      id="wr-name"
                      className={inputCls}
                      autoComplete="name"
                      maxLength={100}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>
                <Err msg={errors.fullName} />
                <div className="space-y-1.5">
                  <label htmlFor="wr-phone" className="block text-sm font-semibold">
                    เบอร์โทร
                  </label>
                  <input
                    id="wr-phone"
                    className={inputCls}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="08x-xxx-xxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <span className="block text-xs text-[#6B6880]">เจ้าหน้าที่อาจโทรถามทางเข้าบ้าน · ไม่แสดงต่อสาธารณะ</span>
                  <Err msg={errors.phone} />
                </div>
                <label className="flex items-start gap-3 rounded-[14px] bg-[#F6F5FA] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-5 w-5 flex-none accent-[#7C3AED]"
                  />
                  <span className="text-[13px] leading-relaxed">
                    ยินยอมให้เทศบาลเมืองตาคลีใช้ชื่อ เบอร์โทร และตำแหน่งนี้ เพื่อตรวจสอบและติดต่อกลับเรื่องนี้เท่านั้น
                  </span>
                </label>
                <Err msg={errors.consent} />
              </section>
            </div>

            <div className="sticky bottom-0 space-y-2 border-t border-[#ECEAF2] bg-white px-4 pb-6 pt-3 shadow-[0_-6px_16px_rgba(60,40,100,0.08)]">
              {errors.form ? (
                <p className="text-[13px] text-[#B91C1C]">{errors.form}</p>
              ) : uploading ? (
                <p className="text-[13px] text-[#B45309]">รอรูปอัปโหลดให้เสร็จ…</p>
              ) : firstMissing ? (
                <p className="text-[13px] text-[#B45309]">ยังขาด: {check.errors[firstMissing]}</p>
              ) : null}
              <button
                type="button"
                onClick={submit}
                disabled={submitting || uploading}
                className={`h-14 w-full rounded-2xl text-lg font-bold text-white ${
                  check.ok && !uploading ? "bg-[#7C3AED]" : "bg-[#C4B5FD]"
                }`}
              >
                {submitting ? "กำลังส่ง…" : "ส่งเรื่องแจ้ง"}
              </button>
            </div>
          </div>
        )}
      </CitizenShell>
    </>
  );
}
