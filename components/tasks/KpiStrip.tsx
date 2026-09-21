// components/tasks/KpiStrip.tsx
// แถบ KPI 5 ช่องในการ์ดเดียว (README ③ KPI strip)
import React from 'react';
import clsx from 'clsx';
import type { MyKpi } from '@/lib/tasks/types';

interface Cell {
  label: string;
  value: string;
  unit?: string;
  valueClass?: string;
  title?: string;
}

export function KpiStrip({ kpi, className }: { kpi: MyKpi; className?: string }) {
  const dash = '–';
  const cells: Cell[] = [
    { label: 'กำลังดำเนินการ', value: String(kpi.inProgress), unit: 'เรื่อง' },
    { label: 'เสร็จเดือนนี้', value: String(kpi.completedThisMonth), valueClass: 'text-tk-done' },
    { label: 'เสร็จตามกำหนด', value: kpi.onTimeRate === null ? dash : String(kpi.onTimeRate), unit: kpi.onTimeRate === null ? undefined : '%' },
    { label: 'เฉลี่ยต่อเรื่อง', value: kpi.avgResolutionDays === null ? dash : String(kpi.avgResolutionDays), unit: kpi.avgResolutionDays === null ? undefined : 'วัน' },
    {
      label: 'ความพึงพอใจ',
      value: kpi.satisfaction === null ? dash : kpi.satisfaction.toFixed(1),
      unit: kpi.satisfaction === null ? undefined : '/ 5',
      title:
        kpi.satisfaction === null
          ? 'ยังไม่มีคะแนนจากผู้แจ้ง'
          : `นับต่อผู้แจ้ง (1 ผู้แจ้ง = 1 เสียง) · ${kpi.satisfactionReporters ?? 0} ผู้แจ้ง · ${kpi.satisfactionCount ?? 0} คะแนน`,
    },
  ];

  return (
    <div className={clsx('flex flex-wrap items-center gap-y-3 rounded-[14px] bg-tk-surface px-6 py-3.5 shadow-tk-md', className)}>
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          title={cell.title}
          className={clsx('min-w-[150px] flex-1', i > 0 && 'lg:border-l lg:border-tk-line-light lg:pl-6')}
        >
          <div className="text-[11.5px] text-tk-ink-5">{cell.label}</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className={clsx('text-[21px] font-bold leading-none', cell.valueClass ?? 'text-tk-ink')}>{cell.value}</span>
            {cell.unit && <span className="text-[12px] font-medium text-tk-ink-6">{cell.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default KpiStrip;
