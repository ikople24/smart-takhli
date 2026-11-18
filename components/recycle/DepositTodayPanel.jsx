// แท็บ "รับฝาก" — ค้นหาสมาชิก (กรณีไม่มีบัตร) + รายการฝากของวันนี้
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";
import { formatThaiDate, formatThaiTime, getBangkokYMD } from "@/lib/recycle/dates";
import { getWasteTypeLabel } from "@/lib/recycle/wasteTypes";

export default function DepositTodayPanel() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [today] = useState(getBangkokYMD());
  const [deposits, setDeposits] = useState([]);
  const [totalKg, setTotalKg] = useState(0);
  const [error, setError] = useState("");

  const loadToday = useCallback(async () => {
    try {
      const json = await recycleFetch(`/deposits?date=${today}`);
      setDeposits(json.deposits);
      setTotalKg(json.totalKg);
    } catch (e) {
      setError(e.message);
    }
  }, [today]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const search = async (e) => {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    setError("");
    try {
      const json = await recycleFetch(`/members?q=${encodeURIComponent(term)}&limit=20`);
      if (json.members.length === 1) {
        router.push(`/admin/recycle/deposit?code=${encodeURIComponent(json.members[0].code)}`);
        return;
      }
      setResults(json.members);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSearching(false);
    }
  };

  const voidDeposit = async (d) => {
    const reason = window.prompt(`ยกเลิกรายการของ ${d.memberName} (${fmtKg(d.totalKg)} กก.)\nกรุณาระบุเหตุผล:`);
    if (!reason || !reason.trim()) return;
    try {
      await recycleFetch(`/deposits/${d._id}`, { method: "DELETE", body: { reason } });
      loadToday();
    } catch (e) {
      setError(e.message);
    }
  };

  const uniqueMembers = new Set(deposits.map((d) => String(d.memberId))).size;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-emerald-50/70 ring-1 ring-emerald-200/70 p-5">
        <p className="text-base font-semibold text-emerald-900">สแกน QR บนบัตรสมาชิกด้วยกล้องมือถือ</p>
        <p className="text-sm text-emerald-800 mt-1">ระบบจะเปิดหน้ากรอกน้ำหนักของสมาชิกคนนั้นทันที (ต้องล็อกอินไว้ใน browser เดียวกับที่กล้องเปิดลิงก์)</p>
      </div>

      <form onSubmit={search} className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5 space-y-3">
        <label htmlFor="recycle-search" className="block text-base font-semibold text-gray-900">
          ไม่มีบัตร? ค้นหาสมาชิก
        </label>
        <div className="flex gap-2">
          <input
            id="recycle-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ชื่อ / เบอร์โทร / รหัส PS-xxxx"
            className="h-14 min-w-0 flex-1 rounded-2xl border border-gray-200/70 bg-white shadow-sm px-4 text-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
          <button
            type="submit"
            disabled={searching || !q.trim()}
            className="h-14 px-6 rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 disabled:opacity-50"
          >
            {searching ? "..." : "ค้นหา"}
          </button>
        </div>
        <Link href="/admin/recycle/members/new" className="inline-block text-sm font-semibold text-emerald-800">
          + สมัครสมาชิกใหม่
        </Link>

        {results && (
          <div className="pt-1">
            {results.length === 0 ? (
              <p className="text-sm text-gray-500">ไม่พบสมาชิก</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-2xl ring-1 ring-gray-200 overflow-hidden">
                {results.map((m) => (
                  <li key={m._id}>
                    <Link
                      href={`/admin/recycle/deposit?code=${encodeURIComponent(m.code)}`}
                      className="flex items-center justify-between px-4 py-3 min-h-14 hover:bg-emerald-50"
                    >
                      <span>
                        <span className="block text-base font-semibold text-gray-900">{m.fullName}</span>
                        <span className="block text-sm text-gray-500">
                          {m.code}
                          {m.phone ? ` • ${m.phone}` : ""}
                          {m.community ? ` • ${m.community}` : ""}
                        </span>
                      </span>
                      <span className="text-emerald-700 font-semibold text-sm">เลือก →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>

      {error && (
        <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-4 text-sm text-amber-800" role="alert">
          {error}
        </div>
      )}

      <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-semibold text-gray-900">วันนี้ ({formatThaiDate(today)})</p>
          <p className="text-sm text-gray-600">
            {uniqueMembers} ราย • {deposits.length} ครั้ง • <strong className="text-gray-900">{fmtKg(totalKg)} กก.</strong>
          </p>
        </div>
        {deposits.length === 0 && <p className="text-sm text-gray-500 mt-3">ยังไม่มีการฝากวันนี้</p>}
        <ul className="mt-3 divide-y divide-gray-100">
          {deposits.map((d) => (
            <li key={d._id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900 truncate">
                  {d.memberName} <span className="text-sm font-normal text-gray-500">{d.memberCode}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatThaiTime(d.createdAt)} น. • {d.items.map((it) => `${getWasteTypeLabel(it.type)} ${fmtKg(it.kg)}`).join(", ")}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">บันทึกโดย {d.recordedBy?.name || "-"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold">{fmtKg(d.totalKg)} กก.</p>
                <button type="button" onClick={() => voidDeposit(d)} className="text-xs text-red-700 hover:underline mt-1">
                  ยกเลิก
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
