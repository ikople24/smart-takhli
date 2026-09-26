// pages/flood/status/index.tsx — คำขอของเครื่องนี้ (อ่านจาก localStorage "flood:tickets") ไม่ต้องล็อกอิน
// + ช่องกรอกเลขที่เองสำหรับคนที่ส่งจากเครื่องอื่น (ไม่มีกุญแจ = เห็นแค่ความคืบหน้า)
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight } from "lucide-react";
import CitizenShell from "@/components/citizen/CitizenShell";
import FloodHeader from "@/components/flood-relief/FloodHeader";
import { TypeIcon } from "@/components/flood-relief/icons";
import { CITIZEN_STATUS_CHIP, type PublicFloodRequest } from "@/components/flood-relief/types";
import { useFloodSummary } from "@/components/flood-relief/useFloodSummary";
import { LOCAL_TICKETS_KEY, parseLocalTickets, type LocalTicket } from "@/lib/flood-relief/localTickets";
import { DEFAULT_FLOOD_SETTINGS } from "@/lib/flood-relief/settings";
import { REQUEST_TYPE_META, isRequestType } from "@/lib/flood-relief/status";
import { parseTicket } from "@/lib/flood-relief/ticket";
import { thaiWhen } from "@/lib/flood-relief/time";

type Row = LocalTicket & { request: PublicFloodRequest | null };

export default function MyFloodRequestsPage() {
  const router = useRouter();
  const { summary } = useFloodSummary();
  const hotline = summary?.hotline ?? DEFAULT_FLOOD_SETTINGS.hotline;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState(false);

  useEffect(() => {
    let local: LocalTicket[] = [];
    try {
      local = parseLocalTickets(window.localStorage.getItem(LOCAL_TICKETS_KEY));
    } catch {
      /* โหมดส่วนตัว */
    }
    let alive = true;
    Promise.all(
      local.map(async (t) => {
        try {
          const res = await fetch(`/api/flood-relief/public/requests/${t.ticket}${t.key ? `?k=${encodeURIComponent(t.key)}` : ""}`);
          const json = res.ok ? await res.json() : null;
          return { ...t, request: json?.request ?? null };
        } catch {
          return { ...t, request: null };
        }
      })
    ).then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, []);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const t = parseTicket(input);
    if (!t) {
      setInputError(true);
      return;
    }
    router.push(`/flood/status/${t.ticket}`);
  };

  return (
    <>
      <Head>
        <title>ติดตามคำขอของฉัน · ศูนย์ช่วยเหลือน้ำท่วม</title>
        <meta name="robots" content="noindex" />
      </Head>
      <CitizenShell hideNav>
        <FloodHeader title="ติดตามคำขอของฉัน" hotline={hotline} />

        <form onSubmit={go} className="mx-4 mt-4 flex gap-2">
          <label htmlFor="flood-ticket-input" className="sr-only">
            เลขที่คำขอ
          </label>
          <input
            id="flood-ticket-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError(false);
            }}
            placeholder="กรอกเลขที่คำขอ เช่น FL-0142"
            autoCapitalize="characters"
            className="h-[46px] min-w-0 flex-1 rounded-[14px] border border-tk-line bg-white px-3.5 font-tk-mono text-[14px] focus:border-tk-flood focus:outline-none"
          />
          <button type="submit" className="h-[46px] shrink-0 rounded-[14px] bg-tk-flood px-4 text-[14px] font-bold text-white">
            ดูสถานะ
          </button>
        </form>
        {inputError && <p className="mx-4 mt-1.5 text-[12px] text-tk-overdue-ink">รูปแบบเลขที่ไม่ถูกต้อง (เช่น FL-0142)</p>}

        <h2 className="mx-4 mt-5 text-[14px] font-bold">คำขอที่ส่งจากเครื่องนี้</h2>
        <div className="mx-4 mb-8 mt-2.5 flex flex-col gap-2.5">
          {rows === null ? (
            <div className="h-[72px] animate-pulse rounded-2xl bg-white" />
          ) : rows.length === 0 ? (
            <div className="rounded-2xl bg-white p-5 text-center shadow-tk-md">
              <p className="text-[13px] text-tk-ink-4">ยังไม่มีคำขอจากเครื่องนี้</p>
              <Link
                href="/flood/request"
                className="mt-3 inline-flex h-11 items-center rounded-2xl bg-tk-emergency px-5 text-[14px] font-bold text-white"
              >
                ขอความช่วยเหลือ
              </Link>
            </div>
          ) : (
            rows.map((row) => {
              const r = row.request;
              const chip = r ? CITIZEN_STATUS_CHIP[r.status] ?? CITIZEN_STATUS_CHIP.received : null;
              return (
                <Link
                  key={row.ticket}
                  href={`/flood/status/${row.ticket}${row.key ? `?k=${encodeURIComponent(row.key)}` : ""}`}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-tk-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tk-flood-soft text-tk-flood">
                    <TypeIcon type={r?.type ?? "other"} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-tk-mono text-[12px] font-medium text-tk-ink-4">{row.ticket}</span>
                      {chip && <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${chip.cls}`}>{chip.label}</span>}
                    </div>
                    <div className="truncate text-[13.5px] font-bold">
                      {r && isRequestType(r.type) ? REQUEST_TYPE_META[r.type].label : r ? r.type : "โหลดสถานะไม่สำเร็จ"}
                    </div>
                    <div className="text-[11px] text-tk-ink-4">{thaiWhen(r?.createdAt ?? row.at)}</div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-tk-ink-6" aria-hidden />
                </Link>
              );
            })
          )}
        </div>
      </CitizenShell>
    </>
  );
}
