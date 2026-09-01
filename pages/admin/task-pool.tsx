// pages/admin/task-pool.tsx
// หน้าจอ 2 "กองงานรอรับ" — README handoff § หน้าจอ 2: เรื่องที่ยังไม่มีเจ้าหน้าที่รับผิดชอบ
// alert bar (ค้างเกินเกณฑ์) · tabs ตามกอง/ประเภท/ความเร่งด่วน + ค้นหา/ชุมชน/ช่วงเวลา · kanban ต่อคอลัมน์ · การ์ดกดรับงาน/มอบหมาย/เลือกกอง
// ข้อมูลจาก GET /api/tasks/pool (derive + จัดคอลัมน์ฝั่ง server) — ตัวกรองอยู่ใน URL query
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import clsx from 'clsx';
import Swal from 'sweetalert2';
import { ArrowPathIcon, BellAlertIcon, ExclamationTriangleIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import PermissionGuard from '@/components/PermissionGuard';
import type { GroupBy, PoolColumn, PoolItem, PoolResponse } from '@/lib/tasks/types';
import { POOL_GROUP_BY, sortPoolItems } from '@/lib/tasks/pool';
import { withDistance, poolChipCounts } from '@/lib/tasks/mobile';
import { PoolCard, AssignTaskModal, DepartmentPickerModal, HeadsPanel, MobileTaskNav } from '@/components/tasks';
import type { OfficerOption } from '@/components/tasks';

const GROUP_LABELS: Record<GroupBy, string> = { organization: 'ตามกอง', category: 'ตามประเภทเรื่อง', priority: 'ตามความเร่งด่วน' };
const DAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '30', label: '30 วันล่าสุด' },
  { value: '90', label: '90 วันล่าสุด' },
  { value: '365', label: '1 ปีล่าสุด' },
  { value: 'all', label: 'ทั้งหมด' },
];
const PREVIEW_PER_COLUMN = 6;

const DOT: Record<string, string> = {
  primary: 'bg-tk-primary',
  done: 'bg-tk-done',
  coord: 'bg-tk-coord',
  blue: 'bg-tk-blue',
  road: 'bg-tk-road',
  due: 'bg-tk-due',
  overdue: 'bg-tk-overdue',
  unclaimed: 'bg-tk-unclaimed',
  neutral: 'bg-tk-ink-6',
};
const COUNT_PILL: Record<string, string> = {
  primary: 'bg-tk-primary-tint text-tk-primary-dark',
  done: 'bg-tk-done-soft text-tk-done-ink',
  coord: 'bg-tk-coord-soft text-tk-coord-ink',
  blue: 'bg-tk-blue-soft text-tk-blue',
  road: 'bg-tk-road-soft text-tk-road',
  due: 'bg-tk-due-soft text-tk-due-ink',
  overdue: 'bg-tk-overdue-soft text-tk-overdue-ink',
  unclaimed: 'bg-tk-unclaimed-soft text-tk-unclaimed-ink',
  neutral: 'bg-tk-line-light text-tk-ink-3',
};
const MAX_DAYS_INK: Record<PoolColumn['maxDaysTone'], string> = { overdue: 'text-tk-overdue-ink', due: 'text-tk-due-ink', neutral: 'text-tk-ink-4' };

const toast = (title: string, icon: 'success' | 'error' | 'info' = 'success') =>
  Swal.fire({ toast: true, position: 'top-end', timer: 2600, timerProgressBar: true, showConfirmButton: false, icon, title });
const errorMessage = (err: unknown, fallback: string) =>
  (axios.isAxiosError(err) && (err.response?.data?.error as string | undefined)) || fallback;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Skeletons() {
  return (
    <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]" aria-busy>
      {[0, 1, 2, 3].map((c) => (
        <div key={c} className="flex flex-col gap-2.5 rounded-2xl bg-tk-surface p-3.5 shadow-tk-lg">
          <div className="skeleton h-5 w-2/3 rounded-lg" />
          <div className="skeleton h-[120px] rounded-[13px]" />
          <div className="skeleton h-[120px] rounded-[13px]" />
        </div>
      ))}
    </div>
  );
}

