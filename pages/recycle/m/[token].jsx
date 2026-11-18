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

export default function RecycleMemberCardPage() {
  const router = useRouter();
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const forceMemberView = router.query.view === "member";
  const { isLoaded, isSignedIn } = useAuth();

  const [staffChecked, setStaffChecked] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("deposits");

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

  return (
    <>
      <Head>
        <title>บัตรสมาชิกพระสังข์หอบทอง</title>
        <meta name="robots" content="noindex" />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-white px-4 py-5 pb-24">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5">
            <h1 className="text-lg font-bold text-gray-900">โครงการพระสังข์หอบทอง</h1>
            <p className="text-sm text-gray-500">ธนาคารขยะรีไซเคิล • เทศบาลเมืองตาคลี</p>
          </div>

          {(!staffChecked || isStaff) && !error && (
            <div className="rounded-3xl bg-white/80 ring-1 ring-gray-200/60 p-6 text-center text-gray-500">
              {isStaff ? "กำลังเปิดหน้าบันทึกการฝาก..." : "กำลังโหลด..."}
            </div>
          )}

          {error && (
            <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5" role="alert">
              <p className="font-semibold text-amber-900">ไม่พบข้อมูล</p>
              <p className="text-sm text-amber-800 mt-1">{error} — กรุณาติดต่อเจ้าหน้าที่จุดรับ</p>
            </div>
          )}

          {m && (
            <>
              <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
                <p className="text-xl font-bold text-gray-900">{m.fullName}</p>
                <p className="text-sm text-gray-500 font-mono">{m.code}</p>
                {!m.isActive && <p className="text-sm text-red-700 font-semibold mt-1">บัตรนี้ถูกปิดการใช้งาน</p>}
                <div className="mt-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4 text-center">
                  <p className="text-sm text-emerald-800">น้ำหนักคงเหลือที่แลกของได้</p>
                  <p className="text-4xl font-bold text-emerald-700 mt-1">
                    {fmtKg(m.balanceKg)} <span className="text-lg font-semibold">กก.</span>
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">ฝากทั้งหมด</p>
                    <p className="text-base font-bold">{fmtKg(m.totalKg)} กก.</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">แลกไปแล้ว</p>
                    <p className="text-base font-bold">{fmtKg(m.redeemedKg)} กก.</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">ฝากมาแล้ว</p>
                    <p className="text-base font-bold">{m.depositCount} ครั้ง</p>
                  </div>
                </div>
              </div>

              <div role="tablist" aria-label="ประวัติ" className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 ring-1 ring-gray-200/70">
                {[
                  { id: "deposits", label: "การฝาก" },
                  { id: "redemptions", label: "การแลกของ" },
                  { id: "rewards", label: "ของรางวัล" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`h-12 rounded-xl text-sm font-semibold ${tab === t.id ? "bg-emerald-700 text-white" : "text-gray-600"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "deposits" && (
                <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
                  {data.deposits.length === 0 && <p className="text-sm text-gray-500">ยังไม่มีการฝาก</p>}
                  <ul className="divide-y divide-gray-100">
                    {data.deposits.map((d) => (
                      <li key={d.id} className="py-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            {formatThaiDate(d.date)} • {formatThaiTime(d.at)} น.
                          </span>
                          <span className="text-sm font-bold text-emerald-700">+{fmtKg(d.totalKg)} กก.</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {d.items.map((it) => `${getWasteTypeLabel(it.type)} ${fmtKg(it.kg)}`).join(" • ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === "redemptions" && (
                <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
                  {data.redemptions.length === 0 && <p className="text-sm text-gray-500">ยังไม่เคยแลกของ</p>}
                  <ul className="divide-y divide-gray-100">
                    {data.redemptions.map((r) => (
                      <li key={r.id} className="py-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            {formatThaiDate(r.date)} • {formatThaiTime(r.at)} น.
                          </span>
                          <span className="text-sm font-bold text-gray-900">−{fmtKg(r.totalKg)} กก.</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{r.items.map((it) => `${it.name} ×${it.qty}`).join(", ")}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === "rewards" && (
                <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
                  <p className="text-sm text-gray-600 mb-2">นำบัตรมาแลกได้ที่จุดรับ — ใช้น้ำหนักคงเหลือตามรายการ</p>
                  {data.rewards.length === 0 && <p className="text-sm text-gray-500">ยังไม่มีของรางวัล</p>}
                  <ul className="divide-y divide-gray-100">
                    {data.rewards.map((r) => {
                      const enough = m.balanceKg + 0.001 >= r.kgCost;
                      const out = typeof r.stock === "number" && r.stock <= 0;
                      return (
                        <li key={r.id} className={`py-3 flex justify-between gap-3 ${out ? "opacity-50" : ""}`}>
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-gray-900">{r.name}</p>
                            <p className="text-xs text-gray-500">{out ? "ของหมด" : enough ? "แลกได้แล้ว" : `ขาดอีก ${fmtKg(r.kgCost - m.balanceKg)} กก.`}</p>
                          </div>
                          <span className={`text-sm font-bold whitespace-nowrap ${enough && !out ? "text-emerald-700" : "text-gray-700"}`}>
                            {fmtKg(r.kgCost)} กก./{r.unit}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {isSignedIn && forceMemberView && (
                <Link
                  href={`/admin/recycle/deposit?code=${encodeURIComponent(m.code)}`}
                  className="block text-center text-sm font-semibold text-emerald-800 py-2"
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
