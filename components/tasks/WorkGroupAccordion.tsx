// components/tasks/WorkGroupAccordion.tsx
// แผง "กลุ่มงานของฉัน" — แถวกลุ่ม (ยุบ/ขยาย, เปิดได้หลายกลุ่ม, จำสถานะใน sessionStorage) + task row ข้างใน
// ข้อมูลกลุ่มมาจาก lib/tasks/groupBy.js#groupTasks (ทั้งฝั่ง server และ client ใช้ตัวเดียวกัน)
import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import {
  BeakerIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  MapIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { OfficerTask, Severity, TaskGroup } from '@/lib/tasks/types';
import { AlertBadge, SEVERITY_TONE } from './AlertBadge';
import { TaskRow, SEVERITY_BAR_CLASSES } from './TaskRow';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface Tile {
  Icon: IconComponent;
  className: string;
}

/** icon tile ตามชื่อกลุ่ม — ประเภทเรื่อง (คีย์เวิร์ด) / ชื่อกอง / severity (โหมดความเร่งด่วน) */
export function tileForGroup(group: Pick<TaskGroup, 'key' | 'label'>): Tile {
  const key = group.key;
  const severityTile: Partial<Record<Severity, Tile>> = {
    overdue: { Icon: ExclamationTriangleIcon, className: 'bg-tk-overdue-soft text-tk-overdue-ink' },
    due_soon: { Icon: ExclamationTriangleIcon, className: 'bg-tk-due-soft text-tk-due-ink' },
    coordinating: { Icon: BuildingOffice2Icon, className: 'bg-tk-coord-soft text-tk-coord-ink' },
    blocked: { Icon: ClipboardDocumentListIcon, className: 'bg-tk-blocked-soft text-tk-blocked-ink' },
    normal: { Icon: ClipboardDocumentListIcon, className: 'bg-tk-line-light text-tk-ink-3' },
    done: { Icon: CheckCircleIcon, className: 'bg-tk-done-soft text-tk-done-ink' },
  };
  if (key in severityTile) return severityTile[key as Severity]!;

  const name = `${group.label} ${key}`;
  if (/ไฟ|แสง|โคม/.test(name)) return { Icon: LightBulbIcon, className: 'bg-tk-primary-tint text-tk-primary' };
  if (/น้ำ|ประปา|ท่อ/.test(name)) return { Icon: BeakerIcon, className: 'bg-tk-blue-soft text-tk-blue' };
  if (/ถนน|ทาง|สะพาน|โยธา/.test(name)) return { Icon: MapIcon, className: 'bg-tk-road-soft text-tk-road' };
  if (/ขยะ|สิ่งปฏิกูล|สาธารณสุข/.test(name)) return { Icon: TrashIcon, className: 'bg-tk-done-soft text-tk-done' };
  if (/กอง|สำนัก|งาน/.test(name)) return { Icon: BuildingOffice2Icon, className: 'bg-tk-primary-tint text-tk-primary-dark' };
  return { Icon: ClipboardDocumentListIcon, className: 'bg-tk-line-light text-tk-ink-3' };
}

/** ป้ายสรุปของกลุ่ม — เฉพาะที่มี (README: "สรุปเฉพาะที่มี") */
function GroupBadges({ counts, mobile = false }: { counts: TaskGroup['counts']; mobile?: boolean }) {
  const items: Array<{ severity: Severity; label: string }> = [
    { severity: 'overdue', label: 'เกินกำหนด' },
    { severity: 'due_soon', label: 'ใกล้ครบกำหนด' },
    { severity: 'coordinating', label: 'ประสาน' },
    { severity: 'blocked', label: 'รอวัสดุ' },
  ];
  const visible = items.filter((i) => (counts[i.severity] ?? 0) > 0);
  if (!visible.length) return null;
  return (
    <div className={clsx('flex-wrap items-center gap-1.5', mobile ? 'mt-1 flex sm:hidden' : 'ml-[14px] hidden sm:flex')}>
      {visible.map((i) => (
        <AlertBadge key={i.severity} tone={SEVERITY_TONE[i.severity]} size={mobile ? 'xs' : 'sm'}>
          {i.label} {counts[i.severity]}
        </AlertBadge>
      ))}
    </div>
  );
}

/** mini progress bar 52×6 แบ่ง segment ตามสถานะ */
function MiniProgress({ counts, total }: { counts: TaskGroup['counts']; total: number }) {
  const order: Severity[] = ['overdue', 'due_soon', 'coordinating', 'blocked', 'normal', 'done'];
  return (
    <div className="flex h-1.5 w-[52px] overflow-hidden rounded-full bg-tk-line-light" aria-hidden>
      {total > 0 &&
        order
          .filter((s) => (counts[s] ?? 0) > 0)
          .map((s) => (
            <div key={s} className={SEVERITY_BAR_CLASSES[s]} style={{ width: `${(counts[s] / total) * 100}%` }} />
          ))}
    </div>
  );
}

export interface WorkGroupAccordionProps {
  groups: TaskGroup[];
  /** ควบคุมจากภายนอก — ถ้าไม่ส่ง component จำสถานะเองใน sessionStorage */
  expandedKeys?: string[];
  onToggle?: (key: string, expanded: boolean) => void;
  /** คีย์ใน sessionStorage (โหมดไม่ควบคุม) */
  storageKey?: string;
  /** จำนวน task row ที่โชว์ก่อนกด "ดูอีก N เรื่อง" */
  previewCount?: number;
  /** ลิงก์หน้ารายละเอียดของแต่ละเรื่อง (หน้าจอ 3) */
  taskHref?: (task: OfficerTask) => string;
  onOpenTask?: (task: OfficerTask) => void;
  /** ถ้าส่งมา ลิงก์ "ดูอีก N เรื่อง" จะเรียกตัวนี้แทนการขยายในที่ */
  onShowMore?: (group: TaskGroup) => void;
  /** ปุ่ม/ลิงก์ในสถานะว่าง เช่น "ไปกองงานรอรับ" */
  emptyAction?: ReactNode;
  className?: string;
}

function readStorage(storageKey: string): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : null;
  } catch {
    return null;
  }
}

