// หน้าบันทึกการฝากขยะรีไซเคิล — ดีไซน์ตามแคนวาส "พระสังข์หอบทอง — UI ฉบับปรับใหม่" (หน้า 2 และ 3)
// URL: /admin/recycle/deposit?code=PS-0001  (หรือ ?memberId=<ObjectId>)
// เข้าจาก QR บนบัตร: /recycle/m/<token> จะพาเจ้าหน้าที่ที่ล็อกอินมาที่หน้านี้
//
// การกรอก: แตะการ์ดประเภทขยะ → กดแป้นตัวเลขใหญ่บนจอ (หรือคีย์บอร์ดจริงบนคอม)
// "ประเภทถัดไป" เลื่อนไปการ์ดถัดไป, Enter บนคีย์บอร์ด = ถัดไป
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import PermissionGuard from "@/components/PermissionGuard";
import RecycleLoading from "@/components/recycle/RecycleLoading";
import { WASTE_TYPES, getWasteTypeLabel } from "@/lib/recycle/wasteTypes";
import { normalizeDepositItems, parseKg, roundKg } from "@/lib/recycle/validate";
import { getBalanceKg, getRewardProgress } from "@/lib/recycle/balance";
import { applyKey } from "@/lib/recycle/keypad";
import { formatThaiDate, formatThaiTime, getBangkokYMD } from "@/lib/recycle/dates";
import { fmtKg, recycleFetch } from "@/lib/recycle/client";
import { RECYCLE_POINT_LABEL } from "@/lib/recycle/config";
import { DISPLAY, GROUP_THEME, ICON, Icon, RECYCLE_ROOT, TYPE_ICON, FALLBACK_ICON } from "@/lib/recycle/theme";

const TYPES = WASTE_TYPES.filter((t) => t.active);
const emptyWeights = () => Object.fromEntries(TYPES.map((t) => [t.id, ""]));
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

function WeightTile({ type, value, active, onPick }) {
  const g = GROUP_THEME[type.group] || GROUP_THEME.metal;
  const filled = !!parseKg(value);
  const solid = filled && !active;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      aria-label={`${type.label} ${filled ? `${value} กิโลกรัม` : "ยังไม่กรอก"}`}
      className="relative flex flex-col items-start gap-1.5 text-left min-h-[140px] p-3.5 rounded-[22px] border-[3px] transition-[transform,box-shadow] active:scale-[.97]"
      style={{
        background: active ? "#FFFFFF" : filled ? g.fg : g.bg,
        borderColor: active ? g.fg : "transparent",
        boxShadow: active ? "0 8px 20px rgba(23,37,28,.16)" : filled ? "0 4px 10px rgba(23,37,28,.12)" : "none",
      }}
    >
      <span className="flex w-full items-start justify-between">
        <span
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ color: g.fg, background: active ? g.bg : "#FFFFFF" }}
        >
          <Icon d={TYPE_ICON[type.id] || FALLBACK_ICON} size={28} />
        </span>
        {active && (
          <span className="h-[26px] px-2.5 rounded-full text-xs font-bold text-white flex items-center" style={{ background: g.fg }}>
            กำลังกรอก
          </span>
        )}
        {solid && (
          <span className="h-[26px] w-[26px] rounded-full bg-white flex items-center justify-center" style={{ color: g.fg }}>
            <Icon d={ICON.check} size={16} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="text-[15px] font-semibold leading-snug" style={{ color: solid ? "#FFFFFF" : "#17251C" }}>
        {type.label}
      </span>
      <span className="mt-auto flex items-baseline gap-1">
        {active || filled ? (
          <>
            <span className={`${DISPLAY} text-[30px] font-semibold leading-none`} style={{ color: active ? g.fg : "#FFFFFF" }}>
              {active ? value || "0" : value}
            </span>
            {active && <span className="caret" style={{ background: g.fg }} />}
            <span className="text-sm font-medium" style={{ color: solid ? "#FFFFFF" : "#51605A" }}>
              กก.
            </span>
          </>
        ) : (
          <span className="text-[13px] font-semibold" style={{ color: g.fg }}>
            แตะเพื่อกรอก
          </span>
        )}
      </span>
      <style jsx>{`
        .caret {
          display: inline-block;
          width: 3px;
          height: 28px;
          margin-left: 2px;
          border-radius: 2px;
          align-self: center;
          animation: blink 1s steps(1) infinite;
        }
        @keyframes blink {
          50% {
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .caret {
            animation: none;
          }
        }
      `}</style>
    </button>
  );
}

