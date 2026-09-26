// components/flood-relief/admin/RequestDetail.tsx — แผงขวา: รายละเอียดคำขอที่เลือก + มอบหมายทีม + อัปเดตสถานะ + บันทึกภายใน
// ทุกการเขียนผ่าน PATCH /api/flood-relief/requests/[id] (จุดเดียว) · derived fields มาจาก server
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Swal from "sweetalert2";
import { Check, Copy, LoaderCircle, Navigation, Phone, X } from "lucide-react";
import { formatCoords, googleMapsDirUrl } from "@/lib/flood-relief/geo";
import { REQUEST_TYPE_META, STATUS_FLOW, STATUS_META, isRequestType, isStatus, URGENCY_META, type Urgency } from "@/lib/flood-relief/status";
import { hhmm, URGENCY_BADGE, ZONE_BADGE } from "./labels";
import type { AdminRequestDetail, AdminTeam, Me } from "./types";

const STEP_LABEL: Record<string, string> = {
  received: "รับเรื่อง",
  assigning: "กำลังจัดทีม",
  dispatched: "ออกเดินทาง",
  on_site: "ทีมถึงจุด",
  done: "เสร็จสิ้น",
};

async function patch(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/flood-relief/requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || "บันทึกไม่สำเร็จ");
  return j.request as AdminRequestDetail;
}

