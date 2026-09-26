// pages/flood/status/[ticket].tsx — ส่งแล้ว · ติดตามสถานะ (โมดูล flood-relief · หน้าจอ 3)
// public ไม่ต้องล็อกอิน · กุญแจ (?k= หรือจาก localStorage ของเครื่องที่ส่ง) ปลดรายละเอียด — ไม่มีกุญแจเห็นแค่ความคืบหน้า
// อัปเดตเองทุก 30 วินาที
import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Check, ChevronLeft, LoaderCircle, Phone, Share2, X } from "lucide-react";
import CitizenShell from "@/components/citizen/CitizenShell";
import StatusTimeline from "@/components/flood-relief/StatusTimeline";
import { CITIZEN_STATUS_CHIP, type PublicFloodRequest } from "@/components/flood-relief/types";
import { addLocalTicket, localKeyFor, LOCAL_TICKETS_KEY, parseLocalTickets } from "@/lib/flood-relief/localTickets";
import { DEFAULT_FLOOD_SETTINGS, telHref } from "@/lib/flood-relief/settings";
import { REQUEST_TYPE_META, URGENCY_META, isRequestType, isUrgency } from "@/lib/flood-relief/status";
import { parseTicket } from "@/lib/flood-relief/ticket";

const POLL_MS = 30_000;

type Payload = { request: PublicFloodRequest; hotline: string; callbackSlaMin: number };

function readLocal() {
  try {
    return parseLocalTickets(window.localStorage.getItem(LOCAL_TICKETS_KEY));
  } catch {
    return [];
  }
}