function DepositPageInner() {
  const router = useRouter();
  const code = typeof router.query.code === "string" ? router.query.code : "";
  const memberIdQuery = typeof router.query.memberId === "string" ? router.query.memberId : "";

  const [member, setMember] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [loadingMember, setLoadingMember] = useState(true);
  const [step, setStep] = useState("form"); // form | done
  const [weights, setWeights] = useState(emptyWeights);
  const [activeId, setActiveId] = useState(TYPES[0]?.id);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null); // deposit ที่บันทึกล่าสุด (ใช้แก้ไขได้)

  const loadMember = useCallback(async () => {
    if (!router.isReady) return;
    setLoadingMember(true);
    setError("");
    try {
      const rewardsReq = recycleFetch("/rewards?active=true").catch(() => ({ rewards: [] }));
      let json;
      if (code) json = await recycleFetch(`/members?code=${encodeURIComponent(code)}`);
      else if (memberIdQuery) json = await recycleFetch(`/members/${memberIdQuery}`);
      else {
        setMember(null);
        setError("ไม่พบรหัสสมาชิกในลิงก์ — สแกน QR บนบัตร หรือค้นหาจากหน้ารับฝาก");
        return;
      }
      setMember(json.member);
      setRewards((await rewardsReq).rewards || []);
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
    const parts = [];
    for (const t of TYPES) {
      const kg = parseKg(weights[t.id]);
      if (kg) {
        total += kg;
        count += 1;
        parts.push({ id: t.id, kg, bar: (GROUP_THEME[t.group] || GROUP_THEME.metal).bar });
      }
    }
    total = roundKg(total);
    return { total, count, parts: parts.map((p) => ({ ...p, pct: total ? (p.kg / total) * 100 : 0 })) };
  }, [weights]);

  const activeType = TYPES.find((t) => t.id === activeId) || TYPES[0];
  const activeTheme = GROUP_THEME[activeType.group] || GROUP_THEME.metal;

  const pressKey = useCallback(
    (key) => setWeights((w) => ({ ...w, [activeId]: applyKey(w[activeId], key) })),
    [activeId]
  );
  const nextType = useCallback(() => {
    const i = TYPES.findIndex((t) => t.id === activeId);
    setActiveId(TYPES[(i + 1) % TYPES.length].id);
  }, [activeId]);

  // คีย์บอร์ดจริง (เจ้าหน้าที่ใช้คอม): ตัวเลข . Backspace Enter
  useEffect(() => {
    if (step !== "form") return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key) || e.key === ".") pressKey(e.key);
      else if (e.key === "Backspace") pressKey("del");
      else if (e.key === "Enter") nextType();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, pressKey, nextType]);

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

  const balance = member ? getBalanceKg(member) : 0;
  const progress = getRewardProgress(balance, rewards);
  const redeemHref = member ? `/admin/recycle/redeem?code=${encodeURIComponent(member.code)}` : "/admin/recycle";

  // ---------- หน้าบันทึกแล้ว (ใบเสร็จ) ----------
  if (member && step === "done" && saved) {
    return (
      <main className={`${RECYCLE_ROOT} min-h-screen !bg-[#146C43] px-5 pt-9 pb-8`}>
        <div id="recycle-deposit-top" className="max-w-md mx-auto flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2.5 text-white text-center">
            <div className="w-[72px] h-[72px] rounded-full bg-white text-[#146C43] flex items-center justify-center">
              <Icon d={ICON.check} size={38} strokeWidth={2.6} />
            </div>
            <h1 className={`${DISPLAY} text-2xl font-semibold`}>บันทึกการฝากแล้ว</h1>
            <p className="text-sm text-[#CFE6D8]">ขอบคุณที่ช่วยแยกขยะให้ตาคลี</p>
          </div>

          <section className="bg-white rounded-[26px] overflow-hidden">
            <div className="px-[18px] pt-[18px] pb-3.5">
              <div className="flex justify-between items-baseline gap-3">
                <p className="text-base font-semibold">{member.fullName}</p>
                <p className="text-xs text-[#51605A] whitespace-nowrap">
                  {formatThaiDate(saved.depositDate)} · {formatThaiTime(saved.createdAt)}
                </p>
              </div>
              <p className="text-xs text-[#51605A]">{member.code}</p>
            </div>
            <div className="flex items-center" aria-hidden="true">
              <div className="w-3.5 h-7 rounded-r-full bg-[#146C43]" />
              <div className="flex-1 border-t-2 border-dashed border-[#E4E0D4]" />
              <div className="w-3.5 h-7 rounded-l-full bg-[#146C43]" />
            </div>
            <ul className="px-[18px] pt-1.5">
              {saved.items.map((it) => {
                const t = TYPES.find((x) => x.id === it.type);
                const g = GROUP_THEME[t?.group] || GROUP_THEME.metal;
                return (
                  <li key={it.type} className="flex items-center gap-3 py-2.5">
                    <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ color: g.fg, background: g.bg }}>
                      <Icon d={TYPE_ICON[it.type] || FALLBACK_ICON} size={20} />
                    </span>
                    <span className="flex-1 text-[15px]">{getWasteTypeLabel(it.type)}</span>
                    <span className={`${DISPLAY} text-[17px] font-semibold`}>{fmtKg(it.kg)} กก.</span>
                  </li>
                );
              })}
            </ul>
            <div className="mx-[18px] mt-1 pt-3.5 pb-[18px] border-t border-[#F0EDE4] flex justify-between items-baseline">
              <span className="text-[15px] font-semibold">รวมครั้งนี้</span>
              <span className={`${DISPLAY} text-[32px] font-semibold text-[#146C43]`}>
                +{fmtKg(saved.totalKg)}
                <span className="text-[15px] font-medium"> กก.</span>
              </span>
            </div>
          </section>

          <section className="bg-[#0F5A37] rounded-[22px] px-[18px] py-4 text-white">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-[#CFE6D8]">คงเหลือแลกได้</span>
              <span className={`${DISPLAY} text-[26px] font-semibold`}>{fmtKg(balance)} กก.</span>
            </div>
            {progress.next ? (
              <>
                <div className="mt-2.5 h-2.5 rounded-full bg-[#2B7E57]">
                  <div className="h-2.5 rounded-full bg-[#F4B740]" style={{ width: `${progress.next.pct}%` }} />
                </div>
                <p className="mt-2 text-[13px] text-[#E8F3EC]">
                  อีก {fmtKg(progress.next.missingKg)} กก. แลก <strong className="text-white">{progress.next.name}</strong> ได้
                </p>
              </>
            ) : progress.allAffordable ? (
              <p className="mt-2 text-[13px] text-[#E8F3EC]">ยอดพอแลกของรางวัลได้ทุกรายการแล้ว</p>
            ) : null}
          </section>

          <button
            type="button"
            onClick={() => router.push("/admin/recycle?tab=deposit")}
            className={`${DISPLAY} h-[60px] rounded-[20px] bg-white text-[#146C43] text-lg font-semibold active:scale-[.98]`}
          >
            สแกนคนถัดไป
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href={redeemHref}
              className="h-[50px] rounded-2xl bg-[#F4B740] text-[#3D2A00] text-[15px] font-bold flex items-center justify-center"
            >
              แลกของเลย
            </Link>
            <button
              type="button"
              onClick={editSaved}
              className="h-[50px] rounded-2xl border-[1.5px] border-[#5FA582] text-white text-[15px] font-semibold"
            >
              แก้ไขรายการ
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- หน้ากรอกน้ำหนัก ----------
  return (
    <main className={`${RECYCLE_ROOT} min-h-screen`}>
      <div className="max-w-xl lg:max-w-5xl mx-auto px-4 pt-4 pb-6">
        <header id="recycle-deposit-top" className="flex items-center gap-3 pb-3">
          <Link
            href="/admin/recycle?tab=deposit"
            aria-label="กลับหน้ารับฝาก"
            className="w-11 h-11 rounded-[14px] bg-white border border-[#E4E0D4] flex items-center justify-center shrink-0"
          >
            <Icon d={ICON.back} size={20} strokeWidth={2} />
          </Link>
          <div>
            <h1 className={`${DISPLAY} text-[19px] font-semibold leading-tight`}>รับฝากขยะ</h1>
            <p className="text-xs text-[#51605A]">
              {formatThaiDate(getBangkokYMD())}
              {RECYCLE_POINT_LABEL ? ` · ${RECYCLE_POINT_LABEL}` : ""}
            </p>
          </div>
        </header>

        {loadingMember && <RecycleLoading message="กำลังเปิดข้อมูลสมาชิก" />}

        {error && (
          <div className="rounded-3xl bg-amber-50 ring-1 ring-amber-200 p-5 mb-3" role="alert">
            <p className="font-semibold text-amber-900">ดำเนินการไม่ได้</p>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
          </div>
        )}

        {member && (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:items-start">
            <div>
              <section className="bg-[#146C43] text-white rounded-3xl px-4 py-3.5 flex items-center gap-3">
                <div className={`${DISPLAY} w-12 h-12 rounded-2xl bg-white text-[#146C43] flex items-center justify-center text-[22px] font-bold shrink-0`}>
                  {member.fullName?.trim()?.[0] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-semibold truncate">{member.fullName}</p>
                  <p className="text-[13px] text-[#CFE6D8] truncate">
                    {member.code}
                    {member.community ? ` · ชุมชน${member.community}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-[#CFE6D8]">คงเหลือ</p>
                  <p className={`${DISPLAY} text-xl font-semibold`}>
                    {fmtKg(balance)}
                    <span className="text-xs font-medium"> กก.</span>
                  </p>
                </div>
              </section>
              {member.isActive && !saved && (
                <Link
                  href={redeemHref}
                  className="mt-2 h-11 rounded-2xl bg-[#FDF3D9] text-[#4A3300] text-[15px] font-semibold flex items-center justify-center gap-2"
                >
                  <Icon d={ICON.gift} size={20} />
                  สมาชิกต้องการแลกของ
                </Link>
              )}
              {!member.isActive && (
                <p className="mt-2 rounded-2xl bg-red-50 text-red-800 text-sm font-semibold px-4 py-3">สมาชิกนี้ถูกปิดการใช้งาน — บันทึกการฝากไม่ได้</p>
              )}

              <div className="mt-4 mb-2.5 px-1 flex justify-between items-baseline">
                <p className="text-[15px] font-semibold">วันนี้นำอะไรมาบ้าง?</p>
                <p className="text-[13px] text-[#51605A]">
                  {summary.count ? `กรอกแล้ว ${summary.count} จาก ${TYPES.length} ประเภท` : "ยังไม่ได้กรอก"}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {TYPES.map((t) => (
                  <WeightTile key={t.id} type={t} value={weights[t.id]} active={t.id === activeId} onPick={() => setActiveId(t.id)} />
                ))}
                <div className="rounded-[22px] bg-[#17251C] text-white p-3.5 flex flex-col justify-between min-h-[140px]">
                  <span className="text-[13px] text-[#C9D3CC]">รวมครั้งนี้</span>
                  <span className={`${DISPLAY} text-4xl font-semibold leading-tight`}>
                    {fmtKg(summary.total)}
                    <span className="text-[15px] font-medium"> กก.</span>
                  </span>
                  <span className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-[#2E3D33]">
                    {summary.parts.map((p) => (
                      <span key={p.id} className="h-2.5" style={{ width: `${p.pct}%`, background: p.bar }} />
                    ))}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <label htmlFor="note" className="block text-sm text-[#51605A] mb-1 px-1">
                  หมายเหตุ (ถ้ามี)
                </label>
                <input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  className="h-12 w-full rounded-2xl border border-[#E4E0D4] bg-white px-4 outline-none focus:border-[#146C43] focus:ring-4 focus:ring-[#146C43]/15"
                />
              </div>
            </div>

            {/* แป้นตัวเลข: มือถือติดล่างจอ (เหนือ BottomNav), จอใหญ่อยู่ด้านขวา */}
            <section className="sticky bottom-14 md:bottom-0 lg:top-4 lg:bottom-auto z-30 mt-4 lg:mt-0 -mx-4 lg:mx-0 bg-white rounded-t-[28px] lg:rounded-[28px] border-t lg:border border-[#E4E0D4] px-4 pt-3.5 pb-4 flex flex-col gap-2 shadow-[0_-6px_20px_rgba(23,37,28,.06)]">
              <div className="flex items-center gap-3 bg-[#F5F3EC] rounded-[18px] px-3.5 py-2">
                <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ color: activeTheme.fg, background: activeTheme.bg }}>
                  <Icon d={TYPE_ICON[activeType.id] || FALLBACK_ICON} size={20} />
                </span>
                <span className="flex-1 text-[15px] font-semibold truncate">{activeType.label}</span>
                <span className={`${DISPLAY} text-[32px] font-semibold min-w-[72px] text-right`} aria-live="polite">
                  {weights[activeId] || "0"}
                </span>
                <span className="text-sm text-[#51605A]">กก.</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pressKey(k)}
                    aria-label={k === "del" ? "ลบตัวเลข" : k === "." ? "จุดทศนิยม" : `เลข ${k}`}
                    className={`${DISPLAY} h-[52px] rounded-2xl text-[26px] font-medium active:scale-95 transition-transform ${
                      k === "del" ? "bg-[#F1EEE4]" : "bg-[#F5F3EC]"
                    }`}
                  >
                    {k === "del" ? "⌫" : k}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_2fr] gap-2">
                <button
                  type="button"
                  onClick={() => pressKey("clear")}
                  className="h-12 rounded-2xl border border-[#E4E0D4] bg-white text-[15px] font-semibold"
                >
                  ล้างช่องนี้
                </button>
                <button type="button" onClick={nextType} className="h-12 rounded-2xl bg-[#E2F0E7] text-[#0B4A2D] text-base font-bold">
                  ประเภทถัดไป →
                </button>
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={saving || summary.count === 0 || !member.isActive}
                className={`${DISPLAY} mt-0.5 h-14 rounded-[20px] bg-[#146C43] text-white text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.98]`}
              >
                <Icon d={ICON.check} size={22} strokeWidth={2.2} />
                {saving ? "กำลังบันทึก..." : `${saved ? "บันทึกการแก้ไข" : "บันทึกการฝาก"} · ${fmtKg(summary.total)} กก.`}
              </button>
            </section>
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
