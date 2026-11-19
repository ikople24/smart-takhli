// หน้าปลายทางของ QR บนบัตรสมาชิก — โครงการพระสังข์หอบทอง
// URL: /recycle/m/<publicToken>   ⚠️ ฝังใน QR ที่พิมพ์แจกแล้ว ห้ามเปลี่ยน path
//
// - เจ้าหน้าที่ที่ล็อกอินและมีสิทธิ์ /admin/recycle → พาไปหน้ากรอกน้ำหนักทันที
// - คนอื่น (สมาชิกสแกนเอง) → เห็นยอดคงเหลือ ประวัติการฝาก/แลก และของรางวัล (ดูอย่างเดียว ไม่ต้องยืนยันตัวตน)
// - เจ้าหน้าที่อยากดูมุมมองสมาชิก: เติม ?view=member
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "@clerk/nextjs";
import { fmtKg } from "@/lib/recycle/client";
import { formatThaiDate, formatThaiTime } from "@/lib/recycle/dates";
import { getWasteTypeLabel } from "@/lib/recycle/wasteTypes";
import { getRewardProgress } from "@/lib/recycle/balance";
import RecycleLoading from "@/components/recycle/RecycleLoading";
import { DISPLAY, GROUP_THEME, ICON, Icon, RECYCLE_ROOT } from "@/lib/recycle/theme";

