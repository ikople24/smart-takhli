import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import ElderlyPersonalHealthSummary, {
  type EnrichedVisit,
} from "@/components/elderly/ElderlyPersonalHealthSummary";

function getCurrentYearBE() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  return (Number.isFinite(y) ? y : new Date().getFullYear()) + 543;
}

type Step = "verify" | "form" | "summary";

export default function ElderlyCheckinPage() {
  const router = useRouter();
  const personId = typeof router.query.personId === "string" ? router.query.personId : "";

  const yearFromQuery =
    typeof router.query.yearBE === "string" && router.query.yearBE.trim()
      ? Number(router.query.yearBE.trim())
      : null;

  const yearBE = useMemo(() => {
    return Number.isFinite(yearFromQuery) ? Number(yearFromQuery) : getCurrentYearBE();
  }, [yearFromQuery]);

  /** ชื่อจาก QR/ลิงก์ (query n) — แสดงสั้นๆ ว่าเช็คอินของท่านใด */
  const checkinNameHint = useMemo(() => {
    const raw = router.query.n;
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (!s || typeof s !== "string") return "";
    return s.trim();
  }, [router.query.n]);

  const [step, setStep] = useState<Step>("verify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoBanner, setInfoBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const [last4, setLast4] = useState("");
  const [fullName, setFullName] = useState("");
  const [today, setToday] = useState("");
  const [scheduledVisitNo, setScheduledVisitNo] = useState<number | null>(null);

  const [summaryVisits, setSummaryVisits] = useState<EnrichedVisit[]>([]);
  const [summaryHeight, setSummaryHeight] = useState<number | null>(null);

  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [pulseBpm, setPulseBpm] = useState("");
  const [bp1, setBp1] = useState("");
  const [bp2, setBp2] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/smart-health/elderly/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "summary",
          personId,
          yearBE,
          citizenIdLast4: last4,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "โหลดสรุปไม่สำเร็จ");
      setFullName(json.person?.fullName || "");
      setSummaryHeight(json.person?.heightCm ?? null);
      setSummaryVisits(Array.isArray(json.visits) ? json.visits : []);
      setStep("summary");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [personId, yearBE, last4]);

  useEffect(() => {
    setError("");
    setInfoBanner("");
    setSuccessBanner("");
    setStep("verify");
    setSummaryVisits([]);
    setSummaryHeight(null);
  }, [personId, yearBE]);

  const verify = async () => {
    setLoading(true);
    setError("");
    setInfoBanner("");
    setSuccessBanner("");
    try {
      const res = await fetch("/api/smart-health/elderly/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          personId,
          yearBE,
          citizenIdLast4: last4,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "ยืนยันไม่สำเร็จ");
      setFullName(json.person?.fullName || "");
      setToday(json.today || "");
      setScheduledVisitNo(json.scheduledVisitNo ?? null);

      if (json.canSubmitToday) {
        setInfoBanner("");
        setWeightKg("");
        setWaistCm("");
        setPulseBpm("");
        setBp1("");
        setBp2("");
        setStep("form");
        return;
      }

      if (typeof json.info === "string" && json.info) {
        setInfoBanner(json.info);
      }
      await loadSummary();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    setSuccessBanner("");
    try {
      const res = await fetch("/api/smart-health/elderly/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          personId,
          yearBE,
          citizenIdLast4: last4,
          weightKg,
          waistCm,
          pulseBpm,
          bp1,
          bp2,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "บันทึกไม่สำเร็จ");
      setSuccessBanner(`บันทึกข้อมูลครั้งที่ ${json.visitNo} สำเร็จแล้ว`);
      setWeightKg("");
      setWaistCm("");
      setPulseBpm("");
      setBp1("");
      setBp2("");
      await loadSummary();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep("verify");
    setLast4("");
    setError("");
    setInfoBanner("");
    setSuccessBanner("");
    setSummaryVisits([]);
    setSummaryHeight(null);
    setToday("");
    setScheduledVisitNo(null);
  };

  const containerClass =
    step === "summary" ? "max-w-2xl mx-auto space-y-4" : "max-w-xl mx-auto space-y-4";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-white px-4 py-6 pb-24">
      <div className={containerClass}>
        <div className="rounded-3xl bg-white/90 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            บันทึกสุขภาพโรงเรียนผู้สูงอายุ
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            เทศบาลเมืองตาคลี • ปี {yearBE}
          </p>
          {today && step !== "summary" && (
            <p className="text-xs text-gray-400 mt-2">วันที่: {today}</p>
          )}
        </div>

        {!personId && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5">
            <p className="font-semibold text-amber-900">ลิงก์ไม่ถูกต้อง</p>
            <p className="text-sm text-amber-800 mt-1">ไม่พบ personId ใน URL</p>
          </div>
        )}

        {successBanner && (
          <div className="rounded-3xl bg-emerald-50/90 ring-1 ring-emerald-200/80 p-4">
            <p className="text-sm font-medium text-emerald-900">{successBanner}</p>
          </div>
        )}

        {infoBanner && !error && step !== "summary" && (
          <div className="rounded-3xl bg-sky-50/90 ring-1 ring-sky-200/80 p-4">
            <p className="text-sm text-sky-900">{infoBanner}</p>
          </div>
        )}

        {error && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5">
            <p className="font-semibold text-amber-900">ดำเนินการไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
          </div>
        )}

        {step === "verify" && personId && (
          <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-6 space-y-4">
            <p className="text-sm text-gray-700">
              เพื่อยืนยันตัวตน
              {checkinNameHint ? (
                <>
                  {" "}
                  <span className="font-medium text-gray-900">สำหรับ {checkinNameHint}</span>
                  {" "}
                </>
              ) : null}
              กรุณากรอก <span className="font-semibold">เลขบัตรประชาชน 4 ตัวท้าย</span>
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              หลังยืนยัน หากเป็นวันตามตารางเรียนและยังไม่ได้บันทึก ระบบจะให้กรอกน้ำหนัก รอบเอว และความดัน
              หากไม่ใช่วันเรียนหรือบันทึกแล้ว จะแสดง<strong className="text-gray-700"> สรุปผลสุขภาพของท่าน </strong>
              (เช่น BMI และความดัน) จากข้อมูลในระบบ
            </p>
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="____"
              className="h-12 w-full text-center text-lg tracking-widest rounded-2xl border border-gray-200/70 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={verify}
              disabled={loading || last4.length !== 4}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm"
            >
              {loading ? "กำลังดำเนินการ..." : "ยืนยัน"}
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-6 space-y-4">
            <p className="text-sm text-gray-700">
              ชื่อ: <span className="font-semibold">{fullName || "-"}</span>
            </p>
            <p className="text-xs text-gray-500">
              บันทึกครั้งที่ (ตามวันเรียน): <span className="font-semibold">{scheduledVisitNo ?? "-"}</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">น้ำหนัก (กก.)</label>
                <input
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-3"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">รอบเอว (ซม.)</label>
                <input
                  value={waistCm}
                  onChange={(e) => setWaistCm(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-3"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ชีพจร</label>
                <input
                  value={pulseBpm}
                  onChange={(e) => setPulseBpm(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-3"
                />
              </div>
              <div />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">ความดัน ครั้งที่ 1 (เช่น 120/80)</label>
                <input
                  value={bp1}
                  onChange={(e) => setBp1(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-3"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ความดัน ครั้งที่ 2 (เช่น 120/80)</label>
                <input
                  value={bp2}
                  onChange={(e) => setBp2(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-3"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm"
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <p className="text-[11px] text-gray-500">
              บันทึกได้เฉพาะวันที่ตรงตารางเรียน และครั้งละหนึ่งตามวันนั้น — วันอื่นดูได้ที่สรุปหลังยืนยันตัวตน
            </p>
          </div>
        )}

        {step === "summary" && (
          <>
            <ElderlyPersonalHealthSummary
              fullName={fullName}
              yearBE={yearBE}
              heightCm={summaryHeight}
              visits={summaryVisits}
              todayNote={infoBanner || undefined}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={resetFlow}
                className="h-12 flex-1 rounded-2xl border border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50 shadow-sm"
              >
                ออก / ยืนยันตัวตนใหม่
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
