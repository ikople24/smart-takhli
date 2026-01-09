import React, { useEffect, useMemo, useState } from "react";
import PermissionGuard from "@/components/PermissionGuard";

function getCurrentYearBE() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  return Number.isFinite(y) ? y + 543 : new Date().getFullYear() + 543;
}

function emptySessions() {
  return Array.from({ length: 16 }, (_, i) => ({ visitNo: i + 1, dateISO: "", note: "" }));
}

function toISODate(d) {
  // d: Date -> YYYY-MM-DD in Bangkok
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default function ElderlySchedulePage() {
  const [yearBE, setYearBE] = useState(() => getCurrentYearBE());
  const [sessions, setSessions] = useState(() => emptySessions());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [autoStartDate, setAutoStartDate] = useState("");
  const [clearArmed, setClearArmed] = useState(false);

  const yearOptions = useMemo(() => {
    const y = getCurrentYearBE();
    return [y - 1, y, y + 1];
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/smart-health/elderly/schedule?yearBE=${encodeURIComponent(String(yearBE))}`);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "โหลดตารางไม่สำเร็จ");
      const fromApi = Array.isArray(json.schedule?.sessions) ? json.schedule.sessions : [];
      const base = emptySessions();
      for (const s of fromApi) {
        const no = Number(s?.visitNo);
        if (!Number.isFinite(no) || no < 1 || no > 16) continue;
        base[no - 1] = {
          visitNo: no,
          dateISO: String(s?.dateISO || ""),
          note: String(s?.note || ""),
        };
      }
      setSessions(base);
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
      setSessions(emptySessions());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearBE]);

  const filledCount = useMemo(() => sessions.filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.dateISO)).length, [sessions]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = sessions
        .filter((s) => s.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(s.dateISO))
        .map((s) => ({ visitNo: s.visitNo, dateISO: s.dateISO, note: s.note || null }));

      const res = await fetch(`/api/smart-health/elderly/schedule?yearBE=${encodeURIComponent(String(yearBE))}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearBE, sessions: payload }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.message || "บันทึกไม่สำเร็จ");
      setSuccess(`บันทึกสำเร็จ (${payload.length}/16 ครั้ง)`);
      // reload normalized result
      const fromApi = Array.isArray(json.schedule?.sessions) ? json.schedule.sessions : [];
      const base = emptySessions();
      for (const s of fromApi) {
        const no = Number(s?.visitNo);
        if (!Number.isFinite(no) || no < 1 || no > 16) continue;
        base[no - 1] = {
          visitNo: no,
          dateISO: String(s?.dateISO || ""),
          note: String(s?.note || ""),
        };
      }
      setSessions(base);
    } catch (e) {
      setError(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const autoFillWeekly = () => {
    const start = String(autoStartDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      setError("กรุณาเลือกวันเริ่มให้ถูกต้องก่อน (YYYY-MM-DD)");
      return;
    }
    const [y, m, d] = start.split("-").map((x) => Number(x));
    const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const next = sessions.map((s, i) => {
      const date = new Date(dt.getTime());
      date.setUTCDate(date.getUTCDate() + i * 7);
      return { ...s, dateISO: toISODate(date) };
    });
    setSessions(next);
    setSuccess("");
    setError("");
  };

  const clearAll = () => {
    if (!clearArmed) {
      setClearArmed(true);
      setSuccess("");
      setError("กด “ยืนยันล้าง” อีกครั้งเพื่อยืนยันการล้างทั้งหมด");
      return;
    }
    setClearArmed(false);
    setSessions(emptySessions());
    setSuccess("ล้างวันที่แล้ว (ยังไม่บันทึก)");
    setError("");
  };

  return (
    <PermissionGuard requiredPath="/admin/smart-health">
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-gray-900">ตั้งค่าวันเรียน (ส่วนกลาง)</p>
              <p className="text-xs text-gray-500 mt-1">
                กำหนดวันที่สำหรับครั้งที่ 1–16 เพื่อให้ทุกคนใช้เลขครั้งตรงกัน (แม้บางคนขาดเรียน)
              </p>
              <p className="text-xs text-gray-500 mt-1">
                สถานะ: ตั้งค่าแล้ว <span className="font-semibold">{filledCount}</span>/16 ครั้ง
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={yearBE}
                onChange={(e) => setYearBE(Number(e.target.value))}
                className="h-10 px-3 text-sm rounded-xl border border-gray-200 bg-white"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    ปี {y}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={autoStartDate}
                onChange={(e) => setAutoStartDate(e.target.value)}
                className="h-10 px-3 text-sm rounded-xl border border-gray-200 bg-white"
                title="วันเริ่มสำหรับเติมทุก 7 วัน"
              />
              <button
                onClick={autoFillWeekly}
                className="h-10 px-4 text-sm rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
              >
                เติมทุก 7 วัน
              </button>
              <button
                onClick={clearAll}
                className="h-10 px-4 text-sm rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800"
              >
                {clearArmed ? "ยืนยันล้าง" : "ล้าง"}
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="h-10 px-4 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">{error}</div>
          )}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-800">
              {success}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">ตารางวันเรียน</p>
              <button
                onClick={load}
                disabled={loading}
                className="h-9 px-3 text-xs rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? "กำลังโหลด..." : "รีเฟรช"}
              </button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-[760px] w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">ครั้ง</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">วันที่ (YYYY-MM-DD)</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map((s, idx) => (
                    <tr key={s.visitNo} className="hover:bg-gray-50/70">
                      <td className="py-2 px-3 text-sm font-semibold text-gray-900">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={s.dateISO || ""}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x) => (x.visitNo === s.visitNo ? { ...x, dateISO: e.target.value } : x))
                            )
                          }
                          className="h-10 px-3 text-sm rounded-xl border border-gray-200 bg-white"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          value={s.note || ""}
                          onChange={(e) =>
                            setSessions((prev) =>
                              prev.map((x) => (x.visitNo === s.visitNo ? { ...x, note: e.target.value } : x))
                            )
                          }
                          placeholder="เช่น สัปดาห์ที่ 1 / กิจกรรมพิเศษ"
                          className="h-10 w-full px-3 text-sm rounded-xl border border-gray-200 bg-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            * ผลของตารางนี้จะมีผลกับหน้าเช็คอิน public: ผู้เรียนบันทึกได้เฉพาะวันที่ตั้งไว้ และระบบจะบันทึกเป็นครั้งที่ตรงกับวันนั้น
          </div>
        </div>
      </main>
    </PermissionGuard>
  );
}


