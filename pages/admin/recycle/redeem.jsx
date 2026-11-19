// ตัดยอดน้ำหนักเพื่อแลกของรางวัล — โครงการพระสังข์หอบทอง
// URL: /admin/recycle/redeem?code=PS-0001  (เข้าจากหน้าบันทึกการฝาก / ข้อมูลสมาชิก)
// ดีไซน์ตามแคนวาส "พระสังข์หอบทอง — UI ฉบับปรับใหม่" หน้า 4
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import { getBalanceKg } from "@/lib/recycle/balance";
import { roundKg } from "@/lib/recycle/validate";
import { formatThaiDate, formatThaiTime, getBangkokYMD } from "@/lib/recycle/dates";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";
import RecycleLoading from "@/components/recycle/RecycleLoading";
import { DISPLAY, ICON, Icon, RECYCLE_ROOT, REWARD_TONES } from "@/lib/recycle/theme";

function RedeemPageInner() {
  const router = useRouter();
  const code = typeof router.query.code === "string" ? router.query.code : "";

  const [member, setMember] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [history, setHistory] = useState([]);
  const [qty, setQty] = useState({}); // rewardId -> จำนวน
  const [step, setStep] = useState("pick"); // pick | confirm | done
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    if (!router.isReady) return;
    if (!code) {
      setError("ไม่พบรหัสสมาชิกในลิงก์");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [m, r] = await Promise.all([
        recycleFetch(`/members?code=${encodeURIComponent(code)}`),
        recycleFetch(`/rewards?active=true`),
      ]);
      setMember(m.member);
      setRewards(r.rewards);
      const h = await recycleFetch(`/redemptions?memberId=${m.member._id}`);
      setHistory(h.redemptions.slice(0, 10));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [router.isReady, code]);

  useEffect(() => {
    load();
  }, [load]);

  const balance = member ? getBalanceKg(member) : 0;

  const cart = useMemo(() => {
    const lines = rewards
      .filter((r) => (qty[r._id] || 0) > 0)
      .map((r) => ({ ...r, qty: qty[r._id], subtotal: roundKg(r.kgCost * qty[r._id]) }));
    const total = roundKg(lines.reduce((s, l) => s + l.subtotal, 0));
    return { lines, total, after: roundKg(balance - total) };
  }, [rewards, qty, balance]);

  const canAdd = (r) => {
    const current = qty[r._id] || 0;
    if (typeof r.stock === "number" && current + 1 > r.stock) return false;
    return roundKg(cart.total + r.kgCost) <= balance + 0.001;
  };

  const change = (r, d) => {
    setError("");
    setQty((q) => {
      const next = Math.max(0, (q[r._id] || 0) + d);
      return { ...q, [r._id]: next };
    });
  };

  const confirm = async () => {
    if (saving || !member) return;
    setSaving(true);
    setError("");
    try {
      const items = cart.lines.map((l) => ({ rewardId: l._id, qty: l.qty }));
      const json = await recycleFetch("/redemptions", { method: "POST", body: { memberId: member._id, items } });
      setResult(json.redemption);
      setMember(json.member);
      setQty({});
      setStep("done");
      // โหลดสต็อก/ประวัติใหม่
      const [r, h] = await Promise.all([
        recycleFetch(`/rewards?active=true`),
        recycleFetch(`/redemptions?memberId=${json.member._id}`),
      ]);
      setRewards(r.rewards);
      setHistory(h.redemptions.slice(0, 10));
    } catch (e) {
      setError(e.message);
      setStep("pick");
    } finally {
      setSaving(false);
    }
  };

  const voidRedemption = async (rd) => {
    const reason = window.prompt(`ยกเลิกการแลกของ (${fmtKg(rd.totalKg)} กก.) และคืนยอดให้สมาชิก\nกรุณาระบุเหตุผล:`);
    if (!reason || !reason.trim()) return;
    try {
      const json = await recycleFetch(`/redemptions/${rd._id}`, { method: "DELETE", body: { reason } });
      setMember(json.member);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const backHref = code ? `/admin/recycle/deposit?code=${encodeURIComponent(code)}` : "/admin/recycle";
  const usedPct = balance > 0 ? Math.min(100, Math.round((cart.total / balance) * 100)) : 0;
  const pieceCount = cart.lines.reduce((s, l) => s + l.qty, 0);

  return (
    <main className={`${RECYCLE_ROOT} min-h-screen`}>
      <div className="max-w-xl lg:max-w-3xl mx-auto px-4 pt-4 pb-6 flex flex-col gap-3.5">
        <header className="flex items-center gap-3">
          <Link href={backHref} aria-label="กลับหน้าบันทึกการฝาก" className="w-11 h-11 rounded-[14px] bg-white border border-[#E4E0D4] flex items-center justify-center shrink-0">
            <Icon d={ICON.back} size={20} strokeWidth={2} />
          </Link>
          <div className="min-w-0">
            <h1 className={`${DISPLAY} text-[19px] font-semibold leading-tight`}>แลกของรางวัล</h1>
            <p className="text-xs text-[#51605A] truncate">
              {member ? `${member.fullName} · ${member.code}` : formatThaiDate(getBangkokYMD())}
            </p>
          </div>
        </header>

        {loading && <RecycleLoading message="กำลังเปิดรายการของรางวัล" />}

        {error && (
          <div className="rounded-3xl bg-amber-50 ring-1 ring-amber-200 p-5" role="alert">
            <p className="font-semibold text-amber-900">ดำเนินการไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
          </div>
        )}

        {member && step !== "done" && (
          <section className="bg-[#F4B740] text-[#3D2A00] rounded-[26px] px-[18px] py-4">
            <div className="flex justify-between items-end gap-3">
              <div>
                <p className="text-[13px] font-semibold">{step === "confirm" ? "คงเหลือหลังแลก" : cart.total ? "คงเหลือหลังแลก" : "คงเหลือแลกได้"}</p>
                <p className={`${DISPLAY} text-[40px] font-semibold leading-none mt-1`}>
                  {fmtKg(cart.after)}
                  <span className="text-base font-medium"> กก.</span>
                </p>
              </div>
              <div className="text-right text-[13px]">
                <p>มีอยู่ {fmtKg(balance)} กก.</p>
                <p className="font-bold">ใช้ไป {fmtKg(cart.total)} กก.</p>
              </div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-[#FBE3A8]">
              <div className="h-2.5 rounded-full bg-[#3D2A00] transition-[width]" style={{ width: `${usedPct}%` }} />
            </div>
          </section>
        )}

        {member && step === "pick" && (
          <>
            {rewards.length === 0 && (
              <div className="rounded-3xl bg-white border border-[#E4E0D4] p-6 text-center text-[#51605A]">
                ยังไม่มีของรางวัล —{" "}
                <Link href="/admin/recycle?tab=rewards" className="font-semibold text-[#146C43]">
                  เพิ่มของรางวัล
                </Link>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {rewards.map((r, i) => {
                const n = qty[r._id] || 0;
                const out = typeof r.stock === "number" && r.stock <= 0;
                const tone = REWARD_TONES[i % REWARD_TONES.length];
                return (
                  <div
                    key={r._id}
                    className={`bg-white rounded-[22px] p-3 flex flex-col ${out ? "opacity-[.55]" : ""}`}
                    style={{ border: n > 0 ? "2.5px solid #146C43" : "1px solid #E4E0D4" }}
                  >
                    <div className="relative h-[84px] rounded-2xl flex items-center justify-center" style={{ color: tone.fg, background: tone.bg }}>
                      <Icon d={ICON.gift} size={34} strokeWidth={1.6} />
                      {n > 0 && (
                        <span className={`${DISPLAY} absolute top-2 right-2 min-w-[30px] h-[26px] px-2 rounded-full bg-[#146C43] text-white text-sm font-semibold flex items-center justify-center`}>
                          ×{n}
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 text-sm font-semibold leading-snug min-h-[38px]">{r.name}</p>
                    <p className="text-xs text-[#51605A]">
                      {out ? "ของหมด" : typeof r.stock === "number" ? `เหลือ ${r.stock} ${r.unit}` : "มีตลอด"}
                    </p>
                    <p className={`${DISPLAY} mt-1.5 text-lg font-semibold text-[#146C43]`}>
                      {fmtKg(r.kgCost)}
                      <span className="text-xs font-medium text-[#51605A]"> กก./{r.unit}</span>
                    </p>
                    <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => change(r, -1)}
                        disabled={n === 0}
                        aria-label={`ลด ${r.name}`}
                        className="h-12 rounded-[14px] border-[1.5px] border-[#E4E0D4] bg-white text-[26px] font-semibold disabled:opacity-30 active:scale-95"
                      >
                        −
                      </button>
                      <span className={`${DISPLAY} min-w-6 text-center text-[22px] font-semibold`} aria-live="polite">
                        {n}
                      </span>
                      <button
                        type="button"
                        onClick={() => change(r, +1)}
                        disabled={!canAdd(r)}
                        aria-label={`เพิ่ม ${r.name}`}
                        className="h-12 rounded-[14px] bg-[#146C43] text-white text-[26px] font-semibold disabled:opacity-30 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {member && step === "confirm" && (
          <section className="bg-white rounded-[24px] border border-[#E4E0D4] p-5 flex flex-col gap-3">
            <p className={`${DISPLAY} text-xl font-semibold`}>ยืนยันการแลกของ</p>
            <ul className="divide-y divide-[#F0EDE4]">
              {cart.lines.map((l) => (
                <li key={l._id} className="py-3 flex justify-between gap-3 text-base">
                  <span>
                    {l.name} × {l.qty} {l.unit}
                  </span>
                  <span className="font-semibold whitespace-nowrap">{fmtKg(l.subtotal)} กก.</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-[#F5F3EC] p-4 space-y-1.5 text-base">
              <div className="flex justify-between">
                <span>คงเหลือก่อนแลก</span>
                <span>{fmtKg(balance)} กก.</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>ตัดยอด</span>
                <span>− {fmtKg(cart.total)} กก.</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-[#E4E0D4] pt-2">
                <span>คงเหลือหลังแลก</span>
                <span className="text-[#146C43]">{fmtKg(cart.after)} กก.</span>
              </div>
            </div>
          </section>
        )}

        {member && step === "done" && result && (
          <div className="flex flex-col gap-3">
            <section className="bg-[#146C43] text-white rounded-[26px] p-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-white text-[#146C43] flex items-center justify-center">
                <Icon d={ICON.check} size={34} strokeWidth={2.6} />
              </div>
              <p className={`${DISPLAY} mt-3 text-[22px] font-semibold`}>ตัดยอดเรียบร้อย มอบของได้เลย</p>
              <ul className="mt-3 text-base space-y-1">
                {result.items.map((it) => (
                  <li key={String(it.rewardId)}>
                    {it.name} × {it.qty} {it.unit}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-[#CFE6D8]">
                ตัดยอด {fmtKg(result.totalKg)} กก. • คงเหลือ <strong className="text-white">{fmtKg(getBalanceKg(member))} กก.</strong>
              </p>
            </section>
            <Link
              href="/admin/recycle?tab=deposit"
              className={`${DISPLAY} h-[60px] rounded-[20px] bg-[#146C43] text-white text-lg font-semibold flex items-center justify-center`}
            >
              สแกนคนถัดไป
            </Link>
            <button type="button" onClick={() => setStep("pick")} className="h-12 rounded-2xl border border-[#E4E0D4] bg-white font-semibold">
              แลกเพิ่ม
            </button>
          </div>
        )}

        {member && history.length > 0 && step !== "confirm" && (
          <section className="bg-white rounded-[22px] border border-[#E4E0D4] px-4 py-3">
            <p className="text-[15px] font-semibold">ประวัติการแลกล่าสุด</p>
            <ul className="mt-1 divide-y divide-[#F0EDE4]">
              {history.map((h) => (
                <li key={h._id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatThaiDate(h.redeemDate)} · {formatThaiTime(h.createdAt)} น.
                    </p>
                    <p className="text-xs text-[#51605A]">{h.items.map((it) => `${it.name} ×${it.qty}`).join(", ")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`${DISPLAY} text-base font-semibold text-[#7A5300]`}>−{fmtKg(h.totalKg)} กก.</p>
                    <button type="button" onClick={() => voidRedemption(h)} className="text-xs text-red-700 hover:underline">
                      ยกเลิก
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {member && (step === "pick" || step === "confirm") && (
          <div className="sticky bottom-0 z-30 -mx-4 lg:mx-0 bg-white border-t lg:border border-[#E4E0D4] rounded-t-[28px] lg:rounded-[28px] px-4 pt-3.5 pb-5 flex flex-col gap-2.5">
            {step === "pick" ? (
              <>
                <p className="text-sm text-[#51605A] text-center">
                  {pieceCount ? `เลือกแล้ว ${pieceCount} ชิ้น · ใช้ ${fmtKg(cart.total)} กก.` : "แตะ + เพื่อเลือกของ"}
                </p>
                <button
                  type="button"
                  onClick={() => setStep("confirm")}
                  disabled={cart.lines.length === 0 || !member.isActive}
                  className={`${DISPLAY} h-[60px] rounded-[20px] bg-[#146C43] text-white text-lg font-semibold disabled:opacity-40 active:scale-[.98]`}
                >
                  ถัดไป: ตรวจสอบก่อนตัดยอด
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={saving}
                  className={`${DISPLAY} h-[60px] rounded-[20px] bg-[#146C43] text-white text-lg font-semibold disabled:opacity-40 active:scale-[.98]`}
                >
                  {saving ? "กำลังบันทึก..." : "ยืนยัน ตัดยอดและมอบของ"}
                </button>
                <button type="button" onClick={() => setStep("pick")} disabled={saving} className="h-12 rounded-2xl border border-[#E4E0D4] bg-white font-semibold">
                  กลับไปแก้ไข
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function RecycleRedeemPage() {
  return (
    <PermissionGuard requiredPath="/admin/recycle">
      <RedeemPageInner />
    </PermissionGuard>
  );
}
