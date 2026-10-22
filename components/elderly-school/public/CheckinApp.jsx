// หน้าเช็คอินผู้สูงอายุ (สาธารณะ /elderly/checkin — ห้ามเปลี่ยน path เพราะ QR พิมพ์แจกแล้ว)
// ขั้นตอน: ยืนยันเลขบัตร 4 ตัวท้าย → (วันเรียน) กรอกค่าที่วัดได้ → สุขภาพของฉัน (สุขภาพ · ประวัติ · ตารางเรียน)
// ออกแบบสำหรับผู้สูงอายุ: ตัวอักษรใหญ่ ปุ่มสูง ≥56px ภาษาเรียบง่าย
import React, { useCallback, useMemo, useState } from "react";
import { formatThaiDate } from "@/lib/elderly-school/followUp";
import { personalSummary, personalTrend, visitHasData } from "@/lib/elderly-school/personal";
import { formatTimeRange } from "@/lib/elderly-school/schedule";
import { TONE_STYLES } from "../elderlyTheme";

const C = { primary: "#0E5A55", ground: "#F4F3EE", line: "#E4E2DA", ink: "#1D2421", muted: "#5B635F" };
const bigBtn =
  "flex items-center justify-center gap-2.5 w-full min-h-16 rounded-2xl bg-[#0E5A55] text-white text-[22px] font-bold hover:bg-[#083D3A] disabled:opacity-50";
const ghostBtn =
  "flex items-center justify-center gap-2.5 w-full min-h-14 rounded-2xl border border-[#D6D3C8] bg-white text-lg font-semibold text-[#1D2421] hover:bg-[#F4F3EE]";

