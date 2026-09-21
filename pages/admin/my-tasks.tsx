// pages/admin/my-tasks.tsx
// หน้าจอ 1 "งานของฉัน" — โฉมใหม่ตาม docs/design_handoff_officer_task_management/README.md (แทน KPI cards + flat list เดิม)
// ① header card เจ้าหน้าที่ · ② การ์ดเตือน 4 ใบ (คลิกกรอง ?alert=) · ③ KPI strip · ④ กลุ่มงานของฉัน (?groupBy=) + right rail
// ข้อมูลทั้งหมดมาจาก GET /api/tasks/my-kpi (derived แล้ว) — หน้านี้ regroup/สรุปฝั่ง client ด้วย lib/tasks/{groupBy,summary}.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import clsx from 'clsx';
import Swal from 'sweetalert2';
import { ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AlertCard, AlertKind, BlockedRailItem, CoordinationRailItem, DueThisWeekItem, GroupBy, MyKpiResponse, OfficerTask, TaskGroup } from '@/lib/tasks/types';
import { GROUP_BY, groupTasks, filterByAlert, SEVERITY_LABELS } from '@/lib/tasks/groupBy';
import { alertCards, coordinationRail, blockedRail, dueThisWeekRail } from '@/lib/tasks/summary';
import {
  OfficerHeaderCard,
  AlertCards,
  KpiStrip,
  WorkGroupAccordion,
  CoordinationRailCard,
  BlockedRailCard,
  DueThisWeekCard,
  TransferTaskModal,
  FollowUpModal,
  MobileTaskNav,
  QuickTaskSheet,
} from '@/components/tasks';
import type { OfficerOption, TransferPayload, TransferRequestPayload, FollowUpPayload } from '@/components/tasks';

const POOL_HREF = '/admin/task-pool';

const GROUP_LABELS: Record<GroupBy, string> = {
  category: 'ตามประเภทเรื่อง',
  organization: 'ตามกอง',
  priority: 'ตามความเร่งด่วน',
};
const ALERT_KINDS: AlertKind[] = ['overdue', 'due_soon', 'coordinating', 'blocked'];

const toast = (title: string, icon: 'success' | 'error' | 'info' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2600, timerProgressBar: true, showConfirmButton: false, icon, title });

const errorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && (err.response?.data?.error as string | undefined)) || fallback;

