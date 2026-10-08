// บันทึกโบตะกอน — หน้าลูกของ /admin/smart-papar/water-quality
// อยู่ใต้ path หน้าแม่เพื่อใช้สิทธิ์เดียวกัน (_app ตรวจด้วย router.pathname แบบ prefix) — ห้ามย้ายออกไปนอก water-quality/
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { useUser } from "@clerk/nextjs";
import PermissionGuard from "@/components/PermissionGuard";
import FlushingForm from "@/components/smart-papar/FlushingForm";
import { FlushingList, FlushingDetail } from "@/components/smart-papar/FlushingList";
import { bangkokYmd, canModifyFlushingLog } from "@/lib/smart-papar/flushing";

const FlushingMap = dynamic(() => import("@/components/smart-papar/FlushingMap"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-2xl bg-slate-100" />,
});

const RANGES = [
  { key: "today", label: "วันนี้", days: 0 },
  { key: "7d", label: "7 วัน", days: 6 },
  { key: "30d", label: "30 วัน", days: 29 },
];

function rangeOf(days) {
  const now = new Date();
  return { from: bangkokYmd(new Date(now.getTime() - days * 86400000)), to: bangkokYmd(now) };
}

export default function SmartPaparFlushingPage() {
  const { user } = useUser();
  const actor = {
    userId: user?.id,
    isSuperAdmin: user?.publicMetadata?.role === "superadmin",
  };

  const [rangeKey, setRangeKey] = useState("today");
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total: 0, clear: 0, stillTurbid: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formLog, setFormLog] = useState(null); // null = ปิด, {} = สร้างใหม่, log = แก้ไข
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const { from, to } = rangeOf(RANGES.find((r) => r.key === rangeKey).days);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/smart-papar/flushing?from=${from}&to=${to}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "โหลดข้อมูลไม่สำเร็จ");
      setLogs(data.data);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof TypeError ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" : e.message);
    } finally {
      setLoading(false);
    }
  }, [rangeKey]);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = () => {
    setFormLog(null);
    setSelected(null);
    Swal.fire({ icon: "success", title: "บันทึกแล้ว", timer: 1400, showConfirmButton: false });
    load();
  };

  const onDelete = async (log) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: "ลบบันทึกนี้?",
      text: log.locationName,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#e11d48",
    });
    if (!ok.isConfirmed) return;
    const res = await fetch(`/api/smart-papar/flushing/${log._id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      Swal.fire({ icon: "error", title: data?.message || "ลบไม่สำเร็จ" });
      return;
    }
    setSelected(null);
    load();
  };

  return (
    <PermissionGuard requiredPath="/admin/smart-papar/water-quality">
      <Head>
        <title>smart-papar • บันทึกโบตะกอน</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="mx-auto max-w-[1440px] space-y-4 p-4 lg:p-6">
          <div className="dashboard-header">
            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <span className="text-2xl">🚿</span>
                </div>
                <div>
                  <div className="text-sm text-blue-200">Smart Papar • ระบบงานประปา</div>
                  <h1 className="text-2xl font-bold lg:text-3xl">บันทึกโบตะกอน</h1>
                  <p className="mt-1 text-sm text-blue-200">บันทึกงานหน้างาน + ถ่ายรูปก่อน/หลังโบ</p>
                </div>
              </div>
              <Link
                href="/admin/smart-papar/water-quality"
                className="self-start rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 lg:self-auto"
              >
                ← คุณภาพน้ำรายวัน
              </Link>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFormLog({})}
            className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            + บันทึกโบตะกอน
          </button>

          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRangeKey(r.key)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
                  rangeKey === r.key ? "bg-sky-600 text-white" : "border bg-white text-slate-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "ทั้งหมด", value: summary.total, cls: "text-slate-900" },
              { label: "ใสแล้ว", value: summary.clear, cls: "text-emerald-700" },
              { label: "ยังขุ่น", value: summary.stillTurbid, cls: "text-orange-700" },
            ].map((s) => (
              <div key={s.label} className="dashboard-section p-3 text-center">
                <div className={`text-2xl font-bold ${s.cls}`}>{loading ? "–" : s.value}</div>
                <div className="text-sm text-slate-600">{s.label}</div>
              </div>
            ))}
          </div>

          {error ? (
            <div className="rounded-xl bg-rose-50 p-4 text-rose-700">
              {error}{" "}
              <button type="button" onClick={load} className="underline">
                ลองใหม่
              </button>
            </div>
          ) : (
            <>
              <FlushingMap logs={logs} onSelect={setSelected} />
              {loading ? (
                <div className="py-10 text-center text-slate-500">กำลังโหลด…</div>
              ) : (
                <FlushingList logs={logs} onSelect={setSelected} />
              )}
            </>
          )}
        </div>
      </div>

      {selected && !formLog && (
        <FlushingDetail
          log={selected}
          canModify={canModifyFlushingLog(selected, actor)}
          onClose={() => setSelected(null)}
          onEdit={() => setFormLog(selected)}
          onDelete={() => onDelete(selected)}
        />
      )}
      {formLog && (
        <FlushingForm
          key={formLog._id || "new"}
          log={formLog._id ? formLog : null}
          onClose={() => setFormLog(null)}
          onSaved={onSaved}
        />
      )}
    </PermissionGuard>
  );
}