export default function FloodStatusPage() {
  const router = useRouter();
  const ticket = parseTicket(router.query.ticket)?.ticket ?? null;
  const [key, setKey] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // กุญแจ: จาก URL ก่อน (ลิงก์ที่แชร์) ไม่งั้นจากเครื่องนี้ · ได้จาก URL แล้วจำไว้ให้หน้า "คำขอของฉัน"
  useEffect(() => {
    if (!router.isReady || !ticket) return;
    const fromUrl = typeof router.query.k === "string" ? router.query.k : "";
    const local = readLocal();
    const k = fromUrl || localKeyFor(local, ticket);
    if (fromUrl && localKeyFor(local, ticket) !== fromUrl) {
      try {
        window.localStorage.setItem(
          LOCAL_TICKETS_KEY,
          JSON.stringify(addLocalTicket(local, { ticket, key: fromUrl, at: new Date().toISOString() }))
        );
      } catch {
        /* โหมดส่วนตัว */
      }
    }
    setKey(k);
  }, [router.isReady, router.query.k, ticket]);

  const load = useCallback(async () => {
    if (!ticket || key === null) return;
    try {
      const res = await fetch(`/api/flood-relief/public/requests/${ticket}${key ? `?k=${encodeURIComponent(key)}` : ""}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || "โหลดสถานะไม่สำเร็จ");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    }
  }, [ticket, key]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const hotline = data?.hotline ?? DEFAULT_FLOOD_SETTINGS.hotline;
  const r = data?.request;

  const share = async () => {
    if (!r) return;
    const url = `${window.location.origin}/flood/status/${r.ticket}${key ? `?k=${encodeURIComponent(key)}` : ""}`;
    const text = `ติดตามคำขอช่วยเหลือน้ำท่วม ${r.ticket} (เทศบาลเมืองตาคลี)`;
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch {
        /* ผู้ใช้กดยกเลิก — ไม่ต้องทำอะไร */
        return;
      }
    }
    window.open(`https://line.me/R/share?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  };

  if (router.isReady && !ticket) {
    return (
      <CitizenShell hideNav>
        <p className="mx-4 mt-10 text-center text-[14px] text-tk-ink-4">เลขที่คำขอไม่ถูกต้อง</p>
      </CitizenShell>
    );
  }

  const cancelled = r?.status === "cancelled";
  const finished = r?.status === "done";
  const chip = r ? CITIZEN_STATUS_CHIP[r.status] ?? CITIZEN_STATUS_CHIP.received : null;

  return (
    <>
      <Head>
        <title>{`${ticket ? `สถานะคำขอ ${ticket}` : "สถานะคำขอ"} · ศูนย์ช่วยเหลือน้ำท่วม`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <CitizenShell hideNav>
        <div className="relative bg-tk-flood px-4 pb-14 pt-3 text-white">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="กลับหน้าแรก" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full">
              <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
            </Link>
            <span className="text-[11px] font-semibold tracking-[1px] text-white/75">
              เลขที่คำขอ <span className="font-tk-mono">{ticket}</span>
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
              {cancelled ? (
                <X size={30} strokeWidth={2.6} className="text-tk-ink-4" aria-hidden />
              ) : (
                <Check size={30} strokeWidth={2.6} className="text-tk-done" aria-hidden />
              )}
            </span>
            <div>
              <div className="text-[20px] font-bold leading-[1.2]">
                {cancelled ? "คำขอนี้ถูกยกเลิก" : finished ? "ช่วยเหลือเสร็จสิ้นแล้ว" : "ศูนย์ฯ รับเรื่องแล้ว"}
              </div>
              <div className="mt-0.5 text-[12.5px] leading-[1.45] text-white/85">
                {cancelled ? (
                  <>หากยังต้องการความช่วยเหลือ โทร {hotline}</>
                ) : finished ? (
                  <>ขอบคุณที่แจ้งศูนย์ฯ ขอให้ปลอดภัย</>
                ) : r?.phoneMasked ? (
                  <>
                    เจ้าหน้าที่จะโทรกลับ <b className="font-tk-mono text-white">{r.phoneMasked}</b>
                    <br />
                    ภายใน {data?.callbackSlaMin ?? 15} นาที กรุณาเปิดเสียงโทรศัพท์
                  </>
                ) : (
                  <>เจ้าหน้าที่จะโทรกลับตามเบอร์ที่ให้ไว้ กรุณาเปิดเสียงโทรศัพท์</>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4 -mt-10 rounded-[20px] bg-white p-4 shadow-[0_8px_24px_rgba(60,40,100,0.10)]">
          {!r ? (
            <div className="flex justify-center py-8 text-tk-flood">
              {error ? (
                <p className="text-[13px] text-tk-overdue-ink">{error}</p>
              ) : (
                <LoaderCircle className="animate-spin" aria-label="กำลังโหลด" />
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-bold">สถานะการช่วยเหลือ</h2>
                {chip && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.cls}`}>
                    {chip.pulse && <span className="flood-pulse h-[7px] w-[7px] rounded-full bg-tk-due" />}
                    {chip.label}
                  </span>
                )}
              </div>
              {cancelled ? (
                <p className="mt-3 text-[12.5px] text-tk-ink-4">ศูนย์ฯ ปิดคำขอนี้แล้ว (ติดต่อไม่ได้ หรือเป็นคำขอซ้ำ)</p>
              ) : (
                <StatusTimeline request={r} />
              )}
              {error && <p className="mt-2 text-[11px] text-tk-ink-4">อัปเดตล่าสุดไม่สำเร็จ — จะลองใหม่อัตโนมัติ</p>}
            </>
          )}
        </div>

        {r && (
          <div className="mx-4 mt-3 rounded-[20px] bg-white px-4 py-3.5 shadow-tk-md">
            <h2 className="text-[14px] font-bold">สรุปคำขอ</h2>
            <dl className="mt-2.5 flex flex-col gap-2 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-tk-ink-4">เรื่อง</dt>
                <dd className="text-right font-semibold">{isRequestType(r.type) ? REQUEST_TYPE_META[r.type].label : r.type}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-tk-ink-4">ความเร่งด่วน</dt>
                <dd
                  className={`font-bold ${
                    r.urgency === "critical" ? "text-tk-overdue-ink" : r.urgency === "urgent" ? "text-tk-due-ink" : "text-tk-ink-3"
                  }`}
                >
                  {isUrgency(r.urgency) ? URGENCY_META[r.urgency].label : r.urgency}
                </dd>
              </div>
              {r.full ? (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-tk-ink-4">จุดเกิดเหตุ</dt>
                    <dd className="text-right font-semibold">
                      {[r.landmark, r.communityName ? `ชุมชน${r.communityName}` : null].filter(Boolean).join(" · ") || "ตามพิกัดที่ส่ง"}
                    </dd>
                  </div>
                  {r.peopleCount != null && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-tk-ink-4">คนในบ้าน</dt>
                      <dd className="font-semibold">{r.peopleCount} คน</dd>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11.5px] leading-normal text-tk-ink-4">
                  รายละเอียดจุดเกิดเหตุแสดงเฉพาะเครื่องที่ส่งคำขอ หรือผู้ที่ได้รับลิงก์แชร์
                </p>
              )}
            </dl>
          </div>
        )}

        <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
          <a
            href={telHref(hotline)}
            className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-tk-flood bg-white text-[13.5px] font-bold text-tk-flood"
          >
            <Phone size={18} aria-hidden />
            โทรหาศูนย์ฯ
          </a>
          <button
            type="button"
            onClick={share}
            disabled={!r}
            className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-tk-line-oa text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            <Share2 size={18} aria-hidden />
            แชร์ให้ญาติ
          </button>
        </div>

        <p className="mx-4 mb-6 mt-5 text-center text-[11px] text-tk-ink-6">
          บันทึกหน้านี้ไว้ · เปิดดูอีกครั้งได้จาก &ldquo;ติดตามคำขอของฉัน&rdquo; บนหน้าแรก
        </p>
      </CitizenShell>
    </>
  );
}