function Skeletons() {
  return (
    <div className="flex flex-col gap-[18px]" aria-busy>
      <div className="skeleton h-[96px] rounded-[20px]" />
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[76px] rounded-[14px]" />
        ))}
      </div>
      <div className="skeleton h-[64px] rounded-[14px]" />
      <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
        <div className="flex flex-col gap-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[140px] rounded-[18px]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MyTasksPage() {
  const router = useRouter();
  const { user } = useUser();

  const [data, setData] = useState<MyKpiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // สถานะโอนงาน / บันทึกติดตาม
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<'transfer' | 'request'>('transfer');
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [followUpFor, setFollowUpFor] = useState<CoordinationRailItem | null>(null);
  const [poolCount, setPoolCount] = useState<number | null>(null);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [busyAgency, setBusyAgency] = useState<string | null>(null);

  // URL เป็นแหล่งความจริงของ groupBy / alert (แชร์ลิงก์ได้, กด back ได้)
  const groupBy: GroupBy = (GROUP_BY as readonly string[]).includes(String(router.query.groupBy))
    ? (router.query.groupBy as GroupBy)
    : 'category';
  const alert: AlertKind | null = (ALERT_KINDS as string[]).includes(String(router.query.alert))
    ? (router.query.alert as AlertKind)
    : null;
  // scope=department: หัวหน้ากอง/superadmin เห็นงานทั้งกอง (API ตรวจสิทธิ์ซ้ำ)
  const scope: 'mine' | 'department' = router.query.scope === 'department' ? 'department' : 'mine';

  const setQuery = useCallback(
    (patch: Partial<Record<'groupBy' | 'alert' | 'scope' | 'quick', string | null>>) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries({ ...router.query, ...patch })) {
        if (typeof v === 'string' && v) next[k] = v;
      }
      router.replace({ pathname: router.pathname, query: next }, undefined, { shallow: true });
    },
    [router]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: res } = await axios.get<MyKpiResponse>('/api/tasks/my-kpi', { params: { scope } });
      setData(res);
    } catch (err) {
      setError(errorMessage(err, 'โหลดข้อมูลงานไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (!user || !router.isReady) return;
    load();
  }, [user, router.isReady, load]);

  // badge กองงานรอรับบน bottom nav มือถือ (ไม่ต้องรอ — พลาดก็แค่ไม่มีเลข)
  useEffect(() => {
    if (!user) return;
    axios.get<{ total: number }>('/api/tasks/pool-count').then((r) => setPoolCount(r.data.total ?? 0)).catch(() => setPoolCount(null));
  }, [user]);

  // FAB "อัปเดตงานด่วน" → ?quick=1 เปิด bottom sheet (ลิงก์จากหน้าอื่นได้)
  const quickOpen = router.query.quick === '1';

  const openTasks = useMemo<OfficerTask[]>(() => (data?.assignments ?? []).filter((a) => !a.isCompleted), [data]);
  const cards = useMemo(() => (data ? (alertCards(openTasks, data.settings) as AlertCard[]) : []), [openTasks, data]);
  const groups = useMemo(() => groupTasks(filterByAlert(openTasks, alert), groupBy) as TaskGroup[], [openTasks, alert, groupBy]);
  const coordination = useMemo(
    () => (data ? (coordinationRail(openTasks, { followUpEveryDays: data.settings.followUpEveryDays }) as CoordinationRailItem[]) : []),
    [openTasks, data]
  );
  const blocked = useMemo(() => blockedRail(openTasks) as BlockedRailItem[], [openTasks]);
  const dueThisWeek = useMemo(() => dueThisWeekRail(openTasks) as DueThisWeekItem[], [openTasks]);

  /* ── โอน / ส่งต่องาน (หัวหน้า/superadmin) หรือ ขอโอน (admin ธรรมดา) ── */
  const canTransfer = !!data?.permissions.canTransfer;
  const openTransfer = async () => {
    if (!openTasks.length) {
      toast('ยังไม่มีงานที่ถืออยู่ให้โอน', 'info');
      return;
    }
    setTransferMode(canTransfer ? 'transfer' : 'request');
    setTransferOpen(true);
    if (!canTransfer || officers.length) return;
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

  const submitTransfer = async (payload: TransferPayload) => {
    setTransferring(true);
    try {
      const { data: res } = await axios.post('/api/complaints/assignments/transfer', payload);
      setTransferOpen(false);
      toast(`โอนงานให้ ${res?.assignment?.toUserName || 'เจ้าหน้าที่'} แล้ว`);
      await load();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'โอนงานไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setTransferring(false);
    }
  };

  const submitTransferRequest = async (payload: TransferRequestPayload) => {
    setTransferring(true);
    try {
      const { data: res } = await axios.post('/api/complaints/assignments/transfer-request', payload);
      setTransferOpen(false);
      toast(`ส่งคำขอโอนแล้ว — แจ้งหัวหน้ากอง ${res?.notified ?? 0} คน`);
      await load();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ส่งคำขอไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setTransferring(false);
    }
  };

  /* ── บันทึกการติดตาม / แจ้ง LINE ── */
  const submitFollowUp = async (payload: FollowUpPayload) => {
    setFollowUpSaving(true);
    try {
      await axios.post('/api/complaints/coordination', {
        action: 'follow_up',
        assignmentId: payload.assignmentId,
        channel: payload.channel,
        note: payload.note,
        nextFollowUpAt: payload.nextFollowUpAt || undefined,
      });
      setFollowUpFor(null);
      toast('บันทึกการติดตามแล้ว');
      await load();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setFollowUpSaving(false);
    }
  };

  const notifyLine = async (item: CoordinationRailItem) => {
    // 1 เรื่อง = 1 ข้อความ × สมาชิกกลุ่ม — โควตา LINE OA มีจำกัด ให้ยืนยันก่อนส่ง
    const target = item.tasks[0];
    if (!target) return;
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'แจ้ง LINE กลุ่มเจ้าหน้าที่?',
      html: `ส่งสรุปการประสาน <b>${item.agencyName}</b> (เรื่อง ${target.code ?? ''})<br/><span class="text-sm opacity-70">ข้อความนี้นับโควตา LINE ตามจำนวนสมาชิกในกลุ่ม</span>`,
      showCancelButton: true,
      confirmButtonText: 'ส่งเลย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0E7C86',
    });
    if (!isConfirmed) return;
    setBusyAgency(item.agencyName);
    try {
      await axios.post('/api/complaints/coordination', { action: 'notify_line', assignmentId: target._id });
      toast('แจ้ง LINE กลุ่มแล้ว');
      await load();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ส่ง LINE ไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setBusyAgency(null);
    }
  };

  const officerName = data?.officer.name || user?.fullName || '';

  return (
    // ล้าง p-6 ของ LayoutAdmin แล้วคุม padding/พื้นหลังเองตามดีไซน์ (22px 24px บน #F6F5FA) · มือถือเผื่อที่ให้ bottom nav
    <div className="-m-6 min-h-full bg-tk-bg px-3.5 pt-3 pb-28 font-tk-sans text-tk-ink md:px-6 md:py-[22px]">
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-[14px] border border-tk-line bg-tk-line-light px-4 py-3 text-[13px] text-tk-ink-3">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-tk-ink-5" strokeWidth={1.8} />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-tk-surface px-3 py-1.5 text-[12.5px] font-semibold text-tk-primary shadow-tk-xs hover:bg-tk-primary-tint"
          >
            <ArrowPathIcon className="h-4 w-4" strokeWidth={2} />
            ลองใหม่
          </button>
        </div>
      )}

      {loading ? (
        <Skeletons />
      ) : data ? (
        <div className="flex flex-col gap-[18px]">
          <OfficerHeaderCard
            name={officerName}
            position={data.officer.position}
            department={data.officer.department}
            poolHref={POOL_HREF}
            onTransfer={openTransfer}
            transferLabel={canTransfer ? 'โอน / ส่งต่องาน' : 'ขอโอนงาน'}
            openCount={openTasks.length}
          />

          {(data.permissions.isHead || data.permissions.isSuperAdmin) && (
            <div className="-mt-2 flex items-center gap-2 text-[12.5px] text-tk-ink-5">
              <span>มุมมอง:</span>
              <div className="flex gap-1 rounded-[10px] bg-tk-surface p-1 shadow-tk-xs" role="radiogroup" aria-label="มุมมอง">
                {([['mine', 'งานของฉัน'], ['department', data.officer.department ? `งานของ${data.officer.department}` : 'งานทั้งหมด']] as const).map(([key, label]) => (
                  <button key={key} type="button" role="radio" aria-checked={scope === key} onClick={() => setQuery({ scope: key === 'mine' ? null : key })} className={clsx('rounded-lg px-3 py-1 text-[12px] whitespace-nowrap transition', scope === key ? 'bg-tk-primary font-semibold text-white' : 'font-medium text-tk-ink-4 hover:text-tk-ink')}>
                    {label}
                  </button>
                ))}
              </div>
              {scope === 'department' && <span className="hidden text-tk-ink-6 md:inline">โอนงานของทุกคนในกองได้จากปุ่ม “โอน / ส่งต่องาน”</span>}
            </div>
          )}

          <AlertCards cards={cards} active={alert} onSelect={(key) => setQuery({ alert: key })} />

          {/* README มือถือ 1 ไม่มี KPI strip — โชว์ตั้งแต่ md ขึ้นไป */}
          <KpiStrip kpi={data.kpi} className="hidden md:flex" />

          <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-[minmax(0,1fr)_340px]">
            {/* ④ ซ้าย — กลุ่มงานของฉัน */}
            <section className="rounded-[18px] bg-tk-surface px-5 py-[18px] shadow-tk-lg">
              <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="text-[16px] font-bold">กลุ่มงานของฉัน</h2>
                <span className="text-[12.5px] text-tk-ink-6">{openTasks.length} เรื่องที่ถืออยู่</span>
                {alert && (
                  <button
                    type="button"
                    onClick={() => setQuery({ alert: null })}
                    className="inline-flex items-center gap-1 rounded-full bg-tk-primary-tint px-2.5 py-1 text-[11.5px] font-semibold text-tk-primary-dark whitespace-nowrap hover:bg-tk-primary-line-2"
                  >
                    กรอง: {SEVERITY_LABELS[alert]}
                    <XMarkIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                )}
                <div className="ml-auto flex gap-1.5 rounded-[11px] bg-tk-bg p-1" role="radiogroup" aria-label="จัดกลุ่มตาม">
                  {(GROUP_BY as readonly GroupBy[]).map((key) => {
                    const on = key === groupBy;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setQuery({ groupBy: key === 'category' ? null : key })}
                        className={clsx(
                          'rounded-lg px-[13px] py-1.5 text-[12.5px] whitespace-nowrap transition',
                          on ? 'bg-tk-primary font-semibold text-white' : 'font-medium text-tk-ink-4 hover:text-tk-ink'
                        )}
                      >
                        {GROUP_LABELS[key]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <WorkGroupAccordion
                groups={groups}
                storageKey="tk:my-tasks:expanded"
                taskHref={(t) => t.actionUrl ?? '#'}
                emptyAction={
                  alert ? (
                    <button type="button" onClick={() => setQuery({ alert: null })} className="rounded-[10px] bg-tk-primary-tint px-4 py-2 text-[12.5px] font-semibold text-tk-primary-dark">
                      ล้างตัวกรอง
                    </button>
                  ) : (
                    <Link href={POOL_HREF} className="rounded-[10px] bg-tk-primary px-4 py-2 text-[12.5px] font-semibold text-white shadow-tk-purple">
                      ไปกองงานรอรับ
                    </Link>
                  )
                }
              />
            </section>

            {/* ④ ขวา — right rail */}
            <aside className="flex flex-col gap-3.5">
              <CoordinationRailCard
                items={coordination}
                officerDepartment={data.officer.department}
                busyAgency={busyAgency}
                onLogFollowUp={(item) => setFollowUpFor(item)}
                onNotifyLine={notifyLine}
              />
              <BlockedRailCard items={blocked} />
              <DueThisWeekCard items={dueThisWeek} />
            </aside>
          </div>
        </div>
      ) : null}

      <TransferTaskModal
        open={transferOpen}
        mode={transferMode}
        tasks={transferMode === 'request' ? openTasks.filter((t) => !t.assignee || t.assignee.id === data?.officer.id) : openTasks}
        officers={officers}
        officersLoading={officersLoading}
        selfId={data?.officer.id ?? ''}
        submitting={transferring}
        onClose={() => setTransferOpen(false)}
        onSubmit={submitTransfer}
        onRequest={submitTransferRequest}
      />
      <MobileTaskNav active="my-tasks" poolCount={poolCount} onFab={() => setQuery({ quick: '1' })} />
      <QuickTaskSheet open={quickOpen} tasks={openTasks} loading={loading} onClose={() => setQuery({ quick: null })} />
      <FollowUpModal
        open={!!followUpFor}
        agencyName={followUpFor?.agencyName ?? ''}
        tasks={followUpFor?.tasks ?? []}
        followUpEveryDays={data?.settings.followUpEveryDays ?? 7}
        submitting={followUpSaving}
        onClose={() => setFollowUpFor(null)}
        onSubmit={submitFollowUp}
      />
    </div>
  );
}