async function callCheckin(body) {
  const res = await fetch("/api/elderly-school/checkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) throw new Error(json?.message || "ดำเนินการไม่สำเร็จ");
  return json;
}

function Icon({ d, size = 22, color = "currentColor", width = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  bp: "M3 12h4l3-8 4 16 3-8h4",
  weight: "M12 3a4 4 0 100 8 4 4 0 000-8zM5 21c0-4 3-7 7-7s7 3 7 7",
  waist: "M4 12h16M7 8c2-2 8-2 10 0M7 16c2 2 8 2 10 0",
  pulse: "M12 21s-7-4.5-7-11a4 4 0 017-2.6A4 4 0 0119 10c0 6.5-7 11-7 11z",
  check: "M5 12l5 5 9-10",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  trend: "M4 19V5M4 19h16M8 15l3-4 3 2 5-6",
  cal: "M3 5h18v16H3zM16 3v4M8 3v4M3 10h18",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  pin: "M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11zM12 8a2 2 0 100 4 2 2 0 000-4z",
  info: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5M12 16h.01",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2",
};

/** ปุ่มโทรหาเจ้าหน้าที่ (แสดงเมื่อแอดมินตั้งเบอร์ในแท็บตั้งค่าวันเรียน) */
function CallButton({ contact, variant = "primary" }) {
  if (!contact?.tel) return null;
  return (
    <a href={`tel:${contact.tel}`} className={variant === "primary" ? bigBtn + " !text-xl" : ghostBtn}>
      <Icon d={ICONS.phone} />
      <span className="flex flex-col items-start leading-tight">
        <span>โทรหาเจ้าหน้าที่</span>
        <span className={"text-[15px] font-medium " + (variant === "primary" ? "opacity-90" : "text-[#5B635F]")}>
          {[contact.name, contact.phone].filter(Boolean).join(" · ")}
        </span>
      </span>
    </a>
  );
}

function Banner({ tone = "ok", children }) {
  const t = TONE_STYLES[tone] || TONE_STYLES.ok;
  return (
    <div className="rounded-2xl px-4 py-3.5 text-[17px] font-semibold leading-relaxed" style={{ background: t.bg, color: t.fg }} role="status">
      {children}
    </div>
  );
}

// ── ขั้นที่ 1: ยืนยันตัวตน ───────────────────────────────────────

function VerifyStep({ nameHint, yearBE, onVerified }) {
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(
    async (code) => {
      setLoading(true);
      setError("");
      try {
        await onVerified(code);
      } catch (e) {
        setError(e?.message || "ยืนยันไม่สำเร็จ");
        setDigits("");
      } finally {
        setLoading(false);
      }
    },
    [onVerified]
  );

  const press = (k) => {
    if (loading) return;
    setError("");
    if (k === "clear") return setDigits("");
    if (k === "back") return setDigits((d) => d.slice(0, -1));
    if (digits.length >= 4) return;
    const next = digits + k;
    setDigits(next);
    if (next.length === 4) submit(next);
  };

  return (
    <>
      <div className="px-6 pt-7 pb-5 bg-[#0E5A55] text-white flex flex-col gap-1.5">
        <span className="text-base opacity-90">โรงเรียนผู้สูงอายุ · ปี {yearBE}</span>
        <h1 className="m-0 text-[28px] font-bold leading-snug">
          สวัสดีค่ะ
          {nameHint && (
            <>
              <br />
              คุณ{nameHint.replace(/^(นาย|นางสาว|นาง)\s*/, "")}
            </>
          )}
        </h1>
      </div>
      <div className="flex-1 p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-base font-semibold text-[#0E5A55]">ขั้นที่ 1</span>
          <h2 className="m-0 text-[22px] font-bold leading-snug">
            กรอกเลขบัตรประชาชน
            <br />4 ตัวท้าย
          </h2>
        </div>
        <label className="sr-only" htmlFor="last4">
          เลขบัตรประชาชน 4 ตัวท้าย
        </label>
        <input
          id="last4"
          className="sr-only"
          inputMode="numeric"
          autoComplete="off"
          value={digits}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setDigits(v);
            if (v.length === 4) submit(v);
          }}
        />
        <div className="grid grid-cols-4 gap-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < digits.length;
            const current = i === digits.length;
            return (
              <div
                key={i}
                className="h-[72px] rounded-2xl bg-white flex items-center justify-center text-[34px] font-bold"
                style={{ border: filled ? `2px solid ${C.primary}` : current ? "3px solid #E9A93B" : `2px solid #D6D3C8` }}
              >
                {digits[i] || ""}
              </div>
            );
          })}
        </div>
        {error && <Banner tone="see">{error}</Banner>}
        {loading && <Banner tone="none">กำลังตรวจสอบ...</Banner>}
        <div className="grid grid-cols-3 gap-2.5 mt-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={loading}
              aria-label={k === "clear" ? "ล้าง" : k === "back" ? "ลบ 1 ตัว" : k}
              className={
                "min-h-16 rounded-2xl border border-[#D6D3C8] bg-white font-semibold text-[#1D2421] active:bg-[#E3F0EE] disabled:opacity-50 " +
                (k === "clear" || k === "back" ? "text-lg" : "text-[28px]")
              }
            >
              {k === "clear" ? "ล้าง" : k === "back" ? "ลบ" : k}
            </button>
          ))}
        </div>
        <p className="m-0 text-base text-[#5B635F] text-center">ไม่ใช่ชื่อท่าน? แจ้งเจ้าหน้าที่หน้าห้อง</p>
      </div>
    </>
  );
}

// ── ขั้นที่ 2: กรอกค่าที่วัดได้ ──────────────────────────────────

function NumberField({ label, unit, value, onChange, mode = "decimal" }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-lg font-semibold">{label}</span>
      <span className="flex items-center gap-2 min-h-[60px] px-4 rounded-2xl border-2 border-[#D6D3C8] bg-white focus-within:border-[#0E5A55]">
        <input
          inputMode={mode}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          className="flex-1 min-w-0 border-0 outline-none bg-transparent text-2xl font-semibold"
        />
        <span className="text-base text-[#5B635F]">{unit}</span>
      </span>
    </label>
  );
}