export function WorkGroupAccordion({
  groups,
  expandedKeys,
  onToggle,
  storageKey = 'tk:work-groups:expanded',
  previewCount = 2,
  taskHref,
  onOpenTask,
  onShowMore,
  emptyAction,
  className,
}: WorkGroupAccordionProps) {
  const controlled = Array.isArray(expandedKeys);
  // ค่าเริ่มต้น: เปิดกลุ่มแรก (กลุ่มเร่งด่วนที่สุด) — แล้วค่อยทับด้วยที่ผู้ใช้เคยเปิดไว้
  const [internal, setInternal] = useState<string[]>(() => (groups[0] ? [groups[0].key] : []));
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (controlled) return;
    const stored = readStorage(storageKey);
    if (stored) setInternal(stored);
    setHydrated(true);
  }, [controlled, storageKey]);

  useEffect(() => {
    if (controlled || !hydrated) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(internal));
    } catch {
      /* private mode ฯลฯ — ไม่ต้องจำก็ได้ */
    }
  }, [controlled, hydrated, internal, storageKey]);

  const expanded = useMemo(() => new Set(controlled ? expandedKeys : internal), [controlled, expandedKeys, internal]);

  const toggle = useCallback(
    (key: string) => {
      const next = !expanded.has(key);
      onToggle?.(key, next);
      if (!controlled) {
        setInternal((prev) => (next ? [...prev, key] : prev.filter((k) => k !== key)));
      }
    },
    [controlled, expanded, onToggle]
  );

  if (!groups.length) {
    return (
      <div className={clsx('flex flex-col items-center gap-2 rounded-2xl border border-dashed border-tk-line-dashed px-4 py-10 text-center', className)}>
        <CheckCircleIcon className="h-10 w-10 text-tk-done" strokeWidth={1.6} />
        <p className="text-[14px] font-semibold text-tk-ink">ยังไม่มีงานที่ได้รับมอบหมาย</p>
        <p className="text-[12.5px] text-tk-ink-5">เรื่องที่รับจากกองงานรอรับหรือที่หัวหน้ากองมอบหมายจะแสดงที่นี่</p>
        {emptyAction && <div className="mt-2">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col gap-2.5', className)}>
      {groups.map((group) => {
        const open = expanded.has(group.key);
        const hasOverdue = (group.counts.overdue ?? 0) > 0;
        const { Icon, className: tileCls } = tileForGroup(group);
        const all = showAll[group.key] === true;
        const visibleItems = all ? group.items : group.items.slice(0, previewCount);
        const hidden = group.items.length - visibleItems.length;
        const blockedCount = group.counts.blocked ?? 0;

        return (
          <section
            key={group.key}
            className={clsx(
              'rounded-2xl transition',
              open
                ? 'overflow-hidden border-[1.5px] border-tk-primary-line'
                : hasOverdue
                  ? 'border border-tk-overdue-line-soft bg-tk-overdue-tint'
                  : 'border border-tk-line bg-tk-surface'
            )}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(group.key)}
              className={clsx(
                'flex w-full items-center gap-3 px-4 py-[13px] text-left',
                open && 'bg-tk-primary-tint-2'
              )}
            >
              <span className={clsx('grid h-10 w-10 shrink-0 place-items-center rounded-[12px] sm:h-9 sm:w-9 sm:rounded-[11px]', tileCls)}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-bold text-tk-ink">{group.label}</span>
                {group.sub && <span className="block truncate text-[11.5px] text-tk-ink-5">{group.sub}</span>}
                <GroupBadges counts={group.counts} mobile />
              </span>
              <GroupBadges counts={group.counts} />
              <span className="ml-auto flex shrink-0 items-center gap-3">
                <span className="hidden sm:block"><MiniProgress counts={group.counts} total={group.count} /></span>
                <span className="text-[17px] font-bold text-tk-ink sm:text-[12.5px]">{group.count}</span>
                <ChevronDownIcon
                  className={clsx('h-[17px] w-[17px] transition-transform duration-200', open ? 'rotate-180 text-tk-primary' : 'text-tk-ink-6')}
                  strokeWidth={2}
                />
              </span>
            </button>

            <div className={clsx('tk-collapse', open && 'is-open')} aria-hidden={!open}>
              <div>
                <div className="flex flex-col gap-2 bg-tk-surface px-3 py-2.5">
                  {visibleItems.map((task) => (
                    <TaskRow key={task._id} task={task} href={taskHref?.(task)} onOpen={onOpenTask} />
                  ))}
                  {hidden > 0 && (
                    <button
                      type="button"
                      className="py-1 text-center text-[12.5px] font-semibold text-tk-primary hover:underline"
                      onClick={() => (onShowMore ? onShowMore(group) : setShowAll((s) => ({ ...s, [group.key]: true })))}
                    >
                      ดูอีก {hidden} เรื่องในกลุ่มนี้
                      {blockedCount > 0 && ` · มี ${blockedCount} เรื่องรอวัสดุ (พัก SLA)`}
                    </button>
                  )}
                  {all && group.items.length > previewCount && (
                    <button
                      type="button"
                      className="py-1 text-center text-[12.5px] font-semibold text-tk-ink-5 hover:underline"
                      onClick={() => setShowAll((s) => ({ ...s, [group.key]: false }))}
                    >
                      ย่อกลุ่มนี้
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default WorkGroupAccordion;
