// แผงประวัติรายบุคคล (แท็บทะเบียน) — ค่าล่าสุด, แนวโน้มความดัน, การมาเรียน 16 ครั้ง, 2Q, แก้ข้อมูล/ผลวัด, QR
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { bmiChip, bpChip, formatThaiDate, mhChip, needsCloseFollowUp } from "@/lib/elderly-school/followUp";
import { fetchJson, postJson } from "./useElderlyData";
import VisitEditModal from "./VisitEditModal";
import QrCheckinModal from "./QrCheckinModal";
import {
  Chip,
  Notice,
  Spinner,
  TONE_STYLES,
  btnCls,
  cardCls,
  inputCls,
  labelCls,
  maskCitizen,
  primaryBtnCls,
} from "./elderlyTheme";

function hasData(v) {
  return ["weightKg", "waistCm", "pulseBpm", "bp1Sys", "bp1Dia", "bp2Sys", "bp2Dia"].some((f) => v?.[f] != null);
}

function MetricTile({ label, value, sub, tone }) {
  const t = TONE_STYLES[tone] || TONE_STYLES.none;
  return (
    <div className="p-3.5 rounded-xl flex flex-col gap-0.5" style={{ background: t.bg }}>
      <span className="text-[13px]" style={{ color: t.fg }}>
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: t.fg }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: t.fg }}>
        {sub}
      </span>
    </div>
  );
}