export default function RecycleMemberCardPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const forceMemberView = router.query.view === "member";
  const { isLoaded, isSignedIn } = useAuth();

  const [staffChecked, setStaffChecked] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [minDelayDone, setMinDelayDone] = useState(false);

  // ให้ Loading การ์ตูนโชว์อย่างน้อยครู่หนึ่ง ไม่กระพริบหายเร็วเกิน
  useEffect(() => {
    const t = setTimeout(() => setMinDelayDone(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // 1) ถ้าเป็นเจ้าหน้าที่ → ไปหน้ากรอกน้ำหนัก
  useEffect(() => {
    if (!router.isReady || !isLoaded || !token) return;
    if (!isSignedIn || forceMemberView) {
      setStaffChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recycle/members?token=${encodeURIComponent(token)}`);
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success && json.member?.code) {
          setIsStaff(true);
          router.replace(`/admin/recycle/deposit?code=${encodeURIComponent(json.member.code)}`);
          return;
        }
      } catch {
        // ไม่ใช่เจ้าหน้าที่ / เครือข่ายมีปัญหา → แสดงมุมมองสมาชิก
      }
      if (!cancelled) setStaffChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, router.isReady, isLoaded, isSignedIn, token, forceMemberView]);

  // 2) มุมมองสมาชิก
  useEffect(() => {
    if (!staffChecked || !token) return;
    (async () => {
      try {
        const res = await fetch(`/api/recycle/public/${encodeURIComponent(token)}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.message || "ไม่พบข้อมูลสมาชิก");
        setData(json);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [staffChecked, token]);

  const m = data?.member;
  const showLoading = !error && (!m || !minDelayDone);
  const progress = m ? getRewardProgress(m.balanceKg, data.rewards) : null;
  const groupTotal = (data?.byGroup || []).reduce((s, g) => s + g.kg, 0);
  const history = data
    ? [
        ...data.deposits.map((d) => ({ ...d, kind: "in", detail: d.items.map((it) => `${getWasteTypeLabel(it.type)} ${fmtKg(it.kg)}`).join(" · ") })),
        ...data.redemptions.map((r) => ({ ...r, kind: "out", detail: r.items.map((it) => `${it.name} ×${it.qty}`).join(", ") })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at))
    : [];
  const rows = tab === "out" ? history.filter((h) => h.kind === "out") : history;

  return (
    <>
      <Head>
        <title>บัตรสะสมของฉัน — พระสังข์หอบทอง</title>
        <meta name="robots" content="noindex" />
      </Head>
      {showLoading && <RecycleLoading fullscreen message={isStaff ? "กำลังเปิดหน้าบันทึกการฝาก" : "กำลังเปิดบัตรสะสมของคุณ"} />}
      <main className={`${RECYCLE_ROOT} min-h-screen px-4 pt-5 pb-24`}>
        <div className="max-w-md mx-auto flex flex-col gap-3.5">
          <p className="text-[13px] text-[#51605A] text-center">โครงการพระสังข์หอบทอง · เทศบาลเมืองตาคลี</p>

          {error && (
            <div className="rounded-3xl bg-amber-50 ring-1 ring-amber-200 p-5" role="alert">
              <p className="font-semibold text-amber-900">ไม่พบข้อมูล</p>
              <p className="text-sm text-amber-800 mt-1">{error} — กรุณาติดต่อเจ้าหน้าที่จุดรับ</p>
            </div>
          )}

          {m && (
            <>
              <section className="isolate relative overflow-hidden bg-[#146C43] text-white rounded-[28px] p-5">
                <div className="absolute -z-10 -right-10 -top-10 w-40 h-40 rounded-full bg-[#1B7C4F]" />
                <div className="absolute -z-10 right-8 top-16 w-[90px] h-[90px] rounded-full bg-[#1B7C4F]" />
                <p className="text-[13px] text-[#CFE6D8]">บัตรสะสมขยะรีไซเคิล</p>
                <h1 className={`${DISPLAY} mt-0.5 text-[22px] font-semibold`}>{m.fullName}</h1>
                <p className="text-[13px] text-[#CFE6D8] tracking-wider">{m.code}</p>
                {!m.isActive && <p className="mt-1 text-sm font-semibold text-[#FFD7D2]">บัตรนี้ถูกปิดการใช้งาน</p>}
                <p className="mt-[18px] text-sm text-[#E8F3EC]">น้ำหนักคงเหลือที่แลกของได้</p>
                <p className={`${DISPLAY} text-[56px] font-semibold leading-none`}>
                  {fmtKg(m.balanceKg)}
                  <span className="text-xl font-medium"> กก.</span>
                </p>
              </section>

              {(progress?.next || progress?.goal || progress?.allAffordable) && (
                <section className="bg-white border border-[#E4E0D4] rounded-[22px] p-4 flex flex-col gap-3">
                  {[progress.next && { ...progress.next, label: "ของชิ้นถัดไป", tone: "next" }, progress.goal && { ...progress.goal, label: "เป้าหมายใหญ่", tone: "goal" }]
                    .filter(Boolean)
                    .map((p) => (
                      <div key={p.tone}>
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0 ${
                              p.tone === "next" ? "bg-[#FDF3D9] text-[#7A5300]" : "bg-[#DDF3EF] text-[#0B7A6F]"
                            }`}
                          >
                            <Icon d={ICON.gift} size={24} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-[#51605A]">{p.label}</p>
                            <p className="text-base font-semibold truncate">
                              {p.name} · {fmtKg(p.kgCost)} กก.
                            </p>
                          </div>
                          <span className={`text-[13px] font-bold whitespace-nowrap ${p.missingKg > 0 ? "text-[#7A5300]" : "text-[#146C43]"}`}>
                            {p.missingKg > 0 ? `ขาด ${fmtKg(p.missingKg)}` : "แลกได้แล้ว"}
                          </span>
                        </div>
                        <div className="mt-2.5 h-2.5 rounded-full bg-[#F0EDE4]">
                          <div
                            className={`h-2.5 rounded-full ${p.missingKg > 0 ? "bg-[#F4B740]" : "bg-[#146C43]"}`}
                            style={{ width: `${p.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  {progress.allAffordable && !progress.goal && (
                    <p className="text-[15px] font-semibold text-[#146C43]">ยอดของคุณพอแลกของรางวัลได้ทุกรายการแล้ว</p>
                  )}
                </section>
              )}

              {groupTotal > 0 && (
                <section className="bg-white border border-[#E4E0D4] rounded-[22px] p-4">
                  <p className="text-[13px] text-[#51605A]">คุณช่วยแยกขยะไปแล้ว</p>
                  <p className={`${DISPLAY} text-[28px] font-semibold`}>
                    {fmtKg(m.totalKg)} กก. <span className="text-sm font-medium text-[#51605A]">จาก {m.depositCount} ครั้ง</span>
                  </p>
                  <div className="mt-2.5 flex h-3.5 rounded-full overflow-hidden gap-0.5" aria-hidden="true">
                    {data.byGroup.map((g) => (
                      <div key={g.group} style={{ width: `${(g.kg / groupTotal) * 100}%`, background: (GROUP_THEME[g.group] || GROUP_THEME.metal).fg }} />
                    ))}
                  </div>
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                    {data.byGroup.map((g) => (
                      <li key={g.group} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: (GROUP_THEME[g.group] || GROUP_THEME.metal).fg }} />
                        {g.label} {fmtKg(g.kg)} กก.
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div role="tablist" aria-label="ประวัติ" className="grid grid-cols-3 gap-1 rounded-[18px] bg-white p-1 border border-[#E4E0D4]">
                {[
                  { id: "all", label: "ทั้งหมด" },
                  { id: "out", label: "การแลกของ" },
                  { id: "rewards", label: "ของรางวัล" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`h-[46px] rounded-[14px] text-sm font-semibold ${tab === t.id ? "bg-[#146C43] text-white" : "text-[#51605A]"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab !== "rewards" ? (
                <section className="bg-white border border-[#E4E0D4] rounded-[22px] px-4 py-1.5">
                  {rows.length === 0 && <p className="py-4 text-sm text-[#51605A]">{tab === "out" ? "ยังไม่เคยแลกของ" : "ยังไม่มีรายการ"}</p>}
                  <ul className="divide-y divide-[#F0EDE4]">
                    {rows.map((h) => (
                      <li key={`${h.kind}-${h.id}`} className="py-3 flex items-center gap-3">
                        <span
                          className={`w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0 ${
                            h.kind === "in" ? "bg-[#E2F0E7] text-[#146C43]" : "bg-[#FDF3D9] text-[#7A5300]"
                          }`}
                        >
                          <Icon d={h.kind === "in" ? ICON.plus : ICON.minus} size={18} strokeWidth={2.2} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">
                            {formatThaiDate(h.date)} · {formatThaiTime(h.at)}
                          </p>
                          <p className="text-xs text-[#51605A]">{h.detail}</p>
                        </div>
                        <span className={`${DISPLAY} text-[17px] font-semibold whitespace-nowrap ${h.kind === "in" ? "text-[#146C43]" : "text-[#7A5300]"}`}>
                          {h.kind === "in" ? "+" : "−"}
                          {fmtKg(h.totalKg)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <section className="bg-white border border-[#E4E0D4] rounded-[22px] px-4 py-3">
                  <p className="text-[13px] text-[#51605A] mb-1">นำบัตรมาแลกได้ที่จุดรับ — ใช้น้ำหนักคงเหลือตามรายการ</p>
                  {data.rewards.length === 0 && <p className="py-2 text-sm text-[#51605A]">ยังไม่มีของรางวัล</p>}
                  <ul className="divide-y divide-[#F0EDE4]">
                    {data.rewards.map((r) => {
                      const enough = m.balanceKg + 0.001 >= r.kgCost;
                      const out = typeof r.stock === "number" && r.stock <= 0;
                      return (
                        <li key={r.id} className={`py-3 flex justify-between items-center gap-3 ${out ? "opacity-50" : ""}`}>
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold">{r.name}</p>
                            <p className="text-xs text-[#51605A]">
                              {out ? "ของหมด" : enough ? "แลกได้แล้ว" : `ขาดอีก ${fmtKg(r.kgCost - m.balanceKg)} กก.`}
                            </p>
                          </div>
                          <span className={`text-sm font-bold whitespace-nowrap ${enough && !out ? "text-[#146C43]" : "text-[#334155]"}`}>
                            {fmtKg(r.kgCost)} กก./{r.unit}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}


              {isSignedIn && forceMemberView && (
                <Link
                  href={`/admin/recycle/deposit?code=${encodeURIComponent(m.code)}`}
                  className="block text-center text-sm font-semibold text-[#146C43] py-2"
                >
                  เจ้าหน้าที่: ไปหน้าบันทึกการฝาก →
                </Link>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
