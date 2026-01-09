import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

function getCurrentYearBE() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  return (Number.isFinite(y) ? y : new Date().getFullYear()) + 543;
}

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

  const [step, setStep] = useState<"verify" | "form" | "done">("verify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [last4, setLast4] = useState("");
  const [fullName, setFullName] = useState("");
  const [today, setToday] = useState("");
  const [scheduledVisitNo, setScheduledVisitNo] = useState<number | null>(null);
  const [alreadySubmittedToday, setAlreadySubmittedToday] = useState(false);

  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [pulseBpm, setPulseBpm] = useState("");
  const [bp1, setBp1] = useState("");
  const [bp2, setBp2] = useState("");

  useEffect(() => {
    setError("");
    setSuccessMsg("");
    setStep("verify");
  }, [personId, yearBE]);

  const verify = async () => {
    setLoading(true);
    setError("");
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
      setAlreadySubmittedToday(Boolean(json.alreadySubmittedToday));
      if (!json.canSubmitToday) {
        setError(json.message || "ไม่สามารถบันทึกได้");
        return;
      }
      setStep("form");
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
    setSuccessMsg("");
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
      setSuccessMsg(`บันทึกสำเร็จ (ครั้งที่ ${json.visitNo})`);
      setStep("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-white px-4 py-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            บันทึกสุขภาพโรงเรียนผู้สูงอายุ
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            เทศบาลเมืองตาคลี • ปี {yearBE}
          </p>
          {today && (
            <p className="text-xs text-gray-400 mt-2">วันที่: {today}</p>
          )}
        </div>

        {!personId && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5">
            <p className="font-semibold text-amber-900">ลิงก์ไม่ถูกต้อง</p>
            <p className="text-sm text-amber-800 mt-1">ไม่พบ personId ใน URL</p>
          </div>
        )}

        {error && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5">
            <p className="font-semibold text-amber-900">ดำเนินการไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
            {alreadySubmittedToday && (
              <p className="text-xs text-amber-700 mt-2">
                * ระบบอนุญาตให้บันทึกได้วันละ 1 ครั้ง
              </p>
            )}
          </div>
        )}

        {step === "verify" && personId && (
          <div className="rounded-3xl bg-white/80 backdrop-blur ring-1 ring-gray-200/60 shadow-sm p-6 space-y-4">
            <p className="text-sm text-gray-700">
              เพื่อยืนยันตัวตน กรุณากรอก <span className="font-semibold">เลขบัตรประชาชน 4 ตัวท้าย</span>
            </p>
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="____"
              className="h-12 w-full text-center text-lg tracking-widest rounded-2xl border border-gray-200/70 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            <button
              onClick={verify}
              disabled={loading || last4.length !== 4}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm"
            >
              {loading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
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
              onClick={submit}
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-sm"
            >
              {loading ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <p className="text-[11px] text-gray-500">
              หมายเหตุ: ระบบอนุญาตให้บันทึกได้เฉพาะ “วันเรียนที่ตั้งค่าไว้” และวันละ 1 ครั้ง (ตามวันเรียน)
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-3xl bg-emerald-50/80 ring-1 ring-emerald-200 p-6">
            <p className="font-semibold text-emerald-900">สำเร็จ</p>
            <p className="text-sm text-emerald-800 mt-1">{successMsg}</p>
            <button
              onClick={() => {
                setWeightKg("");
                setWaistCm("");
                setPulseBpm("");
                setBp1("");
                setBp2("");
                setStep("verify");
                setSuccessMsg("");
                setError("");
              }}
              className="mt-4 h-11 w-full rounded-2xl border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 font-semibold shadow-sm"
            >
              บันทึกคนถัดไป / ลองใหม่
            </button>
          </div>
        )}
      </div>
    </main>
  );
}


