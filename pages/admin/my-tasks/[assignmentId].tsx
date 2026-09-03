// pages/admin/my-tasks/[assignmentId].tsx
// หน้าจอ 3 "รายละเอียดงาน + อัปเดตความคืบหน้า" (README) — จุดเดียวที่เจ้าหน้าที่อ่านเรื่อง ดูไทม์ไลน์ บันทึกความคืบหน้า
// และจัดการการประสานงานภายนอก (แทน ComplaintDetailModal + UpdateAssignmentModal ที่แยกกัน)
// full-page ไม่มี sidebar (ADMIN_META: noSidebar + fullBleed) — header bar ← กลับ + breadcrumb อยู่ในหน้า
// ข้อมูลจาก GET /api/tasks/[assignmentId] · การกระทำ: PATCH เดียวกัน (progress/close/blocked), POST coordination, POST transfer
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import clsx from 'clsx';
import Swal from 'sweetalert2';
import { ArrowLeftIcon, ArrowPathIcon, CameraIcon, ChevronLeftIcon, ExclamationTriangleIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { uploadToCloudinary } from '@/utils/uploadToCloudinary';
import { stageTransition } from '@/lib/tasks/status';
import PermissionGuard from '@/components/PermissionGuard';
import ImageUploads from '@/components/ImageUploads';
import type { OfficerTask, Stage, TaskDetailResponse } from '@/lib/tasks/types';
import { formatThaiDate, relativeDaysLabel } from '@/lib/tasks/format';
import { STAGE_LABELS } from '@/lib/tasks/status';
import {
  AlertBadge,
  StatusStepper,
  CoordinationBlock,
  CoordinationSetModal,
  FollowUpModal,
  BlockedCard,
  TaskTimeline,
  CloseTaskModal,
  TransferTaskModal,
} from '@/components/tasks';
import type { OfficerOption, TransferPayload, TransferRequestPayload, FollowUpPayload, CoordinationSetPayload, BlockedPayload, ClosePayload } from '@/components/tasks';

const SmallMap = dynamic(() => import('@/components/SmallMap'), { ssr: false, loading: () => <div className="skeleton h-28 rounded-[11px]" /> });

const toast = (title: string, icon: 'success' | 'error' | 'info' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2600, timerProgressBar: true, showConfirmButton: false, icon, title });
const errorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && (err.response?.data?.error as string | undefined)) || fallback;

const CARD = 'rounded-[18px] bg-tk-surface shadow-tk-lg';

function Meta({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-tk-ink-6">{label}</div>
      <div className={clsx('mt-0.5 truncate text-[13.5px] font-semibold text-tk-ink', className)}>{children}</div>
    </div>
  );
}

function Skeletons() {
  return (
    <div className="grid grid-cols-1 gap-[18px] px-6 py-[22px] xl:grid-cols-[minmax(0,1fr)_430px]" aria-busy>
      <div className="flex flex-col gap-4">
        <div className="skeleton h-[220px] rounded-[18px]" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-[150px] rounded-[18px]" />
          <div className="skeleton h-[150px] rounded-[18px]" />
        </div>
        <div className="skeleton h-[260px] rounded-[18px]" />
      </div>
      <div className="skeleton h-[560px] rounded-[18px]" />
    </div>
  );
}

