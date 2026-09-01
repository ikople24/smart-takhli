// components/tasks/HeadsPanel.tsx
// แผง "ตั้งค่าหัวหน้ากอง" (superadmin) — ติ๊กว่าใครเป็นหัวหน้ากอง (มอบหมาย/โอนงานได้) แทนการเดาจากตำแหน่ง
// อยู่ในหน้ากองงานรอรับชั่วคราว จนกว่าหน้าจัดการผู้ใช้ของ superadmin จะรีดีไซน์เสร็จ → GET/PUT /api/tasks/heads
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import clsx from 'clsx';
import Swal from 'sweetalert2';
import { ChevronDownIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { AlertBadge } from './AlertBadge';

interface HeadUser {
  _id: string;
  name: string;
  department: string;
  canonicalDepartment: string | null;
  position: string;
  role: string;
  isActive: boolean;
  isDepartmentHead: boolean | null;
  effectiveHead: boolean;
  headByPosition: boolean;
}

const BTN = 'rounded-[8px] px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap transition disabled:opacity-50';

export function HeadsPanel({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<HeadUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ users: HeadUser[] }>('/api/tasks/heads');
      setUsers(data.users ?? []);
    } catch {
      Swal.fire({ icon: 'error', title: 'โหลดรายชื่อไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (open && !users.length) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const groups = useMemo(() => {
    const map = new Map<string, HeadUser[]>();
    for (const u of users) {
      const key = u.canonicalDepartment ?? (u.department ? `${u.department} (ไม่ตรงทะเบียนกอง)` : 'ไม่ระบุกอง');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th'));
  }, [users]);

  const setFlag = async (u: HeadUser, flag: boolean | null) => {
    setBusyId(u._id);
    try {
      await axios.put('/api/tasks/heads', { userId: u._id, isDepartmentHead: flag });
      setUsers((list) => list.map((x) => (x._id === u._id ? { ...x, isDepartmentHead: flag, effectiveHead: flag === null ? x.headByPosition : flag } : x)));
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: axios.isAxiosError(err) ? (err.response?.data?.error as string) : undefined });
    } finally {
      setBusyId(null);
    }
  };

  const headCount = users.filter((u) => u.effectiveHead).length;

  return (
    <section className={clsx('rounded-2xl border border-tk-line bg-tk-surface', className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-tk-primary-tint text-tk-primary">
          <UserGroupIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-tk-ink">ตั้งค่าหัวหน้ากอง <span className="text-[11px] font-medium text-tk-ink-5">(superadmin)</span></span>
          <span className="block text-[11.5px] text-tk-ink-5">หัวหน้ากองเท่านั้นที่มอบหมาย/โอนงานได้ — ไม่ตั้งค่า ระบบดูจากตำแหน่ง (ผู้อำนวยการ / หัวหน้า / ผอ. / ปลัด)</span>
        </span>
        {users.length > 0 && <span className="text-[12px] font-semibold text-tk-ink-4 whitespace-nowrap">หัวหน้า {headCount} คน</span>}
        <ChevronDownIcon className={clsx('h-4 w-4 text-tk-ink-6 transition-transform', open && 'rotate-180')} strokeWidth={2} />
      </button>
      {open && (
        <div className="border-t border-tk-line-light px-4 py-3">
          {loading ? (
            <p className="py-4 text-center text-[12.5px] text-tk-ink-5">กำลังโหลด…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map(([dept, list]) => (
                <div key={dept}>
                  <div className="mb-1.5 text-[12px] font-bold text-tk-ink-4">{dept}</div>
                  <ul className="flex flex-col gap-1">
                    {list.map((u) => {
                      const state = u.isDepartmentHead === true ? 'set' : u.isDepartmentHead === false ? 'unset' : 'auto';
                      return (
                        <li key={u._id} className={clsx('flex flex-wrap items-center gap-2 rounded-[10px] px-2.5 py-1.5', u.effectiveHead ? 'bg-tk-primary-tint-3' : 'bg-tk-bg')}>
                          <span className="min-w-0 flex-1">
                            <span className={clsx('block truncate text-[13px] font-semibold', u.isActive ? 'text-tk-ink' : 'text-tk-ink-6 line-through')}>{u.name || '(ไม่ระบุชื่อ)'}</span>
                            <span className="block truncate text-[11px] text-tk-ink-5">{u.position || '—'}{u.role === 'superadmin' ? ' · superadmin' : ''}</span>
                          </span>
                          <AlertBadge tone={u.effectiveHead ? 'coord' : 'neutral'} size="xs">
                            {u.effectiveHead ? (state === 'set' ? 'หัวหน้า (ตั้งค่า)' : 'หัวหน้า (ตามตำแหน่ง)') : state === 'unset' ? 'ไม่ใช่หัวหน้า (ตั้งค่า)' : 'ไม่ใช่หัวหน้า'}
                          </AlertBadge>
                          <span className="flex gap-1">
                            <button type="button" disabled={busyId === u._id || state === 'set'} onClick={() => setFlag(u, true)} className={clsx(BTN, 'bg-tk-primary text-white hover:bg-tk-primary-dark')}>ตั้งเป็นหัวหน้า</button>
                            <button type="button" disabled={busyId === u._id || state === 'unset'} onClick={() => setFlag(u, false)} className={clsx(BTN, 'bg-tk-line-light text-tk-ink-3 hover:bg-tk-line')}>ไม่ใช่</button>
                            {state !== 'auto' && (
                              <button type="button" disabled={busyId === u._id} onClick={() => setFlag(u, null)} className={clsx(BTN, 'text-tk-ink-5 hover:bg-tk-line-light')}>ตามตำแหน่ง</button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default HeadsPanel;