function TaskPoolContent() {
  const router = useRouter();
  const { user } = useUser();

  const [data, setData] = useState<PoolResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set()); // optimistic remove หลังรับงาน
  const [assignFor, setAssignFor] = useState<PoolItem | null>(null);
  const [deptFor, setDeptFor] = useState<PoolItem | null>(null);
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [alerting, setAlerting] = useState(false);
  // มือถือ (README มือถือ 2): chip กองของฉัน / ค้างนาน / ใกล้ฉัน / ทั้งหมด + flat list
  const [mobileFilter, setMobileFilter] = useState<'mine' | 'stale' | 'near' | 'all' | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // ตัวกรองอยู่ใน URL (แชร์ลิงก์/กด back ได้)
  const groupBy: GroupBy = (POOL_GROUP_BY as readonly string[]).includes(String(router.query.groupBy)) ? (router.query.groupBy as GroupBy) : 'organization';
  const community = typeof router.query.community === 'string' ? router.query.community : '';
  const days = typeof router.query.days === 'string' && DAY_OPTIONS.some((d) => d.value === router.query.days) ? router.query.days : '30';
  const onlyStale = router.query.stale === '1';

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries({ ...router.query, ...patch })) if (typeof v === 'string' && v) next[k] = v;
      router.replace({ pathname: router.pathname, query: next }, undefined, { shallow: true });
    },
    [router]
  );

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setError(null);
      try {
        const { data: res } = await axios.get<PoolResponse>('/api/tasks/pool', {
          params: { groupBy, q: q || undefined, community: community || undefined, days, onlyStale: onlyStale ? '1' : undefined },
        });
        setData(res);
        setHidden(new Set());
      } catch (err) {
        setError(errorMessage(err, 'โหลดกองงานรอรับไม่สำเร็จ'));
      } finally {
        setLoading(false);
      }
    },
    [groupBy, q, community, days, onlyStale]
  );

  useEffect(() => {
    if (!user || !router.isReady) return;
    load();
  }, [user, router.isReady, load]);

  const columns = useMemo<PoolColumn[]>(
    () => (data?.columns ?? []).map((c) => ({ ...c, items: c.items.filter((i) => !hidden.has(i._id)) })).map((c) => ({ ...c, count: c.items.length })),
    [data, hidden]
  );
  const visibleTotal = columns.reduce((s, c) => s + c.count, 0);

  const visibleItems = useMemo<PoolItem[]>(() => (data?.items ?? []).filter((i) => !hidden.has(i._id)), [data, hidden]);
  const chipCounts = useMemo(() => poolChipCounts(visibleItems, { officerDepartment: data?.officer.department ?? null }), [visibleItems, data]);
  const effectiveMobileFilter = mobileFilter ?? (data?.officer.department ? 'mine' : 'all');
  const mobileList = useMemo<PoolItem[]>(() => {
    let list = visibleItems;
    if (effectiveMobileFilter === 'mine' && data?.officer.department) list = list.filter((i) => i.department === data.officer.department);
    if (effectiveMobileFilter === 'stale') list = list.filter((i) => i.isStale);
    if (effectiveMobileFilter === 'near') return withDistance(list, origin) as PoolItem[];
    return sortPoolItems(list) as PoolItem[];
  }, [visibleItems, effectiveMobileFilter, data, origin]);

  const locateMe = () => {
    if (origin) {
      setMobileFilter('near');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast('อุปกรณ์นี้ไม่รองรับตำแหน่ง', 'info');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setMobileFilter('near');
        setLocating(false);
      },
      () => {
        toast('ขอตำแหน่งไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์', 'error');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const ensureOfficers = async () => {
    if (officers.length) return;
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

  /* ── รับงาน (optimistic + เลิกทำ 5 วินาที) ── */
  const claim = async (item: PoolItem) => {
    if (!data) return;
    setBusyId(item._id);
    try {
      const { data: res } = await axios.post('/api/complaints/assignments/create', {
        complaintId: item._id,
        userId: data.officer.id,
        officerName: data.officer.name,
      });
      const assignmentId: string | undefined = res?.assignment?._id;
      setHidden((h) => new Set(h).add(item._id));
      const result = await Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `รับงานแล้ว — อยู่ในกลุ่มงาน "${item.category || 'อื่นๆ'}" ของคุณ`,
        timer: 5000,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonText: 'เลิกทำ',
        confirmButtonColor: '#6B6880',
      });
      if (result.isConfirmed && assignmentId) {
        try {
          await axios.delete(`/api/complaints/assignments/${assignmentId}`);
          toast('เลิกทำแล้ว — เรื่องกลับเข้ากองงานรอรับ', 'info');
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'เลิกทำไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
        }
      }
      await load(true);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'รับงานไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setBusyId(null);
    }
  };

  const assign = async (toUserId: string) => {
    if (!assignFor || !data) return;
    setBusyId(assignFor._id);
    try {
      const target = officers.find((o) => o._id === toUserId);
      await axios.post('/api/complaints/assignments/create', { complaintId: assignFor._id, userId: toUserId, officerName: target?.name ?? '' });
      setAssignFor(null);
      toast(`มอบหมายให้ ${target?.name || 'เจ้าหน้าที่'} แล้ว`);
      await load(true);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'มอบหมายไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setBusyId(null);
    }
  };

  const setDepartment = async (department: string) => {
    if (!deptFor) return;
    setBusyId(deptFor._id);
    try {
      await axios.patch('/api/tasks/set-department', { complaintId: deptFor._id, department });
      setDeptFor(null);
      toast(`ย้ายไป ${department} แล้ว`);
      await load(true);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'บันทึกกองไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setBusyId(null);
    }
  };

  const notifyHeads = async () => {
    if (!data) return;
    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'แจ้งเตือนหัวหน้ากองทาง LINE?',
      html: `ส่งสรุปเรื่องค้างเกิน ${data.settings.unclaimedAlertDays} วัน (${data.stale.count} เรื่อง) เข้ากลุ่มเจ้าหน้าที่<br/><span class="text-sm opacity-70">ข้อความนี้นับโควตา LINE ตามจำนวนสมาชิกในกลุ่ม</span>`,
      showCancelButton: true,
      confirmButtonText: 'ส่งเลย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#E0455B',
    });
    if (!isConfirmed) return;
    setAlerting(true);
    try {
      await axios.post('/api/tasks/pool-alert', { days });
      toast('แจ้ง LINE กลุ่มแล้ว');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ส่ง LINE ไม่สำเร็จ', text: errorMessage(err, 'ลองใหม่อีกครั้ง') });
    } finally {
      setAlerting(false);
    }
  };

  const stale = data?.stale;

  return (
    <div className="-m-6 min-h-full bg-tk-bg px-3.5 pt-3 pb-28 font-tk-sans text-tk-ink md:px-6 md:py-[22px]">
      <div className="flex flex-col gap-4">
        {/* 1. Page title */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[21px] font-bold leading-tight md:text-[22px]">กองงานรอรับ</h1>
            <p className="mt-1 text-[13.5px] text-tk-ink-4"><span className="md:hidden">{visibleTotal} เรื่องยังไม่มีเจ้าของ</span><span className="hidden md:inline">เรื่องที่ยังไม่มีเจ้าหน้าที่รับผิดชอบ — กดรับงานเพื่อย้ายเข้ากลุ่มงานของคุณ</span></p>
          </div>
          {data && (
            <p className="hidden text-[12.5px] text-tk-ink-6 md:block">
              {visibleTotal} เรื่องยังไม่มีเจ้าของ
              {data.officer.department ? ` · กองของคุณ: ${data.officer.department}` : ' · โปรไฟล์ยังไม่ระบุกอง — รับได้ทุกเรื่อง'}
              {data.officer.canAssign ? ' · คุณมอบหมายงานได้' : ''}
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-[14px] border border-tk-line bg-tk-line-light px-4 py-3 text-[13px] text-tk-ink-3">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-tk-ink-5" strokeWidth={1.8} />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => { setLoading(true); load(); }} className="inline-flex items-center gap-1.5 rounded-[10px] bg-tk-surface px-3 py-1.5 text-[12.5px] font-semibold text-tk-primary shadow-tk-xs hover:bg-tk-primary-tint">
              <ArrowPathIcon className="h-4 w-4" strokeWidth={2} />
              ลองใหม่
            </button>
          </div>
        )}

        {/* 2. Alert bar (แดง) */}
        {stale && (stale.count > 0 || stale.olderOutsideWindow > 0) && (
          <div className="flex flex-wrap items-center gap-3 rounded-[15px] border border-tk-overdue-line bg-tk-overdue-soft px-3.5 py-3 md:gap-3.5 md:rounded-[14px] md:px-[18px] md:py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-tk-surface" aria-hidden>
              <ExclamationTriangleIcon className="h-5 w-5 text-tk-overdue" strokeWidth={2} />
            </span>
            {/* มือถือ: ข้อความกินความกว้างที่เหลือของแถวแรก ปุ่มไปแถวถัดไป — ห้ามใช้ flex-1 min-w-0 คู่กับปุ่มที่ไม่หด ไม่งั้นข้อความถูกบีบเป็นคำละบรรทัด */}
            <div className="min-w-0 flex-1 basis-[calc(100%-48px)] md:basis-auto">
              <div className="text-[14.5px] font-bold text-tk-overdue-ink">
                {stale.count > 0 ? `${stale.count} เรื่องค้างไม่มีคนรับเกิน ${data!.settings.unclaimedAlertDays} วัน` : `มีเรื่องค้างเก่ากว่าช่วงที่แสดง ${stale.olderOutsideWindow} เรื่อง`}
              </div>
              <div className="text-[12.5px] text-tk-overdue-ink-2">
                {stale.count > 0 && stale.maxDays !== null && (
                  <>ค้างนานสุด {stale.maxDays} วัน{stale.community ? ` — ชุมชน${stale.community}` : ''} · {stale.urgentCount > 0 ? `${stale.urgentCount} เรื่องเลย SLA แล้ว` : 'ต้องมอบหมายวันนี้ก่อนเลยกำหนด SLA'}</>
                )}
                {stale.olderOutsideWindow > 0 && (
                  <>
                    {stale.count > 0 && ' · '}
                    <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => setQuery({ days: 'all' })}>
                      อีก {stale.olderOutsideWindow} เรื่องเก่ากว่าช่วงที่แสดง — ดูทั้งหมด
                    </button>
                  </>
                )}
              </div>
            </div>
            {stale.count > 0 && (
              <div className="flex w-full gap-2 md:w-auto">
                <button type="button" onClick={() => { setQuery({ stale: onlyStale ? null : '1' }); setMobileFilter(onlyStale ? null : 'stale'); }} className={clsx('touch-feedback min-h-11 flex-1 rounded-[11px] px-[15px] py-[9px] text-[13px] font-semibold whitespace-nowrap transition md:flex-none', onlyStale ? 'bg-tk-overdue-ink text-white' : 'bg-tk-overdue text-white hover:brightness-95')}>
                  {onlyStale ? 'แสดงทั้งหมด' : 'ดูเฉพาะที่ค้าง'}
                </button>
                <button type="button" disabled={alerting} onClick={notifyHeads} className="touch-feedback inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-tk-surface px-[15px] py-[9px] text-[13px] font-semibold text-tk-overdue-ink whitespace-nowrap transition hover:bg-tk-overdue-tint disabled:opacity-60 md:flex-none">
                  <BellAlertIcon className="h-4 w-4" strokeWidth={2} />
                  แจ้งเตือนหัวหน้ากอง
                </button>
              </div>
            )}
          </div>
        )}

        {/* มือถือ: chip แถวเดียว scroll แนวนอน */}
        {data && (
          <div className="no-scrollbar -mx-3.5 flex gap-2 overflow-x-auto px-3.5 md:hidden" role="radiogroup" aria-label="ตัวกรอง">
            {([
              ...(data.officer.department ? [['mine', `กองของฉัน ${chipCounts.mine}`]] : []),
              ['stale', `ค้างนาน ${chipCounts.stale}`],
              ['near', locating ? 'กำลังหาตำแหน่ง…' : 'ใกล้ฉัน'],
              ['all', `ทั้งหมด ${chipCounts.all}`],
            ] as Array<['mine' | 'stale' | 'near' | 'all', string]>).map(([key, label]) => {
              const on = effectiveMobileFilter === key;
              return (
                <button key={key} type="button" role="radio" aria-checked={on} onClick={() => (key === 'near' ? locateMe() : setMobileFilter(key))} className={clsx('touch-feedback min-h-10 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition', on ? 'bg-tk-primary text-white' : 'bg-tk-surface text-tk-ink-4 shadow-tk-xs')}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* 3. Tabs + filters (เดสก์ท็อป) */}
        <div className="hidden flex-wrap items-center gap-3 md:flex">
          <div className="flex gap-1.5 rounded-[11px] bg-tk-surface p-1 shadow-tk-xs" role="radiogroup" aria-label="แบ่งคอลัมน์ตาม">
            {(POOL_GROUP_BY as readonly GroupBy[]).map((key) => {
              const on = key === groupBy;
              return (
                <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setQuery({ groupBy: key === 'organization' ? null : key })} className={clsx('rounded-lg px-[13px] py-1.5 text-[12.5px] whitespace-nowrap transition', on ? 'bg-tk-primary font-semibold text-white' : 'font-medium text-tk-ink-4 hover:text-tk-ink')}>
                  {GROUP_LABELS[key]}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex w-[230px] items-center gap-2 rounded-[11px] border border-tk-line bg-tk-surface px-[13px] py-2">
              <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-tk-ink-6" strokeWidth={2} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาเลขเรื่อง / รายละเอียด" className="w-full bg-transparent text-[13px] text-tk-ink outline-none placeholder:text-tk-ink-8" aria-label="ค้นหา" />
            </label>
            <select value={community} onChange={(e) => setQuery({ community: e.target.value || null })} className="rounded-[11px] border border-tk-line bg-tk-surface px-3 py-2 text-[13px] text-tk-ink outline-none" aria-label="ชุมชน">
              <option value="">ทุกชุมชน</option>
              {(data?.communities ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={days} onChange={(e) => setQuery({ days: e.target.value === '30' ? null : e.target.value })} className="rounded-[11px] border border-tk-line bg-tk-surface px-3 py-2 text-[13px] text-tk-ink outline-none" aria-label="ช่วงเวลา">
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            {(onlyStale || community || q) && (
              <button type="button" onClick={() => { setSearch(''); setQuery({ stale: null, community: null }); }} className="inline-flex items-center gap-1 rounded-[11px] px-2.5 py-2 text-[12.5px] font-semibold text-tk-primary hover:bg-tk-primary-tint">
                <FunnelIcon className="h-4 w-4" strokeWidth={2} />
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* มือถือ: flat list */}
        {!loading && data && visibleTotal > 0 && (
          <div className="flex flex-col gap-2.5 md:hidden">
            {mobileList.length === 0 ? (
              <p className="rounded-2xl bg-tk-surface px-4 py-8 text-center text-[13px] text-tk-ink-5">ไม่มีเรื่องตามตัวกรองนี้</p>
            ) : (
              mobileList.map((item) => (
                <PoolCard key={item._id} item={item} action={item.action} canAssign={data.officer.canAssign} busy={busyId === item._id} variant="mobile" onClaim={claim} onAssign={(it) => { setAssignFor(it); ensureOfficers(); }} onChooseOrg={setDeptFor} />
              ))
            )}
          </div>
        )}

        {/* 4. Kanban (เดสก์ท็อป) */}
        {loading ? (
          <Skeletons />
        ) : data && visibleTotal === 0 ? (
          <div className="rounded-2xl border border-dashed border-tk-line-dashed bg-tk-surface px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-tk-ink">{q || community || onlyStale ? 'ไม่พบเรื่องตามตัวกรอง' : 'ไม่มีเรื่องค้างรับ — ทุกเรื่องมีเจ้าของแล้ว'}</p>
            {(q || community || onlyStale) && <p className="mt-1 text-[12.5px] text-tk-ink-5">ลองล้างตัวกรอง หรือขยายช่วงเวลา</p>}
          </div>
        ) : data ? (
          <div className="hidden gap-3.5 grid-cols-[repeat(auto-fill,minmax(250px,1fr))] md:grid">
            {columns.map((col) => {
              const open = expanded[col.key] === true;
              const visible = open ? col.items : col.items.slice(0, PREVIEW_PER_COLUMN);
              const more = col.items.length - visible.length;
              return (
                <section key={col.key} className={clsx('flex flex-col gap-2.5 rounded-2xl p-3.5', col.isUnassigned ? 'border-[1.5px] border-dashed border-tk-line-dashed bg-tk-primary-tint-3' : 'bg-tk-surface shadow-tk-lg')}>
                  <header>
                    <div className="flex items-center gap-2">
                      <span className={clsx('h-[9px] w-[9px] shrink-0 rounded-[3px]', DOT[col.tone] ?? DOT.neutral)} aria-hidden />
                      <h2 className="truncate text-[14px] font-bold text-tk-ink" title={col.fullName ?? col.label}>{col.label}</h2>
                      <span className={clsx('ml-auto rounded-full px-2 py-0.5 text-[12.5px] font-bold', COUNT_PILL[col.tone] ?? COUNT_PILL.neutral)}>{col.count}</span>
                    </div>
                    <div className={clsx('mt-1 text-[11.5px] font-semibold', col.isUnassigned && col.count > 0 ? 'text-tk-overdue-ink' : MAX_DAYS_INK[col.maxDaysTone])}>
                      {col.count === 0 ? (col.isOwn ? 'ไม่มีเรื่องค้าง — เคลียร์แล้ว' : 'ไม่มีเรื่อง') : col.isUnassigned ? 'ต้องคัดแยกก่อนมอบหมาย' : `ค้างนานสุด ${col.maxDays ?? 0} วัน`}
                    </div>
                  </header>
                  {visible.map((item) => (
                    <PoolCard
                      key={item._id}
                      item={item}
                      action={item.action}
                      canAssign={data.officer.canAssign}
                      busy={busyId === item._id}
                      onClaim={claim}
                      onAssign={(it) => { setAssignFor(it); ensureOfficers(); }}
                      onChooseOrg={setDeptFor}
                    />
                  ))}
                  {more > 0 && (
                    <button type="button" onClick={() => setExpanded((e) => ({ ...e, [col.key]: true }))} className="py-1 text-center text-[12px] font-semibold text-tk-primary hover:underline">
                      อีก {more} เรื่อง
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        ) : null}

        {data?.officer.isSuperAdmin && <HeadsPanel />}
      </div>

      <MobileTaskNav active="task-pool" poolCount={visibleTotal} onFab={() => router.push('/admin/my-tasks?quick=1')} />

      <AssignTaskModal open={!!assignFor} item={assignFor} officers={officers} officersLoading={officersLoading} workload={data?.workload ?? {}} submitting={!!assignFor && busyId === assignFor._id} onClose={() => setAssignFor(null)} onSubmit={assign} />
      <DepartmentPickerModal open={!!deptFor} item={deptFor} departments={data?.departments ?? []} submitting={!!deptFor && busyId === deptFor._id} onClose={() => setDeptFor(null)} onSubmit={setDepartment} />
    </div>
  );
}

export default function TaskPoolPage() {
  return (
    <PermissionGuard>
      <TaskPoolContent />
    </PermissionGuard>
  );
}
