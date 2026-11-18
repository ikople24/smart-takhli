// แท็บ "สรุป" — น้ำหนักรวมตามประเภท / ชุมชน / รายวัน ในช่วงวันที่เลือก
import { useCallback, useEffect, useState } from "react";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";
import { formatThaiDate, getBangkokYMD } from "@/lib/recycle/dates";
import { WASTE_GROUPS } from "@/lib/recycle/wasteTypes";

export default function SummaryPanel() {
  const today = getBangkokYMD();
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const json = await recycleFetch(`/summary?from=${from}&to=${to}`);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const maxTypeKg = Math.max(1, ...(data?.byType || []).map((t) => t.kg));
  const groupChip = Object.fromEntries(WASTE_GROUPS.map((g) => [g.id, g.chipClass]));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="s-from" className="block text-xs text-gray-500 mb-1">
            ตั้งแต่
          </label>
          <input id="s-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl border border-gray-200 px-3" />
        </div>
        <div>
          <label htmlFor="s-to" className="block text-xs text-gray-500 mb-1">
            ถึง
          </label>
          <input id="s-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl border border-gray-200 px-3" />
        </div>
        <p className="text-sm text-gray-500 pb-2">
          {formatThaiDate(from)} – {formatThaiDate(to)}
          {loading ? " • กำลังโหลด..." : ""}
        </p>
      </div>

      {error && (
        <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-4 text-sm text-amber-800" role="alert">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "น้ำหนักรวม", value: `${fmtKg(data.totalKg)} กก.` },
              { label: "จำนวนครั้งที่ฝาก", value: `${data.depositCount} ครั้ง` },
              { label: "สมาชิกที่มาฝาก", value: `${data.activeMemberCount} คน` },
              { label: "สมาชิกทั้งหมด", value: `${data.memberTotal} คน` },
              { label: "ตัดยอดแลกของ", value: `${fmtKg(data.redeemedKg)} กก.` },
              { label: "จำนวนครั้งที่แลก", value: `${data.redemptionCount} ครั้ง` },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl bg-white ring-1 ring-gray-200/60 p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
            <p className="text-base font-semibold text-gray-900 mb-3">ตามประเภทขยะ</p>
            <ul className="space-y-3">
              {data.byType.map((t) => (
                <li key={t.type}>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${groupChip[t.group] || ""}`}>
                        {WASTE_GROUPS.find((g) => g.id === t.group)?.label}
                      </span>
                      {t.label}
                    </span>
                    <span className="font-semibold">{fmtKg(t.kg)} กก.</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(t.kg / maxTypeKg) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
            <p className="text-base font-semibold text-gray-900 mb-2">ของรางวัลที่แลกออกไป</p>
            {data.byReward.length === 0 && <p className="text-sm text-gray-500">ยังไม่มีการแลกในช่วงนี้</p>}
            <ul className="divide-y divide-gray-100">
              {data.byReward.map((r) => (
                <li key={r.name} className="py-2 flex justify-between text-sm">
                  <span>
                    {r.name} × {r.qty} {r.unit}
                  </span>
                  <span>
                    <strong>{fmtKg(r.kg)}</strong> กก.
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
              <p className="text-base font-semibold text-gray-900 mb-2">ตามชุมชน</p>
              {data.byCommunity.length === 0 && <p className="text-sm text-gray-500">ไม่มีข้อมูล</p>}
              <ul className="divide-y divide-gray-100">
                {data.byCommunity.map((c) => (
                  <li key={c.community} className="py-2 flex justify-between text-sm">
                    <span>{c.community}</span>
                    <span>
                      <strong>{fmtKg(c.kg)}</strong> กก. <span className="text-gray-500">({c.count} ครั้ง)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
              <p className="text-base font-semibold text-gray-900 mb-2">รายวัน</p>
              {data.byDay.length === 0 && <p className="text-sm text-gray-500">ไม่มีข้อมูล</p>}
              <ul className="divide-y divide-gray-100">
                {data.byDay.map((d) => (
                  <li key={d.date} className="py-2 flex justify-between text-sm">
                    <span>{formatThaiDate(d.date)}</span>
                    <span>
                      <strong>{fmtKg(d.kg)}</strong> กก. <span className="text-gray-500">({d.count} ครั้ง)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
