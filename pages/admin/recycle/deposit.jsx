// หน้าบันทึกการฝากขยะรีไซเคิล — เปิดจากการสแกน QR บนบัตรสมาชิก
// URL: /admin/recycle/deposit?code=PS-0001  (หรือ ?memberId=<ObjectId>)
// ⚠️ path + query `code` ถูกพิมพ์ลง QR แล้ว ห้ามเปลี่ยน
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import { getActiveTypesByGroup, getWasteTypeLabel } from "@/lib/recycle/wasteTypes";
import { normalizeDepositItems, parseKg, roundKg } from "@/lib/recycle/validate";
import { getBalanceKg } from "@/lib/recycle/balance";
import { formatThaiDate, formatThaiTime, getBangkokYMD } from "@/lib/recycle/dates";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";

const GROUPS = getActiveTypesByGroup();
const emptyWeights = () => Object.fromEntries(GROUPS.flatMap((g) => g.types.map((t) => [t.id, ""])));

function DepositPageInner() {
  const router = useRouter();
  const code = typeof router.query.code === "string" ? router.query.code : "";
  const memberIdQuery = typeof router.query.memberId === "string" ? router.query.memberId : "";

  const [member, setMember] = useState(null);
  const [loadingMember, setLoadingMember] = useState(true);
  const [step, setStep] = useState("form"); // form | done
  const [weights, setWeights] = useState(emptyWeights);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null); // deposit ที่บันทึกล่าสุด (ใช้แก้ไขได้)

  const loadMember = useCallback(async () => {
    if (!router.isReady) return;
    setLoadingMember(true);
    setError("");
    try {
      if (code) {
        const json = await recycleFetch(`/members?code=${encodeURIComponent(code)}`);
        setMember(json.member);
      } else if (memberIdQuery) {
        const json = await recycleFetch(`/members/${memberIdQuery}`);
        setMember(json.member);
      } else {
        setMember(null);
        setError("ไม่พบรหัสสมาชิกในลิงก์ — สแกน QR บนบัตร หรือค้นหาจากหน้ารับฝาก");
      }
    } catch (e) {
      setMember(null);
      setError(e.message);
    } finally {
      setLoadingMember(false);
    }
  }, [router.isReady, code, memberIdQuery]);

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  const summary = useMemo(() => {
    let total = 0;
    let count = 0;
    const byGroup = {};
    for (const g of GROUPS) {
      let s = 0;
      for (const t of g.types) {
        const kg = parseKg(weights[t.id]);
        if (kg) {
          s += kg;
          count += 1;
        }
      }
      byGroup[g.id] = roundKg(s);
      total += s;
    }
    return { total: roundKg(total), count, byGroup };
  }, [weights]);

  const setWeight = (id, raw) => {
    // รับเฉพาะตัวเลขและจุดทศนิยม 1 จุด, ทศนิยมไม่เกิน 2 ตำแหน่ง
    let v = String(raw).replace(/,/g, ".").replace(/[^\d.]/g, "");
    const parts = v.split(".");
    if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
    const [i, d] = v.split(".");
    if (d !== undefined) v = `${i}.${d.slice(0, 2)}`;
    setWeights((w) => ({ ...w, [id]: v }));
  };

  const submit = async () => {
    if (!member || saving) return;
    const { errors } = normalizeDepositItems(weights);
    if (errors.length) {
      setError(errors.join(", "));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = { items: weights, note };
      const json = saved
        ? await recycleFetch(`/deposits/${saved._id}`, { method: "PUT", body })
        : await recycleFetch(`/deposits`, { method: "POST", body: { ...body, memberId: member._id } });
      setSaved(json.deposit);
      if (json.member) setMember(json.member);
      setStep("done");
      document.getElementById("recycle-deposit-top")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const editSaved = () => {
    if (!saved) return;
    const w = emptyWeights();
    for (const it of saved.items) w[it.type] = String(it.kg);
    setWeights(w);
    setNote(saved.note || "");
    setStep("form");
  };

  const nextPerson = () => router.push("/admin/recycle?tab=deposit");

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-white px-4 pt-5 pb-6">
      <div className="max-w-xl mx-auto space-y-4">
        <div id="recycle-deposit-top" className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5 flex items-center gap-3">
          <Link
            href="/admin/recycle?tab=deposit"
            aria-label="กลับหน้ารับฝาก"
            className="h-11 w-11 shrink-0 rounded-2xl border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900">รับฝากขยะรีไซเคิล</h1>
            <p className="text-sm text-gray-500">โครงการพระสังข์หอบทอง • {formatThaiDate(getBangkokYMD())}</p>
          </div>
        </div>

        {loadingMember && (
          <div className="rounded-3xl bg-white/80 ring-1 ring-gray-200/60 p-6 text-center text-gray-500">กำลังโหลดข้อมูลสมาชิก...</div>
        )}

        {error && (
          <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-5" role="alert">
            <p className="font-semibold text-amber-900">ดำเนินการไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
          </div>
        )}

        {member && (
          <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-5 flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-2xl font-bold">
              {member.fullName?.trim()?.[0] || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-gray-900 truncate">{member.fullName}</p>
              <p className="text-sm text-gray-500">
                {member.code}
                {member.community ? ` • ชุมชน${member.community}` : ""}
              </p>
              {!member.isActive && <p className="text-sm font-semibold text-red-700 mt-1">สมาชิกนี้ถูกปิดการใช้งาน</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500">คงเหลือแลกได้</p>
              <p className="text-lg font-bold text-emerald-700">{fmtKg(getBalanceKg(member))} กก.</p>
            </div>
          </div>
        )}

        {member && member.isActive && step === "form" && (
          <Link
            href={`/admin/recycle/redeem?code=${encodeURIComponent(member.code)}`}
            className="h-12 w-full rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-semibold flex items-center justify-center hover:bg-amber-100"
          >
            สมาชิกต้องการแลกของ (ตัดยอด) →
          </Link>
        )}

        {member && step === "form" && (
          <>
            <p className="px-1 text-sm text-gray-600">
              กรอกน้ำหนัก <strong>(กิโลกรัม)</strong> เฉพาะประเภทที่นำมา — ช่องที่ว่างจะไม่ถูกบันทึก
            </p>

            {GROUPS.map((g) => (
              <section key={g.id} className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${g.chipClass}`}>{g.label}</span>
                  {summary.byGroup[g.id] > 0 && (
                    <span className="text-sm text-gray-500">รวม {fmtKg(summary.byGroup[g.id])} กก.</span>
                  )}
                </div>
                {g.types.map((t) => {
                  const filled = !!parseKg(weights[t.id]);
                  const inputId = `kg-${t.id}`;
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <label htmlFor={inputId} className="flex-1 text-base font-medium text-gray-900">
                        {t.label}
                      </label>
                      <div
                        className={[
                          "flex items-center rounded-2xl border-2 shadow-sm transition-colors",
                          filled ? "border-emerald-600 bg-emerald-50" : "border-gray-200 bg-white",
                          "focus-within:ring-4 focus-within:ring-emerald-500/20 focus-within:border-emerald-600",
                        ].join(" ")}
                      >
                        <input
                          id={inputId}
                          value={weights[t.id]}
                          onChange={(e) => setWeight(t.id, e.target.value)}
                          inputMode="decimal"
                          enterKeyHint="next"
                          autoComplete="off"
                          placeholder="0"
                          className="h-14 w-24 bg-transparent text-right text-2xl font-semibold text-gray-900 outline-none placeholder:text-gray-300"
                        />
                        <span className="pl-1 pr-3 text-sm text-gray-500">กก.</span>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}

            <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm p-4">
              <label htmlFor="note" className="block text-sm text-gray-600 mb-1">
                หมายเหตุ (ถ้ามี)
              </label>
              <input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                className="h-12 w-full rounded-2xl border border-gray-200/70 bg-white shadow-sm px-4 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
          </>
        )}

        {member && step === "done" && saved && (
          <div className="space-y-4">
            <div className="rounded-3xl bg-emerald-50/90 ring-1 ring-emerald-200/80 p-6 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-emerald-700 text-white flex items-center justify-center">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </div>
              <p className="mt-3 text-xl font-bold text-emerald-900">บันทึกการฝากแล้ว</p>
              <p className="text-sm text-emerald-800 mt-1">
                {formatThaiDate(saved.depositDate)} • {formatThaiTime(saved.createdAt)} น.
              </p>
            </div>
            <div className="rounded-3xl bg-white/90 ring-1 ring-gray-200/60 shadow-sm px-5 py-2">
              {saved.items.map((it) => (
                <div key={it.type} className="flex justify-between py-3 border-b border-gray-100 text-base">
                  <span>{getWasteTypeLabel(it.type)}</span>
                  <span className="font-semibold">{fmtKg(it.kg)} กก.</span>
                </div>
              ))}
              <div className="flex justify-between items-baseline py-4">
                <span className="font-semibold">รวมครั้งนี้</span>
                <span className="text-2xl font-bold text-emerald-700">{fmtKg(saved.totalKg)} กก.</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 p-4">
                <p className="text-xs text-gray-500">คงเหลือแลกได้</p>
                <p className="text-xl font-bold text-emerald-700">{fmtKg(getBalanceKg(member))} กก.</p>
              </div>
              <div className="rounded-2xl bg-white ring-1 ring-gray-200/60 p-4">
                <p className="text-xs text-gray-500">ฝากมาแล้ว</p>
                <p className="text-xl font-bold">{member.depositCount} ครั้ง</p>
              </div>
            </div>
            <button
              type="button"
              onClick={nextPerson}
              className="h-14 w-full rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 shadow-sm"
            >
              สแกนคนถัดไป
            </button>
            <Link
              href={`/admin/recycle/redeem?code=${encodeURIComponent(member.code)}`}
              className="h-12 w-full rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-semibold flex items-center justify-center hover:bg-amber-100"
            >
              แลกของ (ตัดยอด)
            </Link>
            <button
              type="button"
              onClick={editSaved}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50 shadow-sm"
            >
              แก้ไขรายการนี้
            </button>
          </div>
        )}

        {member && step === "form" && (
          <div className="sticky bottom-14 md:bottom-0 z-30 -mx-4 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 rounded-t-3xl">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">{summary.count ? `รวม ${summary.count} ประเภท` : "ยังไม่ได้กรอก"}</span>
                <span className="text-2xl font-bold text-gray-900">
                  {fmtKg(summary.total)} <span className="text-sm font-medium text-gray-500">กก.</span>
                </span>
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={saving || summary.count === 0 || !member.isActive}
                className="h-14 w-full rounded-2xl bg-emerald-700 text-white text-lg font-bold hover:bg-emerald-800 disabled:opacity-50 shadow-sm"
              >
                {saving ? "กำลังบันทึก..." : saved ? "บันทึกการแก้ไข" : "บันทึกการฝาก"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function RecycleDepositPage() {
  return (
    <PermissionGuard requiredPath="/admin/recycle">
      <DepositPageInner />
    </PermissionGuard>
  );
}