export default function RequestDetail({
  id,
  me,
  onClose,
  onChanged,
}: {
  id: string;
  me: Me | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [d, setD] = useState<AdminRequestDetail | null>(null);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [teamId, setTeamId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/flood-relief/requests/${id}`);
    const j = await res.json().catch(() => null);
    if (res.ok && j?.request) {
      setD(j.request);
      setError(null);
    } else setError(j?.error || "โหลดรายละเอียดไม่สำเร็จ");
  }, [id]);

  useEffect(() => {
    setD(null);
    setTeamId("");
    load();
  }, [load]);

  // ทีม + ระยะห่างถึงจุดนี้ (server คำนวณ)
  useEffect(() => {
    if (d?.lat == null || d.lng == null) return;
    fetch(`/api/flood-relief/teams?lat=${d.lat}&lng=${d.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTeams(j.teams ?? []))
      .catch(() => {});
  }, [d?.id, d?.lat, d?.lng]);

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      setD(await patch(id, body));
      onChanged();
      return true;
    } catch (e) {
      Swal.fire({ icon: "error", title: "ทำรายการไม่สำเร็จ", text: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toStatus = async (to: string, backward: boolean) => {
    let reason: string | undefined;
    if (backward || to === "cancelled") {
      const r = await Swal.fire({
        title: to === "cancelled" ? "ยกเลิกคำขอนี้?" : `ย้อนสถานะเป็น "${STEP_LABEL[to] ?? to}"?`,
        input: "text",
        inputLabel: "เหตุผล",
        inputPlaceholder: to === "cancelled" ? "เช่น ติดต่อไม่ได้ / คำขอซ้ำ" : "เช่น กดผิด",
        showCancelButton: true,
        confirmButtonText: "ยืนยัน",
        cancelButtonText: "ไม่",
        inputValidator: (v) => (!backward || v.trim() ? null : "กรุณาระบุเหตุผล"),
      });
      if (!r.isConfirmed) return;
      reason = String(r.value ?? "");
    }
    await run({ action: "status", to, reason });
  };

  if (error && !d) return <p className="p-6 text-center text-[13px] text-tk-overdue-ink">{error}</p>;
  if (!d) {
    return (
      <div className="flex justify-center py-16 text-tk-flood">
        <LoaderCircle className="animate-spin" aria-label="กำลังโหลด" />
      </div>
    );
  }

  const closed = d.status === "done" || d.status === "cancelled";
  const curIdx = STATUS_FLOW.indexOf(d.status as (typeof STATUS_FLOW)[number]);
  const point = d.lat != null && d.lng != null ? { lat: d.lat, lng: d.lng } : null;
  const initials = (d.reporterName || "?").trim().slice(0, 1);
  const assignedTeam = teams.find((t) => t.id === d.assignedTeamId);

  return (
    <div className="flex min-h-full flex-col text-tk-ink">
      {/* หัว (sticky) */}
      <div className="sticky top-0 z-[1] border-b border-tk-line bg-white px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <span className="font-tk-mono text-[12px] font-medium text-tk-ink-4">{d.ticket}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${URGENCY_BADGE[d.urgency] ?? ""}`}>
            {URGENCY_META[d.urgency as Urgency]?.label ?? d.urgency}
          </span>
          {d.zoneLabel && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ZONE_BADGE[d.zoneLevel ?? ""] ?? ZONE_BADGE.safe}`}>
              {d.zoneLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-tk-unclaimed-soft text-tk-ink-3"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <h2 className="mt-2 text-[18px] font-bold">{isRequestType(d.type) ? REQUEST_TYPE_META[d.type].label : d.type}</h2>
        <p className="mt-0.5 text-[12px] text-tk-ink-4">
          รับเรื่อง {hhmm(d.createdAt)} น. · ผ่าน{d.source === "web" ? "ฟอร์มหน้าเว็บ" : d.source === "line" ? " LINE" : "โทรศัพท์"} · รอมาแล้ว{" "}
          <b className={d.urgency === "critical" && !closed ? "text-tk-overdue-ink" : "text-tk-ink-strong"}>
            {d.waitingMinutes} นาที
          </b>
          {d.isOverdue && <b className="text-tk-overdue-ink"> · เลยเวลา</b>}
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {/* ตำแหน่ง */}
        <section className="rounded-2xl border border-tk-line p-3.5">
          <div className="text-[13px] font-semibold">
            {[d.landmark, d.communityName ? `ชุมชน${d.communityName}` : "ไม่ทราบชุมชน"].filter(Boolean).join(" · ")}
          </div>
          {point && (
            <div className="mt-1 font-tk-mono text-[11px] text-tk-ink-4">
              {formatCoords(point)}
              {d.accuracyM != null ? ` · ±${d.accuracyM} ม.` : " · ปักหมุดเอง"}
            </div>
          )}
          {point && (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <a
                href={googleMapsDirUrl(point)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-tk-flood text-[12.5px] font-bold text-white"
              >
                <Navigation size={14} aria-hidden />
                นำทาง Google Maps
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(`${point.lat},${point.lng}`)}
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-tk-unclaimed-soft text-[12.5px] font-semibold text-tk-ink-2"
              >
                <Copy size={14} aria-hidden />
                คัดลอกพิกัด
              </button>
            </div>
          )}
        </section>

        {/* ผู้แจ้ง */}
        <section className="flex items-center gap-3 rounded-2xl bg-tk-bg p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tk-flood-soft text-[15px] font-bold text-tk-flood">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold">
              {d.reporterName || "ไม่ระบุชื่อ"}
              {d.peopleCount != null && <span className="font-normal text-tk-ink-4"> · {d.peopleCount} คนในบ้าน</span>}
            </div>
            <div className="font-tk-mono text-[12px] text-tk-ink-3">{d.phone}</div>
          </div>
          <a
            href={`tel:${d.phone}`}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-tk-done px-3.5 text-[13px] font-bold text-white"
          >
            <Phone size={14} aria-hidden />
            โทร
          </a>
        </section>

        {(d.detail || d.images.length > 0) && (
          <section>
            <h3 className="text-[12px] font-bold text-tk-ink-4">รายละเอียดจากผู้แจ้ง</h3>
            {d.detail && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-normal">{d.detail}</p>}
            {d.images.length > 0 && (
              <div className="mt-2 flex gap-2">
                {d.images.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="relative h-12 w-16 overflow-hidden rounded-lg">
                    <Image src={u} alt="รูปจากผู้แจ้ง" fill sizes="64px" className="object-cover" />
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {/* มอบหมายทีม */}
        {!closed && (
          <section className="rounded-2xl border-[1.5px] border-tk-flood bg-tk-flood-tint p-3.5">
            <h3 className="text-[13px] font-bold text-tk-flood-dark">
              มอบหมายทีม{assignedTeam ? ` · ปัจจุบัน: ${assignedTeam.name}` : ""}
            </h3>
            {teams.length === 0 ? (
              <p className="mt-1.5 text-[12px] text-tk-ink-4">ยังไม่มีทีมในระบบ — เพิ่มทีมได้ในขั้นถัดไป (ทีม/ศูนย์พักพิง)</p>
            ) : (
              <div className="mt-2 flex gap-2">
                <label htmlFor="flood-team" className="sr-only">
                  เลือกทีม
                </label>
                <select
                  id="flood-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-tk-flood-line bg-white px-2 text-[12.5px]"
                >
                  <option value="">เลือกทีม…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.equipment ? ` · ${t.equipment}` : ""}
                      {t.distanceKm != null ? ` · ${t.distanceKm} กม.` : ""}
                      {t.status === "busy" ? " · ติดงาน" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!teamId || busy}
                  onClick={async () => {
                    if (await run({ action: "assign", teamId })) setTeamId("");
                  }}
                  className="h-10 shrink-0 rounded-xl bg-tk-flood px-4 text-[13px] font-bold text-white disabled:opacity-50"
                >
                  มอบหมาย
                </button>
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-tk-ink-4">ทีมจะได้รับแจ้งทาง LINE พร้อมพิกัดและเบอร์ผู้แจ้ง</p>
          </section>
        )}

        {/* อัปเดตสถานะ */}
        <section>
          <h3 className="text-[12px] font-bold text-tk-ink-4">อัปเดตสถานะ</h3>
          {d.status === "cancelled" ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-tk-unclaimed-soft px-3 py-2.5 text-[12.5px]">
              <span className="font-semibold text-tk-ink-3">{STATUS_META.cancelled.label}</span>
              {me?.canRewind && (
                <button type="button" disabled={busy} onClick={() => toStatus("received", true)} className="font-bold text-tk-flood">
                  เปิดคำขอกลับมา
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-5 gap-1">
                {STATUS_FLOW.map((s, i) => {
                  const done = i < curIdx || (i === curIdx && s === "done");
                  const current = i === curIdx && s !== "done";
                  const next = i === curIdx + 1;
                  const back = i < curIdx && !!me?.canRewind;
                  const clickable = !busy && (next || back);
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!clickable}
                      onClick={() => toStatus(s, i < curIdx)}
                      title={next ? "กดเพื่อเลื่อนไปขั้นนี้" : back ? "ย้อนสถานะ (ต้องระบุเหตุผล)" : undefined}
                      className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border-[1.5px] px-1 text-center text-[11px] font-bold leading-tight ${
                        done
                          ? "border-tk-done bg-tk-done-soft text-tk-done-ink"
                          : current
                            ? "border-tk-due bg-tk-due-soft text-tk-due-ink"
                            : next
                              ? "border-dashed border-tk-flood bg-white text-tk-flood hover:bg-tk-flood-soft"
                              : "border-tk-line bg-white text-tk-ink-6"
                      } ${back ? "cursor-pointer" : ""}`}
                    >
                      {done ? <Check size={14} strokeWidth={3} aria-hidden /> : <span className="h-3.5" />}
                      {STEP_LABEL[s]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-tk-ink-4">
                <span>{me?.canRewind ? "กดขั้นถัดไปเพื่อเลื่อน · กดขั้นก่อนหน้าเพื่อย้อน" : "กดขั้นถัดไปเพื่อเลื่อน · ย้อนได้เฉพาะหัวหน้ากอง"}</span>
                {!closed && (
                  <button type="button" disabled={busy} onClick={() => toStatus("cancelled", false)} className="font-semibold text-tk-overdue-ink">
                    ยกเลิกคำขอ
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* บันทึกภายใน */}
        <section>
          <h3 className="text-[12px] font-bold text-tk-ink-4">บันทึกภายใน (ผู้แจ้งไม่เห็น)</h3>
          <div className="mt-1.5 flex gap-2">
            <label htmlFor="flood-note" className="sr-only">
              บันทึกภายใน
            </label>
            <input
              id="flood-note"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && note.trim() && !busy && (await run({ action: "note", text: note }))) setNote("");
              }}
              placeholder="เช่น โทรแล้ว ไม่มีคนรับ"
              className="h-9 min-w-0 flex-1 rounded-xl border border-tk-line px-3 text-[12.5px] focus:border-tk-flood focus:outline-none"
            />
            <button
              type="button"
              disabled={!note.trim() || busy}
              onClick={async () => {
                if (await run({ action: "note", text: note })) setNote("");
              }}
              className="h-9 shrink-0 rounded-xl bg-tk-unclaimed-soft px-3 text-[12.5px] font-bold text-tk-ink-2 disabled:opacity-50"
            >
              บันทึก
            </button>
          </div>
          {d.notes.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {[...d.notes].reverse().map((n, i) => (
                <li key={i} className="rounded-xl bg-tk-bg px-3 py-2 text-[12.5px]">
                  {n.text}
                  <div className="mt-0.5 text-[10.5px] text-tk-ink-4">
                    {n.by} · <span className="font-tk-mono">{hhmm(n.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ไทม์ไลน์ */}
        <section className="pb-4">
          <h3 className="text-[12px] font-bold text-tk-ink-4">ไทม์ไลน์</h3>
          <ol className="mt-1.5 flex flex-col gap-1">
            {[...d.timeline].reverse().map((t, i) => (
              <li key={i} className="flex gap-2.5 text-[12px]">
                <span className="w-11 shrink-0 font-tk-mono text-tk-ink-4">{hhmm(t.at)}</span>
                <span>
                  {t.event}
                  {t.by && <span className="text-tk-ink-4"> · {t.by}</span>}
                </span>
              </li>
            ))}
          </ol>
          {d.lineLinked && <p className="mt-2 text-[11px] text-tk-done-ink">ผู้แจ้งเชื่อม LINE ไว้ — ได้รับแจ้งเมื่อทีมออกเดินทาง/ถึงจุด/เสร็จสิ้น</p>}
          {!isStatus(d.status) && <p className="mt-2 text-[11px] text-tk-overdue-ink">สถานะไม่รู้จัก: {d.status}</p>}
        </section>
      </div>
    </div>
  );
}
