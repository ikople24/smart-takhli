// ตัดยอดน้ำหนักเพื่อแลกของรางวัล — โครงการพระสังข์หอบทอง
// URL: /admin/recycle/redeem?code=PS-0001  (เข้าจากหน้าบันทึกการฝาก / ข้อมูลสมาชิก)
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import { getBalanceKg } from "@/lib/recycle/balance";
import { roundKg } from "@/lib/recycle/validate";
import { formatThaiDate, formatThaiTime, getBangkokYMD } from "@/lib/recycle/dates";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-white px-4 pt-5 pb-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5 flex items-center gap-3">
          <Link
            href={code ? `/admin/recycle/deposit?code=${encodeURIComponent(code)}` : "/admin/recycle"}
            aria-label="กลับหน้าบันทึกการฝาก"
            className="h-11 w-11 shrink-0 rounded-2xl border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900">แลกของ (ตัดยอดน้ำหนัก)</h1>
            <p className="text-sm text-gray-500">โครงการพระสังข์หอบทอง • {formatThaiDate(getBangkokYMD())}</p>
          </div>
        </div>

        {loading && <div className="rounded-3xl bg-white/80 ring-1 ring-gray-200/60 p-6 text-center text-gray-500">กำลังโหลด...</div>}

        {error && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5" role="alert">
            <p className="font-semibold text-amber-900">ดำเนินการไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
          </div>
        )}

        {member && (
          <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5">
            <p className="text-lg font-bold text-gray-900">{member.fullName}</p>
            <p className="text-sm text-gray-500">{member.code}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">ฝากทั้งหมด</p>
                <p className="text-base font-bold">{fmtKg(member.totalKg)}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">แลกไปแล้ว</p>
                <p className="text-base font-bold">{fmtKg(member.redeemedKg)}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                <p className="text-xs text-emerald-800">คงเหลือ</p>
                <p className="text-xl font-bold text-emerald-700">{fmtKg(balance)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 text-right">หน่วย: กิโลกรัม</p>
          </div>
        )}

        {member && step === "pick" && (
          <>
            {rewards.length === 0 && (
              <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 p-6 text-center text-gray-500">
                ยังไม่มีของรางวัล —{" "}
                <Link href="/admin/recycle?tab=rewards" className="font-semibold text-emerald-800">
                  เพิ่มของรางวัล
                </Link>
              </div>
            )}
            {rewards.map((r) => {
              const n = qty[r._id] || 0;
              const outOfStock = typeof r.stock === "number" && r.stock <= 0;
              const tooExpensive = r.kgCost > balance + 0.001;
              return (
                <div
                  key={r._id}
                  className={[
                    "rounded-3xl bg-white shadow-sm p-4 flex items-center gap-3 ring-1",
                    n > 0 ? "ring-2 ring-emerald-600 bg-emerald-50/40" : "ring-gray-200/60",
                    outOfStock ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-gray-900">{r.name}</p>
                    <p className="text-sm text-gray-600">
                      ใช้ <strong className="text-gray-900">{fmtKg(r.kgCost)} กก.</strong> / {r.unit}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {typeof r.stock === "number" ? (outOfStock ? "ของหมด" : `เหลือ ${r.stock} ${r.unit}`) : "ไม่จำกัดจำนวน"}
                      {!outOfStock && tooExpensive && n === 0 ? " • ยอดไม่พอ" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => change(r, -1)}
                      disabled={n === 0}
                      aria-label={`ลด ${r.name}`}
                      className="h-14 w-14 rounded-2xl border-2 border-gray-200 bg-white text-3xl font-bold text-gray-700 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-2xl font-bold tabular-nums" aria-live="polite">
                      {n}
                    </span>
                    <button
                      type="button"
                      onClick={() => change(r, +1)}
                      disabled={!canAdd(r)}
                      aria-label={`เพิ่ม ${r.name}`}
                      className="h-14 w-14 rounded-2xl bg-emerald-700 text-3xl font-bold text-white disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {member && step === "confirm" && (
          <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5 space-y-3">
            <p className="text-base font-semibold text-gray-900">ยืนยันการแลกของ</p>
            <ul className="divide-y divide-gray-100">
              {cart.lines.map((l) => (
                <li key={l._id} className="py-3 flex justify-between text-base">
                  <span>
                    {l.name} × {l.qty} {l.unit}
                  </span>
                  <span className="font-semibold">{fmtKg(l.subtotal)} กก.</span>
                </li>
              ))}
            </ul>
            <div className="rounded-2xl bg-gray-50 p-4 space-y-1 text-base">
              <div className="flex justify-between">
                <span>คงเหลือก่อนแลก</span>
                <span>{fmtKg(balance)} กก.</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>ตัดยอด</span>
                <span>− {fmtKg(cart.total)} กก.</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                <span>คงเหลือหลังแลก</span>
                <span className="text-emerald-700">{fmtKg(cart.after)} กก.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="h-14 w-full rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "ยืนยัน ตัดยอดและมอบของ"}
            </button>
            <button
              type="button"
              onClick={() => setStep("pick")}
              disabled={saving}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white font-semibold text-gray-800 hover:bg-gray-50"
            >
              กลับไปแก้ไข
            </button>
          </div>
        )}

        {member && step === "done" && result && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-emerald-50/90 ring-1 ring-emerald-200/80 p-6 text-center">
              <p className="text-xl font-bold text-emerald-900">ตัดยอดเรียบร้อย มอบของได้เลย</p>
              <ul className="mt-3 text-base text-emerald-900 space-y-1">
                {result.items.map((it) => (
                  <li key={String(it.rewardId)}>
                    {it.name} × {it.qty} {it.unit}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-emerald-800">
                ตัดยอด {fmtKg(result.totalKg)} กก. • คงเหลือ <strong>{fmtKg(getBalanceKg(member))} กก.</strong>
              </p>
            </div>
            <Link
              href="/admin/recycle?tab=deposit"
              className="h-14 w-full rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 flex items-center justify-center"
            >
              สแกนคนถัดไป
            </Link>
            <button
              type="button"
              onClick={() => setStep("pick")}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white font-semibold text-gray-800 hover:bg-gray-50"
            >
              แลกเพิ่ม
            </button>
          </div>
        )}

        {member && history.length > 0 && step !== "confirm" && (
          <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5">
            <p className="text-base font-semibold text-gray-900">ประวัติการแลกล่าสุด</p>
            <ul className="mt-2 divide-y divide-gray-100">
              {history.map((h) => (
                <li key={h._id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatThaiDate(h.redeemDate)} {formatThaiTime(h.createdAt)} น.
                    </p>
                    <p className="text-xs text-gray-500">{h.items.map((it) => `${it.name} ×${it.qty}`).join(", ")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">−{fmtKg(h.totalKg)} กก.</p>
                    <button type="button" onClick={() => voidRedemption(h)} className="text-xs text-red-700 hover:underline">
                      ยกเลิก
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {member && step === "pick" && (
          <div className="sticky bottom-14 md:bottom-0 z-30 -mx-4 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 rounded-t-3xl">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">
                  ใช้ {fmtKg(cart.total)} กก. • เหลือ {fmtKg(cart.after)} กก.
                </span>
                <span className="text-sm text-gray-600">{cart.lines.reduce((s, l) => s + l.qty, 0)} ชิ้น</span>
              </div>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                disabled={cart.lines.length === 0 || !member.isActive}
                className="h-14 w-full rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 disabled:opacity-50 shadow-sm"
              >
                ถัดไป: ตรวจสอบก่อนตัดยอด
              </button>
            </div>
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