export default function PersonProfilePanel({ personId, metrics, yearBE, statuses, onChanged, go }) {
  const [person, setPerson] = useState(null);
  const [visits, setVisits] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [visitModal, setVisitModal] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const id = encodeURIComponent(personId);
      const [p, v, a] = await Promise.all([
        fetchJson(`/api/elderly-school/people?id=${id}`),
        fetchJson(`/api/elderly-school/visits?personId=${id}&yearBE=${yearBE}`),
        fetchJson(`/api/elderly-school/assessments?personId=${id}&yearBE=${yearBE}&limit=5`).catch(() => ({ items: [] })),
      ]);
      setPerson(p.person);
      setVisits(Array.isArray(v.visits) ? v.visits : []);
      setAssessments(Array.isArray(a.items) ? a.items : []);
      setForm({
        fullName: p.person?.fullName || "",
        heightCm: p.person?.heightCm ?? "",
        baselineWeightKg: p.person?.baselineWeightKg ?? "",
        phone: p.person?.phone || "",
        address: p.person?.address || "",
      });
    } catch (e) {
      setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [personId, yearBE]);

  useEffect(() => {
    load();
    setEditing(false);
  }, [load]);

  const visitByNo = useMemo(() => new Map(visits.map((v) => [v.visitNo, v])), [visits]);
  const attended = visits.filter(hasData).length;
  const dateByNo = useMemo(() => new Map((statuses || []).map((s) => [s.visitNo, s])), [statuses]);

  const trend = Array.from({ length: 16 }, (_, i) => {
    const v = visitByNo.get(i + 1);
    const sys = v?.bp1Sys ?? v?.bp2Sys ?? null;
    return { no: i + 1, sys };
  }).filter((t) => t.sys !== null);

  const savePerson = async () => {
    const num = (s) => (String(s).trim() === "" ? null : Number(s));
    if ([form.heightCm, form.baselineWeightKg].some((s) => String(s).trim() !== "" && !Number.isFinite(Number(s)))) {
      setError("ส่วนสูงและน้ำหนักตั้งต้นต้องเป็นตัวเลข");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await postJson(
        `/api/elderly-school/people?id=${encodeURIComponent(personId)}`,
        {
          fullName: form.fullName,
          heightCm: num(form.heightCm),
          baselineWeightKg: num(form.baselineWeightKg),
          phone: form.phone || null,
          address: form.address || null,
        },
        "PUT"
      );
      setEditing(false);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !person) {
    return (
      <section className={cardCls + " p-6"}>
        <Spinner />
      </section>
    );
  }

  const bp = bpChip(metrics?.bp);
  const bmi = bmiChip(metrics?.bmiCategory);
  const mh = mhChip(metrics?.mentalHealth || (assessments[0] ? { q2Positive: assessments[0]?.q2?.positive } : null));
  const latest2Q = assessments[0] || null;
  const initial = (person?.fullName || "?").replace(/^(นาย|นางสาว|นาง)/, "").trim().charAt(0) || "?";

  return (
    <section className={cardCls + " p-6 flex flex-col gap-5"} aria-label="ประวัติรายบุคคล">
      {error && <Notice tone="see">{error}</Notice>}

      <div className="flex gap-3.5 items-center">
        <div className="w-14 h-14 shrink-0 rounded-full bg-[#E3F0EE] text-[#0E5A55] flex items-center justify-center text-[22px] font-bold" aria-hidden="true">
          {initial}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-xl font-bold truncate">{person?.fullName || "-"}</span>
          <span className="text-sm text-[#5B635F]">
            {[person?.ageYears ? `${person.ageYears} ปี` : null, person?.bloodType ? `กรุ๊ปเลือด ${person.bloodType}` : null, maskCitizen(person?.citizenId)]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <button type="button" className={btnCls + " !min-h-11"} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? "ปิด" : "แก้ไข"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {metrics && needsCloseFollowUp(metrics) && <Chip tone="see">ต้องติดตาม</Chip>}
        {person?.phone && <Chip tone="none">โทร {person.phone}</Chip>}
        {person?.address && <Chip tone="none">{person.address}</Chip>}
        <button type="button" className="text-sm font-semibold text-[#0E5A55] underline" onClick={() => setQrOpen(true)}>
          QR เช็คอิน
        </button>
      </div>

      {editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#FBFAF7] border border-[#EFEDE6]">
          {[
            ["fullName", "ชื่อ-นามสกุล"],
            ["phone", "เบอร์โทร"],
            ["heightCm", "ส่วนสูง (ซม.)"],
            ["baselineWeightKg", "น้ำหนักตั้งต้น (กก.)"],
          ].map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1">
              <span className={labelCls}>{label}</span>
              <input className={inputCls} value={form[k] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))} />
            </label>
          ))}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelCls}>ที่อยู่</span>
            <input className={inputCls} value={form.address ?? ""} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button type="button" className={primaryBtnCls} onClick={savePerson} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลคน"}
            </button>
          </div>
        </div>
      )}

      {metrics ? (
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="ความดันล่าสุด" value={bp.label} sub={`ครั้งที่ ${metrics.visitNo}`} tone={bp.tone} />
          <MetricTile label="BMI" value={typeof metrics.bmi === "number" ? metrics.bmi.toFixed(1) : "—"} sub={bmi.label} tone={bmi.tone} />
          <MetricTile
            label="WHtR"
            value={typeof metrics.whtR === "number" ? metrics.whtR.toFixed(2) : "—"}
            sub={metrics.abdominalRisk === null ? "ไม่มีข้อมูล" : metrics.abdominalRisk ? "เสี่ยงอ้วนลงพุง" : "ปกติ"}
            tone={metrics.abdominalRisk === null ? "none" : metrics.abdominalRisk ? "care" : "ok"}
          />
          <MetricTile
            label="ชีพจร"
            value={metrics.pulseBpm ?? "—"}
            sub={{ normal: "ปกติ", low: "ต่ำ", high: "สูง" }[metrics.pulseCategory] || "ไม่มีข้อมูล"}
            tone={{ normal: "ok", low: "low", high: "see" }[metrics.pulseCategory] || "none"}
          />
        </div>
      ) : (
        <Notice tone="none">ยังไม่มีผลวัดในปี {yearBE}</Notice>
      )}

      {trend.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between items-baseline gap-2">
            <h3 className="m-0 text-base font-bold">แนวโน้มความดันตัวบน</h3>
            <span className="text-xs text-[#5B635F]">เส้นประ = 140</span>
          </div>
          <div className="relative h-[120px] flex gap-2 items-end border-b border-[#D6D3C8]">
            <div className="absolute inset-x-0 border-t-2 border-dashed border-[#C9867F]" style={{ bottom: `${((140 - 80) / 120) * 100}px` }} aria-hidden="true" />
            {trend.map((t) => {
              const h = Math.max(4, Math.min(100, ((t.sys - 80) / 120) * 100));
              return (
                <div key={t.no} className="flex-1 max-w-8 flex flex-col items-center justify-end h-full gap-1" title={`ครั้งที่ ${t.no}: ${t.sys}`}>
                  <span className="text-[11px] text-[#3C4541]">{t.sys}</span>
                  <div className="w-full rounded-t" style={{ height: `${h}px`, background: t.sys >= 140 ? "#C98F86" : t.sys >= 120 ? "#E3C37E" : "#4E9C8F" }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <h3 className="m-0 text-base font-bold">การมาเรียน {attended} ครั้ง</h3>
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
          {Array.from({ length: 16 }, (_, i) => {
            const no = i + 1;
            const v = visitByNo.get(no);
            const st = dateByNo.get(no)?.status;
            const came = hasData(v);
            const missed = !came && (st === "done");
            return (
              <button
                key={no}
                type="button"
                title={`ครั้งที่ ${no}${came ? " · มาเรียน" : missed ? " · ไม่มีผลวัด" : ""} — กดเพื่อบันทึก/แก้ผลวัด`}
                aria-label={`ครั้งที่ ${no}`}
                onClick={() => setVisitModal({ no, visit: v || null })}
                className="aspect-square rounded-md"
                style={{
                  background: came ? "#4E9C8F" : missed ? "#FFFFFF" : "#ECEAE3",
                  border: missed ? "2px solid #C0473E" : "0",
                }}
              />
            );
          })}
        </div>
        <span className="text-xs text-[#5B635F]">เขียว = มีผลวัด · ขอบแดง = ผ่านวันเรียนแล้วไม่มีผลวัด · กดช่องเพื่อบันทึก/แก้ผลวัด</span>
      </div>

      <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-[#E4E2DA]">
        <div className="flex justify-between items-center gap-2">
          <h3 className="m-0 text-base font-bold">คัดกรองสุขภาพจิต 2Q</h3>
          <Chip tone={mh.tone}>{mh.label}</Chip>
        </div>
        <span className="text-sm text-[#3C4541]">
          {latest2Q ? `ประเมินล่าสุด ${formatThaiDate(latest2Q.assessmentDate) || latest2Q.assessmentDate}` : "ยังไม่ได้ประเมินในปีนี้"}
        </span>
        <button type="button" className="self-start text-sm font-semibold text-[#0E5A55]" onClick={() => go("screening", { person: personId })}>
          {latest2Q ? "ทำแบบประเมินใหม่ →" : "ทำแบบประเมิน →"}
        </button>
      </div>

      <VisitEditModal
        open={Boolean(visitModal)}
        onClose={() => setVisitModal(null)}
        onSaved={async () => {
          await load();
          onChanged?.();
        }}
        person={{ personId, fullName: person?.fullName }}
        yearBE={yearBE}
        visitNo={visitModal?.no}
        visit={visitModal?.visit}
        dateISO={dateByNo.get(visitModal?.no)?.dateISO}
      />
      <QrCheckinModal open={qrOpen} onClose={() => setQrOpen(false)} person={{ personId, fullName: person?.fullName }} yearBE={yearBE} />
    </section>
  );
}
