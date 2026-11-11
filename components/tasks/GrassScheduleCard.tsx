// components/tasks/GrassScheduleCard.tsx
// การ์ด "ตารางคิวตัดหญ้า" ในหน้ารายละเอียดงาน — แสดงเฉพาะงานชนิด 'grass' (lib/tasks/grassSchedule.js)
// ไฟล์กลางไฟล์เดียว อัปโหลดโดย superadmin ที่ /admin/superadmin/task-settings · ประชาชนเห็นลิงก์เดียวกันที่หน้า /status
// ปุ่ม "บันทึกว่าอยู่ในคิวตัดหญ้า" = บันทึกความคืบหน้า (PATCH action 'progress') ด้วยข้อความ GRASS_QUEUE_NOTE
import React from 'react';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import type { GrassSchedule } from '@/lib/tasks/types';
import { formatThaiDate } from '@/lib/tasks/format';

export interface GrassScheduleCardProps {
  schedule: GrassSchedule | null;
  /** ไม่ส่ง = ไม่มีปุ่ม (ไม่ใช่เจ้าของงาน / งานปิดแล้ว) */
  onNotifyQueued?: () => void;
  submitting?: boolean;
}

export function GrassScheduleCard({ schedule, onNotifyQueued, submitting }: GrassScheduleCardProps) {
  return (
    <div className="rounded-[14px] border border-tk-line bg-tk-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-tk-primary-tint text-tk-primary">
          <CalendarDaysIcon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="text-[13.5px] font-bold text-tk-ink">ตารางคิวตัดหญ้า</span>
      </div>
      {schedule?.url ? (
        <>
          <a
            href={schedule.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block truncate text-[13px] font-semibold text-tk-primary hover:underline"
          >
            {schedule.fileName || 'เปิดตารางคิว'} ↗
          </a>
          {schedule.updatedAt && <p className="text-[11.5px] text-tk-ink-5">อัปเดต {formatThaiDate(schedule.updatedAt)}</p>}
          {onNotifyQueued && (
            <button
              type="button"
              disabled={submitting}
              onClick={onNotifyQueued}
              className="mt-2.5 w-full rounded-[11px] bg-tk-primary-tint px-3 py-2 text-[12.5px] font-semibold text-tk-primary transition hover:bg-tk-primary-tint-2 disabled:opacity-60"
            >
              {submitting ? 'กำลังบันทึก…' : 'บันทึกว่าอยู่ในคิวตัดหญ้า'}
            </button>
          )}
          <p className="mt-1.5 text-[11px] text-tk-ink-6">ผู้แจ้งเห็นลิงก์ตารางนี้ที่หน้าติดตามสถานะจนกว่าจะปิดเรื่อง</p>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-tk-ink-5">ยังไม่มีตารางคิว — ให้ superadmin อัปโหลดที่หน้าตั้งค่างานเจ้าหน้าที่</p>
      )}
    </div>
  );
}