function TaskDetailContent() {
  const router = useRouter();
  const { user } = useUser();
  const id = typeof router.query.assignmentId === 'string' ? router.query.assignmentId : '';

  const [data, setData] = useState<TaskDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // ร่างบันทึกความคืบหน้า
  const [note, setNote] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraRef = React.useRef<HTMLInputElement>(null);

  // modals
  const [coordSetOpen, setCoordSetOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'transfer' | 'request'>('transfer');
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [officersLoading, setOfficersLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const { data: res } = await axios.get<TaskDetailResponse>(`/api/tasks/${id}`);
      setData(res);
    } catch (err) {
      setError(errorMessage(err, 'โหลดรายละเอียดงานไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!user || !router.isReady) return;
    load();
  }, [user, router.isReady, load]);

  const run = async (key: string, fn: () => Promise<void>, fallback: string) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (err) {
      Swal.fire({ icon: 'error', title: fallback, text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setBusy(null);
    }
  };

  const editable = !!data && data.canEdit && !data.derived.isCompleted;

  /* ── บันทึกความคืบหน้า ── */
  const saveProgress = () =>
    run('progress', async () => {
      if (!note.trim() && images.length === 0) {
        toast('พิมพ์บันทึกหรือแนบภาพก่อน', 'info');
        return;
      }
      await axios.patch(`/api/tasks/${id}`, { action: 'progress', note: note.trim(), images });
      setNote('');
      setImages([]);
      setUploaderKey((k) => k + 1);
      toast('บันทึกความคืบหน้าแล้ว');
    }, 'บันทึกไม่สำเร็จ');

  /* ── stepper ── */
  const changeStage = async (next: Stage, info: { direction: 'forward' | 'backward'; needsReason: boolean }) => {
    if (next === 'closed') {
      setCloseOpen(true);
      return;
    }
    let reason = '';
    if (info.needsReason) {
      const { value, isConfirmed } = await Swal.fire({
        title: `ถอยกลับไปขั้น "${STAGE_LABELS[next]}"`,
        input: 'textarea',
        inputLabel: 'เหตุผล (บันทึกลงไทม์ไลน์)',
        inputPlaceholder: 'เช่น ต้องลงพื้นที่ซ้ำ เพราะจุดที่แจ้งไม่ตรงกับพิกัด',
        inputValidator: (v) => (String(v ?? '').trim() ? null : 'กรุณาระบุเหตุผล'),
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#7C3AED',
      });
      if (!isConfirmed) return;
      reason = String(value ?? '').trim();
    }
    await run('stage', async () => {
      await axios.patch(`/api/tasks/${id}`, { action: 'progress', stage: next, reason });
      toast(`เลื่อนขั้นเป็น "${STAGE_LABELS[next]}" แล้ว`);
    }, 'เปลี่ยนขั้นไม่สำเร็จ');
  };

  /* ── ปิดเรื่อง ── */
  const closeTask = (payload: ClosePayload) =>
    run('close', async () => {
      await axios.patch(`/api/tasks/${id}`, { action: 'close', ...payload });
      setCloseOpen(false);
      await Swal.fire({ icon: 'success', title: 'ปิดเรื่องเรียบร้อย', text: 'ระบบแจ้งผู้แจ้งและกลุ่มเจ้าหน้าที่แล้ว', timer: 1800, showConfirmButton: false });
      router.push('/admin/my-tasks');
    }, 'ปิดเรื่องไม่สำเร็จ');

  /* ── รอวัสดุ ── */
  const toggleBlocked = (payload: BlockedPayload) =>
    run('blocked', async () => {
      await axios.patch(`/api/tasks/${id}`, { action: 'blocked', ...payload });
      toast(payload.on ? 'พักงานแล้ว — หยุดนับ SLA' : 'กลับมาดำเนินการต่อแล้ว');
    }, 'บันทึกไม่สำเร็จ');

  /* ── ประสานงาน ── */
  const setCoordination = (payload: CoordinationSetPayload) =>
    run('coord-set', async () => {
      await axios.post('/api/complaints/coordination', { action: 'set', assignmentId: id, ...payload, sentAt: payload.sentAt || undefined, nextFollowUpAt: payload.nextFollowUpAt || undefined });
      setCoordSetOpen(false);
      toast('บันทึกการประสานงานแล้ว');
    }, 'บันทึกไม่สำเร็จ');

  const logFollowUp = (payload: FollowUpPayload) =>
    run('follow-up', async () => {
      await axios.post('/api/complaints/coordination', { action: 'follow_up', assignmentId: id, channel: payload.channel, note: payload.note, nextFollowUpAt: payload.nextFollowUpAt || undefined });
      setFollowUpOpen(false);
      toast('บันทึกการติดตามแล้ว');
    }, 'บันทึกไม่สำเร็จ');

  const called = () =>
    run('called', async () => {
      await axios.post('/api/complaints/coordination', { action: 'follow_up', assignmentId: id, channel: 'phone', note: 'โทรติดตามแล้ว' });
      toast('บันทึก "โทรแล้ว" ลงไทม์ไลน์');
    }, 'บันทึกไม่สำเร็จ');

  const notifyLine = async () => {
    if (!data?.assignment.coordination) return;
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'แจ้ง LINE กลุ่มเจ้าหน้าที่?',
      html: `ส่งสรุปการประสาน <b>${data.assignment.coordination.agencyName}</b><br/><span class="text-sm opacity-70">ข้อความนี้นับโควตา LINE ตามจำนวนสมาชิกในกลุ่ม</span>`,
      showCancelButton: true,
      confirmButtonText: 'ส่งเลย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0E7C86',
    });
    if (!isConfirmed) return;
    await run('line', async () => {
      await axios.post('/api/complaints/coordination', { action: 'notify_line', assignmentId: id });
      toast('แจ้ง LINE กลุ่มแล้ว');
    }, 'ส่ง LINE ไม่สำเร็จ');
  };

  /* ── โอนงาน (หัวหน้า/superadmin) · ขอโอน (เจ้าของงาน) ── */
  const openTransfer = async (mode: 'transfer' | 'request') => {
    setTransferMode(mode);
    setTransferOpen(true);
    if (mode === 'request' || officers.length) return;
    setOfficersLoading(true);
    try {
      const { data: list } = await axios.get<OfficerOption[]>('/api/users/get-all-user');
      setOfficers(Array.isArray(list) ? list : []);
    } catch (err) {
      toast(errorMessage(err, 'โหลดรายชื่อเจ้าหน้าที่ไม่สำเร็จ'), 'error');
    } finally {
      setOfficersLoading(false);
    }
  };
  const submitTransfer = (payload: TransferPayload) =>
    run('transfer', async () => {
      const { data: res } = await axios.post('/api/complaints/assignments/transfer', payload);
      setTransferOpen(false);
      await Swal.fire({ icon: 'success', title: `โอนงานให้ ${res?.assignment?.toUserName || 'เจ้าหน้าที่'} แล้ว`, timer: 1600, showConfirmButton: false });
      router.push('/admin/my-tasks');
    }, 'โอนงานไม่สำเร็จ');

  const submitTransferRequest = (payload: TransferRequestPayload) =>
    run('transfer-request', async () => {
      const { data: res } = await axios.post('/api/complaints/assignments/transfer-request', payload);
      setTransferOpen(false);
      toast(`ส่งคำขอโอนแล้ว — แจ้งหัวหน้ากอง ${res?.notified ?? 0} คน`);
    }, 'ส่งคำขอไม่สำเร็จ');

  const cancelTransferRequest = (decline: boolean) =>
    run('transfer-request', async () => {
      await axios.delete('/api/complaints/assignments/transfer-request', { params: { assignmentId: id } });
      toast(decline ? 'ปฏิเสธคำขอโอนแล้ว' : 'ยกเลิกคำขอโอนแล้ว');
    }, 'ดำเนินการไม่สำเร็จ');

  /* ── มือถือ: ถ่ายภาพ (input capture) → Cloudinary → แนบกับบันทึก ── */
  const onCameraFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraBusy(true);
    try {
      const url: string | undefined = await uploadToCloudinary(file);
      if (url) setImages((list) => (list.length >= 3 ? [...list.slice(1), url] : [...list, url]));
      else toast('อัปโหลดภาพไม่สำเร็จ', 'error');
    } catch {
      toast('อัปโหลดภาพไม่สำเร็จ', 'error');
    } finally {
      setCameraBusy(false);
    }
  };

  const c = data?.complaint;
  const a = data?.assignment;
  const d = data?.derived;
  // ปุ่มสถานะเร็วบนมือถือ (README มือถือ 3) — ใช้กฎเดียวกับ stepper
  const quickStage = (next: Stage) => {
    if (!a) return;
    const t = stageTransition(a.stage, next) as { ok: boolean; direction: string; needsReason: boolean; reason?: string };
    if (!t.ok) {
      toast(t.reason ?? 'เปลี่ยนขั้นไม่ได้', 'info');
      return;
    }
    changeStage(next, { direction: t.direction as 'forward' | 'backward', needsReason: t.needsReason });
  };
  const transferTasks = data ? ([{ _id: data.assignment._id, code: data.complaint.code, title: data.complaint.title } as unknown as OfficerTask]) : [];

  return (
    <div className={clsx('h-full overflow-auto bg-tk-bg font-tk-sans text-tk-ink', editable && 'pb-24 md:pb-0')}>
      {/* header bar 56px — มือถือ: chevron + รหัส + pill */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-tk-line bg-tk-surface px-3.5 md:gap-4 md:px-6">
        <Link href="/admin/my-tasks" className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-semibold text-tk-primary whitespace-nowrap hover:underline" aria-label="กลับไปกลุ่มงานของฉัน">
          <ChevronLeftIcon className="h-6 w-6 md:hidden" strokeWidth={2.2} />
          <ArrowLeftIcon className="hidden h-4 w-4 md:block" strokeWidth={2.2} />
          <span className="hidden md:inline">กลับไปกลุ่มงานของฉัน</span>
        </Link>
        {c && (
          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <span className="font-tk-mono text-[13px] text-tk-ink-3">{c.code ?? c._id.slice(-8)}</span>
            {data && <AlertBadge tone={data.statusPill.tone} size="sm" className="ml-auto">{data.statusPill.label}</AlertBadge>}
          </div>
        )}
        {c && (
          <nav className="hidden min-w-0 items-center gap-2 text-[12.5px] text-tk-ink-5 whitespace-nowrap md:flex" aria-label="breadcrumb">
            <span>งานของฉัน</span>
            <span aria-hidden>/</span>
            <span className="truncate">{c.category || 'ไม่ระบุประเภท'}</span>
            <span aria-hidden>/</span>
            <span className="font-tk-mono text-tk-ink-3">{c.code ?? c._id.slice(-8)}</span>
          </nav>
        )}
        {data && !editable && (
          <span className="ml-auto hidden rounded-full bg-tk-line-light px-3 py-1 text-[11.5px] font-semibold text-tk-ink-4 whitespace-nowrap md:inline">
            {data.derived.isCompleted ? 'เรื่องนี้ปิดแล้ว — อ่านอย่างเดียว' : 'ดูอย่างเดียว — ไม่ใช่งานของคุณ'}
          </span>
        )}
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 rounded-[14px] border border-tk-line bg-tk-line-light px-4 py-3 text-[13px] text-tk-ink-3">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-tk-ink-5" strokeWidth={1.8} />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => { setLoading(true); load(); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-tk-surface px-3 py-1.5 text-[12.5px] font-semibold text-tk-primary shadow-tk-xs hover:bg-tk-primary-tint">
            <ArrowPathIcon className="h-4 w-4" strokeWidth={2} />
            ลองใหม่
          </button>
        </div>
      )}

      {loading ? (
        <Skeletons />
      ) : data && c && a && d ? (
        <div className="grid grid-cols-1 gap-3.5 px-3.5 py-3.5 md:gap-[18px] md:px-6 md:py-[22px] xl:grid-cols-[minmax(0,1fr)_430px]">
          {/* ───── ซ้าย ───── */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* a) header card */}
            <section className={clsx(CARD, 'px-4 py-4 md:px-[22px] md:py-5')}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-[16.5px] font-bold leading-tight md:text-[21px]">{c.title}</h1>
                    <AlertBadge tone={data.statusPill.tone} size="pill">{data.statusPill.label}</AlertBadge>
                  </div>
                  {data.badges.length > 0 && (
                    <div className="mt-[11px] flex flex-wrap gap-2">
                      {data.badges.map((b) => (
                        <AlertBadge key={`${b.kind}-${b.label}`} tone={b.tone} size="md">{b.label}</AlertBadge>
                      ))}
                      {c.isConfidential && <AlertBadge tone="unclaimed" size="md">เรื่องลับ</AlertBadge>}
                    </div>
                  )}
                </div>
                <div className="w-full shrink-0 border-t border-tk-line-light pt-3 md:w-auto md:border-0 md:pt-0 md:text-right">
                  <div className="text-[11.5px] text-tk-ink-6">ผู้รับผิดชอบ</div>
                  <div className="text-[13.5px] font-semibold">{a.assignee ? [a.assignee.name, a.assignee.department].filter(Boolean).join(' · ') : '—'}</div>
                  {a.role === 'coordinator' && <div className="text-[11.5px] text-tk-coord-ink">รับเป็นผู้ประสานงาน</div>}
                  {!data.derived.isCompleted && data.canTransfer && (
                    <button type="button" onClick={() => openTransfer('transfer')} className="mt-1 text-[12px] font-semibold text-tk-primary hover:underline">โอนงาน</button>
                  )}
                  {!data.derived.isCompleted && !data.canTransfer && data.canRequestTransfer && !data.transferRequest && (
                    <button type="button" onClick={() => openTransfer('request')} className="mt-1 text-[12px] font-semibold text-tk-primary hover:underline">ขอโอนงาน</button>
                  )}
                </div>
              </div>

              {data.transferRequest && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-tk-due bg-tk-due-soft px-4 py-3 text-[12.5px]">
                  <div className="w-full min-w-0 md:w-auto md:flex-1">
                    <div className="font-bold text-tk-due-ink">ขอโอนงาน — {data.transferRequest.byName || 'เจ้าของงาน'} · {formatThaiDate(data.transferRequest.requestedAt)}</div>
                    <div className="text-tk-ink-2">เหตุผล: {data.transferRequest.reason}</div>
                  </div>
                  {data.canTransfer && (
                    <>
                      <button type="button" disabled={!!busy} onClick={() => openTransfer('transfer')} className="rounded-[9px] bg-tk-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-tk-primary-dark disabled:opacity-60">โอนให้คนอื่น</button>
                      <button type="button" disabled={!!busy} onClick={() => cancelTransferRequest(true)} className="rounded-[9px] bg-tk-surface px-3 py-1.5 text-[12px] font-semibold text-tk-ink-4 hover:bg-tk-line-light disabled:opacity-60">ปฏิเสธ</button>
                    </>
                  )}
                  {!data.canTransfer && data.canEdit && (
                    <button type="button" disabled={!!busy} onClick={() => cancelTransferRequest(false)} className="rounded-[9px] bg-tk-surface px-3 py-1.5 text-[12px] font-semibold text-tk-ink-4 hover:bg-tk-line-light disabled:opacity-60">ยกเลิกคำขอ</button>
                  )}
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-tk-line-light pt-[18px] md:grid-cols-4">
                <Meta label="ผู้แจ้ง">{c.reporterName || '—'}</Meta>
                <Meta label="โทรศัพท์" className="font-tk-mono font-medium">
                  {c.reporterPhone ? (
                    <a href={`tel:${c.reporterPhone}`} className="inline-flex items-center gap-1 text-tk-primary hover:underline">
                      <PhoneIcon className="h-3.5 w-3.5" strokeWidth={2} />
                      {c.reporterPhone}
                    </a>
                  ) : '—'}
                </Meta>
                <Meta label="ชุมชน">{c.community || '—'}</Meta>
                <Meta label="ประเภท">{c.category || '—'}</Meta>
                <Meta label="วันที่แจ้ง">{formatThaiDate(c.createdAt) || '—'}</Meta>
                <Meta label="ครบกำหนด" className={clsx(d.isOverdue && 'text-tk-overdue-ink')}>
                  {formatThaiDate(a.dueDate) || '—'}
                  {d.isOverdue && ` (เกิน ${d.overdueDays} วัน)`}
                  {d.isPaused && ' · พัก SLA'}
                </Meta>
                <Meta label="กองที่รับผิดชอบ">{c.department || 'ยังไม่ระบุกอง'}</Meta>
                <Meta label="อัปเดตล่าสุด">{relativeDaysLabel(d.daysSinceUpdate)}</Meta>
              </div>

              <div className="mt-4">
                <div className="text-[11.5px] text-tk-ink-6">รายละเอียดจากผู้แจ้ง</div>
                <p className="mt-1 whitespace-pre-line text-[14px] leading-[1.65] text-tk-ink-2 [text-wrap:pretty]">{c.detail || '—'}</p>
                {c.problems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.problems.map((p) => (
                      <AlertBadge key={p} tone="neutral" size="sm">{p}</AlertBadge>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* b) ภาพ + แผนที่ */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section className={clsx(CARD, 'px-[18px] py-4')}>
                <h2 className="text-[13.5px] font-bold">ภาพจากผู้แจ้ง {c.images.length > 0 && <span className="font-medium text-tk-ink-5">{c.images.length} ภาพ</span>}</h2>
                {c.images.length === 0 ? (
                  <p className="mt-3 text-[12.5px] text-tk-ink-5">ไม่มีภาพประกอบ</p>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {c.images.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer" className="relative block h-24 overflow-hidden rounded-[11px] border border-tk-line">
                        <Image src={src} alt="" fill sizes="200px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </section>
              <section className={clsx(CARD, 'px-[18px] py-4')}>
                <h2 className="text-[13.5px] font-bold">
                  ตำแหน่งที่แจ้ง{' '}
                  {c.location && <span className="font-tk-mono text-[11px] font-medium text-tk-ink-5">{c.location.lat.toFixed(4)}, {c.location.lng.toFixed(4)}</span>}
                </h2>
                <div className="mt-3 overflow-hidden rounded-[11px]">
                  <SmallMap location={c.location} height="112px" />
                </div>
              </section>
            </div>

            {/* c) ไทม์ไลน์ */}
            <section className={clsx(CARD, 'px-[22px] py-[18px]')}>
              <h2 className="mb-4 text-[14.5px] font-bold">ไทม์ไลน์การดำเนินงาน</h2>
              <TaskTimeline entries={data.timeline} />
            </section>
          </div>

          {/* ───── ขวา: อัปเดตความคืบหน้า ───── */}
          <aside className={clsx(CARD, 'flex h-fit flex-col xl:sticky xl:top-[74px]')}>
            <div className="border-b border-tk-line-light px-5 py-[18px]">
              <h2 className="text-[16px] font-bold">อัปเดตความคืบหน้า</h2>
              <p className="text-[12.5px] text-tk-ink-5">เปลี่ยนขั้นแล้วระบบแจ้งผู้แจ้งทาง LINE (ถ้าผูกไว้) · ปิดเรื่องแจ้งกลุ่มเจ้าหน้าที่ด้วย</p>
            </div>

            <div className="flex flex-col gap-4 px-4 py-4 md:px-5 md:py-[18px]">
              <StatusStepper stage={a.stage} onChange={changeStage} disabled={!editable || busy === 'stage'} />

              {/* มือถือ: อัปเดตสถานะเร็ว 2×2 (README มือถือ 3) */}
              {editable && (
                <div className="md:hidden">
                  <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">อัปเดตสถานะเร็ว</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={!!busy} onClick={() => quickStage('site_visit')} className="touch-feedback min-h-12 rounded-[13px] bg-tk-line-light py-3.5 text-[13.5px] font-semibold text-tk-ink-3 disabled:opacity-60">ลงพื้นที่แล้ว</button>
                    <button type="button" disabled={!!busy} onClick={() => (a.coordination ? quickStage('coordinating') : setCoordSetOpen(true))} className="touch-feedback min-h-12 rounded-[13px] bg-tk-coord-soft py-3.5 text-[13.5px] font-semibold text-tk-coord-ink disabled:opacity-60">รอหน่วยงานอื่น</button>
                    <button type="button" disabled={!!busy} onClick={() => document.getElementById('blocked-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="touch-feedback min-h-12 rounded-[13px] bg-tk-blocked-soft py-3.5 text-[13.5px] font-semibold text-tk-blocked-ink disabled:opacity-60">รอวัสดุ / งบ</button>
                    <button type="button" disabled={!!busy} onClick={() => setCloseOpen(true)} className="touch-feedback min-h-12 rounded-[13px] bg-tk-done-soft py-3.5 text-[13.5px] font-semibold text-tk-done-ink disabled:opacity-60">เสร็จแล้ว</button>
                  </div>
                </div>
              )}

              <CoordinationBlock
                coordination={a.coordination}
                waitDays={d.coordinationWaitDays}
                followUpDue={d.followUpDue}
                followUpEveryDays={data.settings.followUpEveryDays}
                coordinatorLabel={a.assignee ? [a.assignee.department, a.assignee.name].filter(Boolean).join(' / ') : undefined}
                busy={!!busy}
                onStart={editable ? () => setCoordSetOpen(true) : undefined}
                onLogFollowUp={editable ? () => setFollowUpOpen(true) : undefined}
                onCalled={editable ? called : undefined}
                onNotifyLine={editable ? notifyLine : undefined}
              />
              {a.coordination && editable && (
                <button type="button" onClick={() => setCoordSetOpen(true)} className="-mt-2 self-end text-[12px] font-semibold text-tk-coord-ink hover:underline">
                  แก้ข้อมูลการประสานงาน
                </button>
              )}

              <div id="blocked-card">
                <BlockedCard blocked={a.blocked} followUpEveryDays={data.settings.followUpEveryDays} disabled={!editable} submitting={busy === 'blocked'} onToggle={toggleBlocked} />
              </div>

              {editable && (
                <>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4" htmlFor="progress-note">บันทึกการดำเนินงานวันนี้</label>
                    <textarea
                      id="progress-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="min-h-[78px] w-full resize-y rounded-[12px] border border-tk-line bg-tk-surface px-3.5 py-3 text-[13px] text-tk-ink outline-none focus:border-tk-primary focus:ring-2 focus:ring-tk-primary/20"
                      placeholder="โทรติดตาม กฟภ. สาขาตาคลี คุณ… รับสายแจ้งว่าจะเข้าตัดกิ่งไม้วันที่…"
                    />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">แนบภาพผลการดำเนินงาน</span>
                    {/* มือถือ: ปุ่มถ่ายภาพ (กล้องหลัง) + thumbnail · เดสก์ท็อป: ImageUploads เดิม */}
                    <div className="flex items-center gap-2 md:hidden">
                      <button type="button" disabled={cameraBusy} onClick={() => cameraRef.current?.click()} className="touch-feedback inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[13px] bg-tk-primary-tint text-[13.5px] font-semibold text-tk-primary-dark disabled:opacity-60">
                        <CameraIcon className="h-5 w-5" strokeWidth={2} />
                        {cameraBusy ? 'กำลังอัปโหลด…' : 'ถ่ายภาพ'}
                      </button>
                      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onCameraFile} aria-label="ถ่ายภาพ" />
                      {images.map((src) => (
                        <span key={src} className="relative block h-[52px] w-[52px] overflow-hidden rounded-[12px] border border-tk-line">
                          <Image src={src} alt="" fill sizes="52px" className="object-cover" />
                        </span>
                      ))}
                    </div>
                    <div className="hidden md:block">
                      <ImageUploads key={uploaderKey} maxImages={3} initialImages={[]} onChange={(urls: string[]) => setImages(urls)} onUploadingChange={setUploading} />
                    </div>
                  </div>
                </>
              )}
              {!editable && a.solutionImages.length > 0 && (
                <div>
                  <span className="mb-1.5 block text-[12px] font-semibold text-tk-ink-4">ภาพผลการดำเนินงาน</span>
                  <div className="flex flex-wrap gap-1.5">
                    {a.solutionImages.map((src) => (
                      <a key={src} href={src} target="_blank" rel="noreferrer" className="relative block h-[74px] w-[74px] overflow-hidden rounded-[12px] border border-tk-line">
                        <Image src={src} alt="" fill sizes="74px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {editable && (
              // มือถือ: footer ปุ่มเดียวลอยล่าง (README มือถือ 3) · เดสก์ท็อป: 2 ปุ่มท้าย panel
              <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2.5 border-t border-tk-line-light bg-tk-surface px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)] md:static md:px-5 md:py-4">
                <button
                  type="button"
                  disabled={busy === 'progress' || uploading || cameraBusy}
                  onClick={saveProgress}
                  className="touch-feedback flex-1 rounded-[15px] bg-tk-primary py-[15px] text-[15px] font-semibold text-white shadow-tk-purple whitespace-nowrap transition hover:bg-tk-primary-dark disabled:cursor-not-allowed disabled:opacity-60 md:rounded-[12px] md:py-[13px] md:text-[14px]"
                >
                  {uploading || cameraBusy ? 'กำลังอัปโหลดภาพ…' : busy === 'progress' ? 'กำลังบันทึก…' : 'บันทึกความคืบหน้า'}
                </button>
                <button type="button" disabled={!!busy} onClick={() => setCloseOpen(true)} className="hidden rounded-[12px] bg-tk-done-soft px-[18px] py-[13px] text-[14px] font-semibold text-tk-done whitespace-nowrap transition hover:brightness-95 disabled:opacity-60 md:block">
                  ปิดเรื่อง
                </button>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      <CoordinationSetModal open={coordSetOpen} initial={a?.coordination ?? null} submitting={busy === 'coord-set'} onClose={() => setCoordSetOpen(false)} onSubmit={setCoordination} />
      <FollowUpModal
        open={followUpOpen}
        agencyName={a?.coordination?.agencyName ?? ''}
        tasks={data ? [{ _id: data.assignment._id, code: data.complaint.code, title: data.complaint.title }] : []}
        followUpEveryDays={data?.settings.followUpEveryDays ?? 7}
        submitting={busy === 'follow-up'}
        onClose={() => setFollowUpOpen(false)}
        onSubmit={logFollowUp}
      />
      <CloseTaskModal open={closeOpen} options={data?.solutionOptions ?? []} submitting={busy === 'close'} onClose={() => setCloseOpen(false)} onSubmit={closeTask} />
      <TransferTaskModal
        open={transferOpen}
        mode={transferMode}
        tasks={transferTasks}
        initialTaskId={data?.assignment._id ?? null}
        officers={officers}
        officersLoading={officersLoading}
        selfId={a?.assignee?.id ?? ''}
        submitting={busy === 'transfer' || busy === 'transfer-request'}
        onClose={() => setTransferOpen(false)}
        onSubmit={submitTransfer}
        onRequest={submitTransferRequest}
      />
    </div>
  );
}

export default function TaskDetailPage() {
  return (
    <PermissionGuard requiredPath="/admin/my-tasks">
      <TaskDetailContent />
    </PermissionGuard>
  );
}
