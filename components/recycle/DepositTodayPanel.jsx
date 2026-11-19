// แท็บ "รับฝาก" (หน้าแรกเจ้าหน้าที่) — ดีไซน์ตามแคนวาสหน้า 1
// สแกนบัตร (ด้วยกล้องมือถือ) / ค้นหาสมาชิกกรณีลืมบัตร / ตัวเลขวันนี้ / รายการฝากวันนี้
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";
import { formatThaiDate, formatThaiTime, getBangkokYMD } from "@/lib/recycle/dates";
import { WASTE_GROUPS, WASTE_TYPES } from "@/lib/recycle/wasteTypes";
import { DISPLAY, GROUP_THEME, ICON, Icon } from "@/lib/recycle/theme";

const GROUP_OF = Object.fromEntries(WASTE_TYPES.map((t) => [t.id, t.group]));

function groupChips(items) {
  const groups = [...new Set(items.map((it) => GROUP_OF[it.type]).filter(Boolean))];
  return WASTE_GROUPS.filter((g) => groups.includes(g.id));
}

export default function DepositTodayPanel() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [today] = useState(getBangkokYMD());
  const [deposits, setDeposits] = useState([]);
  const [totalKg, setTotalKg] = useState(0);
  const [redeemCount, setRedeemCount] = useState(0);
  const [error, setError] = useState("");

  const loadToday = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        recycleFetch(`/deposits?date=${today}`),
        recycleFetch(`/redemptions?date=${today}`).catch(() => ({ count: 0 })),
      ]);
      setDeposits(d.deposits);
      setTotalKg(d.totalKg);
      setRedeemCount(r.count || 0);
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
    <div className="grid gap-3.5 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-3.5">
        <section className="bg-[#146C43] text-white rounded-[28px] px-5 py-[22px] flex items-center gap-4">
          <span className="w-[72px] h-[72px] rounded-[22px] bg-white text-[#146C43] flex items-center justify-center shrink-0">
            <Icon d={ICON.scan} size={40} strokeWidth={1.7} />
          </span>
          <span>
            <span className={`${DISPLAY} block text-[21px] font-semibold leading-snug`}>สแกนบัตรสมาชิก</span>
            <span className="block mt-0.5 text-[13px] text-[#CFE6D8]">
              ใช้กล้องมือถือสแกน QR บนบัตร แล้วเริ่มกรอกน้ำหนักได้ทันที (ล็อกอินไว้ใน browser เดียวกับที่กล้องเปิดลิงก์)
            </span>
          </span>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            { label: "วันนี้รับแล้ว", value: fmtKg(totalKg), unit: "กก.", accent: true },
            { label: "สมาชิกมาฝาก", value: uniqueMembers, unit: "คน" },
            { label: "แลกของ", value: redeemCount, unit: "ครั้ง" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[#E4E0D4] rounded-[18px] p-3">
              <p className="text-xs text-[#51605A]">{s.label}</p>
              <p className={`${DISPLAY} mt-0.5 text-2xl font-semibold ${s.accent ? "text-[#146C43]" : ""}`}>
                {s.value}
                <span className="text-xs font-medium"> {s.unit}</span>
              </p>
            </div>
          ))}
        </section>

        <form onSubmit={search} className="bg-white border border-[#E4E0D4] rounded-[22px] p-3.5 flex flex-col gap-2.5">
          <label htmlFor="recycle-search" className="text-[15px] font-semibold">
            ลืมบัตร? ค้นหาสมาชิก
          </label>
          <div className="flex gap-2">
            <input
              id="recycle-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ชื่อ เบอร์โทร หรือรหัส PS-xxxx"
              className="h-[54px] min-w-0 flex-1 rounded-2xl border-[1.5px] border-[#D9D4C5] bg-[#FBFAF6] px-3.5 text-base outline-none focus:border-[#146C43] focus:ring-4 focus:ring-[#146C43]/15"
            />
            <button
              type="submit"
              disabled={searching || !q.trim()}
              aria-label="ค้นหา"
              className="w-[54px] h-[54px] rounded-2xl bg-[#146C43] text-white flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              {searching ? <span className="loading loading-spinner loading-sm" /> : <Icon d={ICON.search} size={22} strokeWidth={2} />}
            </button>
          </div>
          <Link
            href="/admin/recycle/members/new"
            className="self-start h-11 px-3.5 rounded-[14px] bg-[#E2F0E7] text-[#0B4A2D] text-sm font-semibold flex items-center gap-1.5"
          >
            <Icon d={ICON.plus} size={18} strokeWidth={2} />
            สมัครสมาชิกใหม่
          </Link>

          {results && (
            <div>
              {results.length === 0 ? (
                <p className="text-sm text-[#51605A]">ไม่พบสมาชิก</p>
              ) : (
                <ul className="divide-y divide-[#F0EDE4] rounded-2xl border border-[#E4E0D4] overflow-hidden">
                  {results.map((m) => (
                    <li key={m._id}>
                      <Link
                        href={`/admin/recycle/deposit?code=${encodeURIComponent(m.code)}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 min-h-14 hover:bg-[#F5F3EC]"
                      >
                        <span className="min-w-0">
                          <span className="block text-base font-semibold truncate">{m.fullName}</span>
                          <span className="block text-sm text-[#51605A] truncate">
                            {m.code}
                            {m.phone ? ` · ${m.phone}` : ""}
                            {m.community ? ` · ${m.community}` : ""}
                          </span>
                        </span>
                        <span className="text-[#146C43] font-semibold text-sm whitespace-nowrap">เลือก →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>

        {error && (
          <div className="rounded-3xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-800" role="alert">
            {error}
          </div>
        )}
      </div>

      <section className="bg-white border border-[#E4E0D4] rounded-[22px] px-3.5 pt-3.5 pb-1.5">
        <div className="flex justify-between items-baseline pb-1.5">
          <p className="text-[15px] font-semibold">รับฝากวันนี้</p>
          <p className="text-xs text-[#51605A]">{formatThaiDate(today)} · ล่าสุดอยู่บน</p>
        </div>
        {deposits.length === 0 && <p className="py-4 text-sm text-[#51605A] border-t border-[#F0EDE4]">ยังไม่มีการฝากวันนี้</p>}
        <ul>
          {deposits.map((d) => (
            <li key={d._id} className="flex items-center gap-3 py-2.5 border-t border-[#F0EDE4]">
              <div className="w-10 h-10 rounded-[13px] bg-[#E2F0E7] text-[#0B4A2D] flex items-center justify-center font-bold shrink-0">
                {d.memberName?.trim()?.[0] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold truncate">
                  {d.memberName} <span className="text-xs font-normal text-[#51605A]">{d.memberCode}</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {groupChips(d.items).map((g) => {
                    const t = GROUP_THEME[g.id] || GROUP_THEME.metal;
                    return (
                      <span key={g.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: t.fg, background: t.bg }}>
                        {g.label}
                      </span>
                    );
                  })}
                  <span className="text-[11px] text-[#51605A]">โดย {d.recordedBy?.name || "-"}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`${DISPLAY} text-lg font-semibold`}>{fmtKg(d.totalKg)} กก.</p>
                <p className="text-[11px] text-[#51605A]">
                  {formatThaiTime(d.createdAt)} น. ·{" "}
                  <button type="button" onClick={() => voidDeposit(d)} className="text-red-700 hover:underline">
                    ยกเลิก
                  </button>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