function BpField({ label, optional, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-lg font-semibold">
        {label} {optional && <span className="text-base font-normal text-[#5B635F]">(ถ้ามี)</span>}
      </span>
      <div className="flex items-center gap-2.5">
        {["sys", "dia"].map((k, i) => (
          <React.Fragment key={k}>
            {i === 1 && <span className="text-[28px] text-[#5B635F]">/</span>}
            <label className="flex-1 flex items-center min-h-[60px] px-4 rounded-2xl border-2 border-[#D6D3C8] bg-white focus-within:border-[#0E5A55]">
              <span className="sr-only">{k === "sys" ? "ตัวบน" : "ตัวล่าง"}</span>
              <input
                inputMode="numeric"
                placeholder={k === "sys" ? "ตัวบน" : "ตัวล่าง"}
                value={value[k]}
                onChange={(e) => onChange({ ...value, [k]: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                className="w-full min-w-0 border-0 outline-none bg-transparent text-2xl font-semibold placeholder:text-lg placeholder:font-normal"
              />
            </label>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function FormStep({ fullName, visitNo, contact, onSubmit, onSkip }) {
  const [form, setForm] = useState({ weightKg: "", waistCm: "", pulseBpm: "" });
  const [bp1, setBp1] = useState({ sys: "", dia: "" });
  const [bp2, setBp2] = useState({ sys: "", dia: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bpText = (b) => (b.sys && b.dia ? `${b.sys}/${b.dia}` : "");
  const half = (b) => Boolean(b.sys) !== Boolean(b.dia);

  const submit = async () => {
    if (half(bp1) || half(bp2)) {
      setError("กรอกความดันให้ครบทั้งตัวบนและตัวล่าง");
      return;
    }
    if (!form.weightKg && !form.waistCm && !form.pulseBpm && !bpText(bp1) && !bpText(bp2)) {
      setError("กรุณากรอกอย่างน้อย 1 ช่อง");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit({ ...form, bp1: bpText(bp1), bp2: bpText(bp2) });
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="px-6 pt-6 pb-4 bg-white border-b border-[#E4E2DA] flex flex-col gap-2.5">
        <div className="flex justify-between items-center gap-3">
          <span className="text-base font-semibold text-[#0E5A55]">ขั้นที่ 2 · ครั้งที่ {visitNo}</span>
          <span className="text-base text-[#5B635F] truncate">{fullName}</span>
        </div>
        <h1 className="m-0 text-[24px] font-bold">ค่าสุขภาพวันนี้</h1>
        <p className="m-0 text-base text-[#5B635F]">ให้เจ้าหน้าที่ช่วยวัดได้ · ไม่มีค่าไหนเว้นว่างไว้</p>
      </div>
      <div className="flex-1 p-6 flex flex-col gap-4">
        <NumberField label="น้ำหนัก" unit="กิโลกรัม" value={form.weightKg} onChange={(v) => setForm((s) => ({ ...s, weightKg: v }))} />
        <NumberField label="รอบเอว" unit="เซนติเมตร" value={form.waistCm} onChange={(v) => setForm((s) => ({ ...s, waistCm: v }))} />
        <NumberField label="ชีพจร" unit="ครั้ง/นาที" mode="numeric" value={form.pulseBpm} onChange={(v) => setForm((s) => ({ ...s, pulseBpm: v }))} />
        <BpField label="ความดัน รอบที่ 1" value={bp1} onChange={setBp1} />
        <BpField label="ความดัน รอบที่ 2" optional value={bp2} onChange={setBp2} />
        {error && <Banner tone="see">{error}</Banner>}
        <CallButton contact={contact} variant="ghost" />
      </div>
      <div className="px-6 pt-4 pb-7 bg-white border-t border-[#E4E2DA] flex flex-col gap-2.5">
        <button type="button" className={bigBtn} onClick={submit} disabled={loading}>
          {loading ? "กำลังบันทึก..." : "ส่งข้อมูล"}
        </button>
        <button type="button" className="min-h-12 text-base font-semibold text-[#0E5A55]" onClick={onSkip}>
          ข้ามไปดูสุขภาพของฉัน
        </button>
      </div>
    </>
  );
}

// ── ขั้นที่ 3: สุขภาพของฉัน ──────────────────────────────────────

function HealthTab({ data, banner, successVisitNo }) {
  const s = useMemo(() => personalSummary(data.visits, data.person?.heightCm), [data]);
  const doneSessions = (data.schedule || []).filter((x) => x.dateISO <= data.today).length;
  const cameNos = new Set((data.visits || []).filter(visitHasData).map((v) => v.visitNo));
  const scheduledNos = new Map((data.schedule || []).map((x) => [x.visitNo, x]));
  const next = (data.schedule || []).find((x) => x.dateISO > data.today) || null;
  const heroDots = s.metrics.map((m) => TONE_STYLES[m.tone]?.bar || "#E4E2DA");

  return (
    <div className="flex flex-col gap-3.5">
      {successVisitNo && (
        <div className="flex flex-col items-center gap-2.5 py-3 text-center">
          <div className="w-[72px] h-[72px] rounded-full bg-[#E5F3EA] flex items-center justify-center">
            <Icon d={ICONS.check} size={40} color="#1B5E3A" width={2.5} />
          </div>
          <span className="text-[26px] font-bold">บันทึกเรียบร้อย</span>
          <span className="text-[17px] text-[#3C4541]">ครั้งที่ {successVisitNo} · ขอบคุณค่ะ</span>
        </div>
      )}
      {banner && <Banner tone="low">{banner}</Banner>}

      <div className="p-5 rounded-[20px] bg-[#0E5A55] text-white flex flex-col gap-3">
        <span className="text-base opacity-90">{s.latestVisitNo ? `ผลวัดล่าสุด ครั้งที่ ${s.latestVisitNo}` : "ภาพรวม"}</span>
        <span className="text-[22px] font-bold leading-snug">
          {s.lead && (
            <>
              {s.lead}
              <br />
            </>
          )}
          {s.headline}
        </span>
        {heroDots.length > 0 && (
          <div className="flex gap-2" aria-hidden="true">
            {heroDots.map((c, i) => (
              <span key={i} className="flex-1 h-2 rounded-full" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>

      {s.metrics.length > 0 && (
        <ul className="m-0 p-0 list-none bg-white border border-[#E4E2DA] rounded-[18px] overflow-hidden">
          {s.metrics.map((m) => {
            const t = TONE_STYLES[m.tone] || TONE_STYLES.none;
            return (
              <li key={m.key} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#EFEDE6] last:border-b-0">
                <span className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center" style={{ background: t.bg }}>
                  <Icon d={ICONS[m.key]} color={t.fg} />
                </span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[17px] font-semibold">{m.name}</span>
                  <span className="text-[15px] font-semibold leading-snug" style={{ color: m.tone === "none" ? C.muted : t.fg }}>
                    {m.status}
                  </span>
                  {m.sub && <span className="text-sm text-[#5B635F]">{m.sub}</span>}
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-2xl font-bold leading-tight">{m.value}</span>
                  <span className="text-[13px] text-[#5B635F]">{m.unit}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="p-4 bg-white border border-[#E4E2DA] rounded-[18px] flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline gap-2">
          <span className="text-[17px] font-bold">การมาเรียน</span>
          <span className="text-[17px] font-bold text-[#0E5A55]">
            {s.attended}
            {doneSessions ? ` จาก ${doneSessions} ครั้ง` : " ครั้ง"}
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1.5" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => {
            const no = i + 1;
            const came = cameNos.has(no);
            const sess = scheduledNos.get(no);
            const missed = !came && sess && sess.dateISO < data.today;
            return (
              <span
                key={no}
                className="h-[18px] rounded-md"
                style={{ background: came ? "#4E9C8F" : missed ? "#FFFFFF" : "#E7E5DD", border: missed ? "2px dashed #B9B5A8" : 0 }}
              />
            );
          })}
        </div>
        {next && (
          <span className="text-[15px] text-[#3C4541]">
            ครั้งถัดไป ครั้งที่ {next.visitNo} · {formatThaiDate(next.dateISO)}
            {formatTimeRange(next.startTime, next.endTime) ? ` · ${formatTimeRange(next.startTime, next.endTime)}` : ""}
          </span>
        )}
      </div>

      <CallButton contact={data.contact} />

      <p className="m-0 px-1 text-sm text-[#5B635F] leading-relaxed">
        ผลนี้เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย หากมีอาการผิดปกติหรือไม่แน่ใจ ปรึกษาเจ้าหน้าที่ได้ทุกครั้ง
      </p>
    </div>
  );
}

const TREND_TABS = [
  ["bp", "ความดัน", "ความดันตัวบน", "มม.ปรอท"],
  ["weight", "น้ำหนัก", "น้ำหนัก", "กก."],
  ["waist", "รอบเอว", "รอบเอว", "ซม."],
];

function HistoryTab({ data }) {
  const [key, setKey] = useState("bp");
  const trend = useMemo(() => personalTrend(data.visits, key), [data, key]);
  const meta = TREND_TABS.find((t) => t[0] === key);
  const values = trend.map((t) => t.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, max - min);
  const toneBar = { ok: "#4E9C8F", care: "#E3C37E", see: "#D9A096", none: "#9FBFBA" };

  return (
    <div className="flex flex-col gap-3.5">
      <div role="tablist" aria-label="เลือกค่าที่ดู" className="grid grid-cols-3 gap-1 p-1 rounded-[14px] bg-[#E7E5DD]">
        {TREND_TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={key === k}
            onClick={() => setKey(k)}
            className={"min-h-12 rounded-xl text-[17px] font-semibold " + (key === k ? "bg-white text-[#0E5A55] shadow-sm" : "text-[#3C4541]")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 bg-white border border-[#E4E2DA] rounded-[18px] flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <span className="text-[17px] font-bold">{meta[2]}</span>
          <span className="text-sm text-[#5B635F]">{meta[3]}</span>
        </div>
        {trend.length === 0 ? (
          <span className="py-6 text-center text-base text-[#5B635F]">ยังไม่มีข้อมูล</span>
        ) : (
          <>
            {/* แท่ง + ตัวเลขค่า + เลขครั้ง อยู่คอลัมน์เดียวกัน → ไม่เหลื่อมกัน และ grid minmax(0,1fr) ไม่ล้นการ์ดแม้ครบ 16 ครั้ง */}
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))`, maxWidth: `${trend.length * 44}px` }}
            >
              {trend.map((t) => (
                <div key={t.visitNo} className="min-w-0 flex flex-col items-center">
                  <div className="h-[150px] w-full flex flex-col items-center justify-end gap-1 border-b border-[#D6D3C8]">
                    <span className={"font-semibold text-[#3C4541] whitespace-nowrap " + (trend.length > 12 ? "text-[10px]" : "text-xs")}>{t.value}</span>
                    <div className="w-full rounded-t-md" style={{ height: `${24 + ((t.value - min) / span) * 96}px`, background: toneBar[t.tone] }} />
                  </div>
                  <span className="pt-1 text-xs text-center text-[#5B635F]">{t.visitNo}</span>
                </div>
              ))}
            </div>
            <span className="text-sm text-[#5B635F]">ตัวเลขใต้แท่ง = ครั้งที่</span>
          </>
        )}
      </div>

      {trend.length > 0 && (
        <ul className="m-0 p-0 list-none bg-white border border-[#E4E2DA] rounded-[18px] overflow-hidden">
          {[...trend].reverse().slice(0, 5).map((t) => {
            const tone = TONE_STYLES[t.tone];
            return (
              <li key={t.visitNo} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#EFEDE6] last:border-b-0">
                <span className="flex-1 text-base font-semibold">ครั้งที่ {t.visitNo}</span>
                <span className="text-xl font-bold">{t.label}</span>
                {key === "bp" && tone && t.tone !== "none" && (
                  <span className="text-[13px] font-semibold px-2.5 py-1 rounded-full" style={{ background: tone.bg, color: tone.fg }}>
                    {t.tone === "ok" ? "ดี" : t.tone === "care" ? "ควรดูแล" : "พบเจ้าหน้าที่"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data.lastAssessmentDate && (
        <div className="p-4 bg-white border border-[#E4E2DA] rounded-[18px] flex flex-col gap-0.5">
          <span className="text-[17px] font-bold">สุขภาพใจ</span>
          <span className="text-[15px] text-[#3C4541]">พูดคุยกับเจ้าหน้าที่ล่าสุด {formatThaiDate(data.lastAssessmentDate)}</span>
        </div>
      )}
    </div>
  );
}

function SessionCard({ s, highlight, today }) {
  const time = formatTimeRange(s.startTime, s.endTime);
  const isToday = s.dateISO === today;
  return (
    <div className={"p-4 rounded-[18px] flex flex-col gap-2 " + (highlight ? "bg-[#0E5A55] text-white" : "bg-white border border-[#E4E2DA]")}>
      <span className={"text-[15px] font-semibold " + (highlight ? "opacity-90" : "text-[#0E5A55]")}>
        {highlight ? (isToday ? "วันนี้ · " : "ครั้งถัดไป · ") : ""}ครั้งที่ {s.visitNo}
      </span>
      <span className="text-[22px] font-bold leading-snug">{formatThaiDate(s.dateISO)}</span>
      {s.note && <span className="text-[17px]">{s.note}</span>}
      <div className="flex flex-col gap-1 text-base">
        {time && (
          <span className="flex items-center gap-2">
            <Icon d={ICONS.clock} size={18} /> {time}
          </span>
        )}
        {s.location && (
          <span className="flex items-center gap-2">
            <Icon d={ICONS.pin} size={18} /> {s.location}
          </span>
        )}
        {s.prepare && (
          <span className="flex items-start gap-2">
            <Icon d={ICONS.check} size={18} /> <span>ควรเตรียม: {s.prepare}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function ScheduleTabView({ data }) {
  const sessions = data.schedule || [];
  const cameNos = new Set((data.visits || []).filter(visitHasData).map((v) => v.visitNo));
  const upcoming = sessions.filter((s) => s.dateISO >= data.today);
  const past = sessions.filter((s) => s.dateISO < data.today).reverse();
  const [showAll, setShowAll] = useState(false);

  if (!sessions.length) {
    return (
      <div className="flex flex-col gap-3.5">
        <Banner tone="none">ยังไม่มีตารางเรียนของปีนี้ — สอบถามเจ้าหน้าที่ได้ค่ะ</Banner>
        <CallButton contact={data.contact} variant="ghost" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      {upcoming[0] ? (
        <SessionCard s={upcoming[0]} highlight today={data.today} />
      ) : (
        <Banner tone="ok">เรียนครบทุกครั้งของปีนี้แล้ว ขอบคุณที่มาร่วมเรียนค่ะ</Banner>
      )}
      {upcoming.length > 1 && (
        <>
          <span className="px-1 text-[15px] font-bold text-[#5B635F]">กำลังจะมาถึง</span>
          {(showAll ? upcoming.slice(1) : upcoming.slice(1, 4)).map((s) => (
            <SessionCard key={s.visitNo} s={s} today={data.today} />
          ))}
          {upcoming.length > 4 && (
            <button type="button" className="min-h-12 text-base font-semibold text-[#0E5A55]" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "ย่อรายการ" : `ดูอีก ${upcoming.length - 4} ครั้ง`}
            </button>
          )}
        </>
      )}
      {past.length > 0 && (
        <>
          <span className="px-1 text-[15px] font-bold text-[#5B635F]">ผ่านมาแล้ว</span>
          <ul className="m-0 p-0 list-none bg-white border border-[#E4E2DA] rounded-[18px] overflow-hidden">
            {past.map((s) => {
              const came = cameNos.has(s.visitNo);
              const t = came ? TONE_STYLES.ok : TONE_STYLES.none;
              return (
                <li key={s.visitNo} className="flex items-center gap-3 px-4 py-3 border-b border-[#EFEDE6] last:border-b-0">
                  <span className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: t.bg, color: t.fg }}>
                    {s.visitNo}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[17px] font-semibold">{formatThaiDate(s.dateISO)}</span>
                    {s.note && <span className="text-sm text-[#5B635F] truncate">{s.note}</span>}
                  </span>
                  <span className="text-sm font-semibold px-2.5 py-1 rounded-full" style={{ background: t.bg, color: t.fg }}>
                    {came ? "มาเรียน" : "ไม่ได้มา"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <CallButton contact={data.contact} variant="ghost" />
    </div>
  );
}

const MY_TABS = [
  ["health", "สุขภาพ", ICONS.pulse],
  ["history", "ประวัติ", ICONS.trend],
  ["schedule", "ตารางเรียน", ICONS.cal],
];

function MyHealth({ data, banner, successVisitNo, onLogout }) {
  const [tab, setTab] = useState("health");
  const name = data.person?.fullName || "";
  return (
    <>
      <div className="px-5 pt-6 pb-4 flex justify-between items-start gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-base text-[#5B635F]">สวัสดีค่ะ</span>
          <span className="text-[26px] font-bold leading-snug">{name ? `คุณ${name.replace(/^(นาย|นางสาว|นาง)\s*/, "")}` : "สุขภาพของฉัน"}</span>
          <span className="text-[15px] text-[#5B635F]">โรงเรียนผู้สูงอายุ · ปี {data.yearBE}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          aria-label="ออก"
          className="w-12 h-12 shrink-0 rounded-full bg-white border border-[#E4E2DA] flex items-center justify-center text-[#3C4541]"
        >
          <Icon d={ICONS.logout} />
        </button>
      </div>
      <div className="flex-1 px-5 pb-6">
        {tab === "health" && <HealthTab data={data} banner={banner} successVisitNo={successVisitNo} />}
        {tab === "history" && <HistoryTab data={data} />}
        {tab === "schedule" && <ScheduleTabView data={data} />}
      </div>
      <nav aria-label="เมนูหลัก" className="sticky bottom-0 grid grid-cols-3 bg-white border-t border-[#E4E2DA] px-2 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
        {MY_TABS.map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              if (typeof window !== "undefined") window.scrollTo({ top: 0 });
            }}
            aria-current={tab === k ? "page" : undefined}
            className={
              "flex flex-col items-center justify-center gap-0.5 min-h-14 rounded-xl text-[15px] font-semibold " +
              (tab === k ? "bg-[#E3F0EE] text-[#0E5A55]" : "text-[#5B635F]")
            }
          >
            <Icon d={icon} />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

// ── ตัวหลัก ─────────────────────────────────────────────────────

export default function CheckinApp({ personId, yearBE, nameHint }) {
  const [step, setStep] = useState("verify"); // verify | form | health
  const [last4, setLast4] = useState("");
  const [verifyInfo, setVerifyInfo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [banner, setBanner] = useState("");
  const [successVisitNo, setSuccessVisitNo] = useState(null);
  const [error, setError] = useState("");

  const loadSummary = useCallback(
    async (code) => {
      const json = await callCheckin({ action: "summary", personId, yearBE, citizenIdLast4: code });
      setSummary(json);
      setStep("health");
    },
    [personId, yearBE]
  );

  const onVerified = useCallback(
    async (code) => {
      const json = await callCheckin({ action: "verify", personId, yearBE, citizenIdLast4: code });
      setLast4(code);
      setVerifyInfo(json);
      setSuccessVisitNo(null);
      if (json.canSubmitToday) {
        setStep("form");
        return;
      }
      setBanner(json.isClassDay ? `วันนี้บันทึกครั้งที่ ${json.scheduledVisitNo} ไว้แล้ว` : "วันนี้ไม่ใช่วันเรียน — ดูสุขภาพของท่านได้ด้านล่าง");
      await loadSummary(code);
    },
    [personId, yearBE, loadSummary]
  );

  const onSubmit = async (values) => {
    const json = await callCheckin({ action: "submit", personId, yearBE, citizenIdLast4: last4, ...values });
    setBanner("");
    setSuccessVisitNo(json.visitNo);
    try {
      await loadSummary(last4);
    } catch (e) {
      setError(e?.message || "โหลดสรุปไม่สำเร็จ");
    }
  };

  const logout = () => {
    setStep("verify");
    setLast4("");
    setSummary(null);
    setVerifyInfo(null);
    setBanner("");
    setSuccessVisitNo(null);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#E9E7E0] text-[#1D2421]">
      <div className="mx-auto max-w-md min-h-screen bg-[#F4F3EE] flex flex-col shadow-sm">
        {!personId ? (
          <div className="p-6 flex flex-col gap-3">
            <h1 className="m-0 text-2xl font-bold">ลิงก์ไม่ถูกต้อง</h1>
            <Banner tone="care">กรุณาสแกน QR บนบัตรผู้เรียนอีกครั้ง หรือสอบถามเจ้าหน้าที่</Banner>
          </div>
        ) : step === "verify" ? (
          <VerifyStep nameHint={nameHint} yearBE={yearBE} onVerified={onVerified} />
        ) : step === "form" ? (
          <FormStep
            fullName={verifyInfo?.person?.fullName}
            visitNo={verifyInfo?.scheduledVisitNo}
            contact={verifyInfo?.contact}
            onSubmit={onSubmit}
            onSkip={async () => {
              setBanner("ยังไม่ได้บันทึกค่าของวันนี้ — กลับมาบันทึกได้โดยสแกน QR อีกครั้ง");
              try {
                await loadSummary(last4);
              } catch (e) {
                setError(e?.message || "โหลดสรุปไม่สำเร็จ");
              }
            }}
          />
        ) : summary ? (
          <MyHealth data={summary} banner={banner} successVisitNo={successVisitNo} onLogout={logout} />
        ) : null}
        {error && (
          <div className="p-5">
            <Banner tone="see">{error}</Banner>
          </div>
        )}
      </div>
    </div>
  );
}
