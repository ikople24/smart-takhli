// components/tasks/TaskSettingsPanel.tsx
// หน้าตั้งค่างานเจ้าหน้าที่ (superadmin) — วันหยุดราชการ + กำหนดปิดเรื่องตามชนิดงาน (วันทำการ) + ตารางคิวตัดหญ้า
// ใช้ที่หน้า /admin/superadmin/task-settings → GET/PUT /api/tasks/settings (PUT = superadmin เท่านั้น ฝั่ง server)
// กำหนดปิดนับวันทำการ จ.–ศ. ไม่รวมวันหยุดในรายการนี้ (lib/tasks/businessDays.js) · เกณฑ์รับเรื่อง 24 ชม. ไม่สนวันหยุด
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import clsx from 'clsx';
import Swal from 'sweetalert2';
import { CalendarDaysIcon, ClockIcon, DocumentArrowUpIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { GrassSchedule, TaskHoliday, TaskSettings } from '@/lib/tasks/types';
import { WORK_TYPES } from '@/lib/tasks/workTypes';
import { DEFAULT_TASK_SETTINGS } from '@/lib/tasks/settings';
import { fixedHolidaysForBeYear, mergeHolidays, normalizeHolidays } from '@/lib/tasks/holidays';
import { addBusinessDays, isValidDateKey } from '@/lib/tasks/businessDays';
import { bangkokDateKey, formatThaiDate } from '@/lib/tasks/format';

const BTN = 'rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition disabled:opacity-50';
const INPUT = 'rounded-[10px] border border-tk-line bg-tk-surface px-2.5 py-1.5 text-[13px] text-tk-ink focus:border-tk-primary focus:outline-none';

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const weekdayOf = (dateKey: string) => THAI_WEEKDAYS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
const isWeekend = (dateKey: string) => [0, 6].includes(new Date(`${dateKey}T00:00:00Z`).getUTCDay());
const beYearOf = (dateKey: string) => Number(dateKey.slice(0, 4)) + 543;
const MAX_SCHEDULE_BYTES = 10 * 1024 * 1024; // เพดานไฟล์ของ Cloudinary แผนฟรี

/**
 * อัปโหลดไฟล์ตารางคิวตัดหญ้าเข้า Cloudinary (unsigned preset ตัวเดียวกับทั้งระบบ)
 * — รูป → image/upload (ไม่ย่อ: ตารางต้องอ่านตัวหนังสือออก ต่างจาก utils/uploadToCloudinary ที่ย่อเหลือ 1024px)
 * — PDF → raw/upload (เปิดดูในเบราว์เซอร์ได้ตรง ๆ · PDF แบบ image ถูกบล็อกการเปิดถ้าบัญชีไม่เปิด "Allow delivery of PDF")
 */
async function uploadScheduleFile(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${isPdf ? 'raw' : 'image'}/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || typeof data?.secure_url !== 'string') throw new Error(data?.error?.message || 'อัปโหลดไฟล์ไม่สำเร็จ');
  return data.secure_url;
}

const errorText = (err: unknown) => (axios.isAxiosError(err) ? (err.response?.data?.error as string | undefined) : undefined);

function Section({ icon, title, caption, children }: { icon: React.ReactNode; title: string; caption?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-tk-line bg-tk-surface">
      <header className="flex items-start gap-3 border-b border-tk-line-light px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-tk-primary-tint text-tk-primary">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-tk-ink">{title}</span>
          {caption && <span className="block text-[12px] text-tk-ink-5">{caption}</span>}
        </span>
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function TaskSettingsPanel() {
  const [settings, setSettings] = useState<TaskSettings | null>(null);
  const [holidays, setHolidays] = useState<TaskHoliday[]>([]);
  const [slaInput, setSlaInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'holidays' | 'sla' | 'grass' | null>(null);
  const todayKey = bangkokDateKey(new Date()) ?? '2026-01-01';
  const [year, setYear] = useState<number>(beYearOf(todayKey));
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  // บันทึกส่วนหนึ่งต้องไม่ล้างค่าที่ยังไม่บันทึกของอีกส่วน — รีเซ็ตเฉพาะส่วนที่บันทึก
  const resetHolidays = (s: TaskSettings) => setHolidays(s.holidays ?? []);
  const resetSla = (s: TaskSettings) => setSlaInput(slaInputFor(s));

  useEffect(() => {
    axios
      .get<{ settings: TaskSettings }>('/api/tasks/settings')
      .then(({ data }) => {
        setSettings(data.settings);
        setHolidays(data.settings.holidays ?? []);
        setSlaInput(slaInputFor(data.settings));
      })
      .catch((err) => Swal.fire({ icon: 'error', title: 'โหลดการตั้งค่าไม่สำเร็จ', text: errorText(err) }));
  }, []);

  /* ── วันหยุด ── */
  const savedHolidays = useMemo(() => JSON.stringify(settings?.holidays ?? []), [settings]);
  const holidaysDirty = settings !== null && JSON.stringify(holidays) !== savedHolidays;
  const years = useMemo(() => {
    const set = new Set<number>([beYearOf(todayKey), beYearOf(todayKey) + 1, ...holidays.map((h) => beYearOf(h.date))]);
    return [...set].sort((a, b) => a - b);
  }, [holidays, todayKey]);
  const yearHolidays = holidays.filter((h) => beYearOf(h.date) === year);

  const addHoliday = () => {
    if (!isValidDateKey(newDate)) {
      Swal.fire({ icon: 'warning', title: 'เลือกวันที่ก่อน' });
      return;
    }
    if (holidays.some((h) => h.date === newDate)) {
      Swal.fire({ icon: 'info', title: 'มีวันนี้ในรายการแล้ว' });
      return;
    }
    setHolidays(normalizeHolidays([...holidays, { date: newDate, name: newName }]));
    setYear(beYearOf(newDate));
    setNewDate('');
    setNewName('');
  };

  const fillFixed = () => {
    const { holidays: next, added } = mergeHolidays(holidays, fixedHolidaysForBeYear(year));
    setHolidays(next);
    Swal.fire({ icon: added ? 'success' : 'info', title: added ? `เติมแล้ว ${added} วัน` : 'มีครบแล้ว', text: 'อย่าลืมกด "บันทึกวันหยุด"', timer: 2200, showConfirmButton: false });
  };

  const saveHolidays = async () => {
    setBusy('holidays');
    try {
      const { data } = await axios.put<{ settings: TaskSettings }>('/api/tasks/settings', { holidays });
      setSettings(data.settings);
      resetHolidays(data.settings);
      Swal.fire({
        icon: 'success',
        title: 'บันทึกวันหยุดแล้ว',
        html:
          '<div class="text-sm">มีผลกับงานที่รับใหม่ทันที — งานที่รับไปแล้วยังใช้วันครบกำหนดเดิมที่บันทึกไว้ ' +
          'จนกว่าผู้ดูแลระบบจะรัน <code>scripts/recompute-task-due-dates.mjs --yes</code> (แจ้งทีมพัฒนาให้รันให้)</div>',
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  /* ── กำหนดปิดตามชนิดงาน ── */
  const slaDirty = settings !== null && WORK_TYPES.some((t) => slaInput[t.key] !== String(effectiveSla(settings, t.key)));
  const slaInvalid = WORK_TYPES.some((t) => !isPositiveInt(slaInput[t.key]));

  const saveSla = async () => {
    if (!settings || slaInvalid) return;
    // งานทั่วไป → defaultSlaDays เสมอ และ "ตัดแถว general ใน slaByWorkType ทิ้ง" (ค่าที่ใช้จริงย้ายมาอยู่ defaultSlaDays —
    // แถว general เดิมจะทับ slaByCategory ทุกประเภท การย้ายจึงทำให้ slaByCategory กลับมามีผล ดูหมายเหตุใต้ตาราง)
    // ชนิดอื่น → slaByWorkType เฉพาะที่ต่างจากทะเบียน
    const defaultSlaDays = Number(slaInput.general);
    const slaByWorkType = WORK_TYPES.filter((t) => t.key !== 'general' && Number(slaInput[t.key]) !== t.slaDays).map((t) => ({
      workType: t.key,
      slaDays: Number(slaInput[t.key]),
    }));
    setBusy('sla');
    try {
      const { data } = await axios.put<{ settings: TaskSettings }>('/api/tasks/settings', { defaultSlaDays, slaByWorkType });
      setSettings(data.settings);
      resetSla(data.settings);
      Swal.fire({ icon: 'success', title: 'บันทึกกำหนดปิดแล้ว', text: 'มีผลกับงานที่รับใหม่ — งานเปิดเดิมต้องรันสคริปต์ recompute', timer: 2500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  /* ── ตารางคิวตัดหญ้า — บันทึกทันทีหลังอัปโหลด/ลบ (ส่งเฉพาะ grassSchedule ไม่แตะส่วนอื่นที่ยังไม่บันทึก) ── */
  const putGrassSchedule = async (next: Pick<GrassSchedule, 'url' | 'fileName'>) => {
    const { data } = await axios.put<{ settings: TaskSettings }>('/api/tasks/settings', { grassSchedule: next });
    // อัปเดตเฉพาะ grassSchedule ใน state — วันหยุด/SLA ที่ยังไม่บันทึกยังอยู่ (dirty เทียบกับ settings ส่วนของตัวเอง)
    setSettings((s) => (s ? { ...s, grassSchedule: data.settings.grassSchedule } : data.settings));
  };

  const uploadGrassSchedule = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!okType) {
      Swal.fire({ icon: 'warning', title: 'รองรับเฉพาะรูปภาพหรือ PDF' });
      return;
    }
    if (file.size > MAX_SCHEDULE_BYTES) {
      Swal.fire({ icon: 'warning', title: 'ไฟล์ใหญ่เกิน 10 MB', text: 'ลดขนาดไฟล์ก่อนอัปโหลด' });
      return;
    }
    setBusy('grass');
    try {
      const url = await uploadScheduleFile(file);
      await putGrassSchedule({ url, fileName: file.name });
      Swal.fire({ icon: 'success', title: 'อัปโหลดตารางคิวแล้ว', text: 'เรื่องตัดหญ้าที่ยังไม่ปิดแสดงตารางนี้ทันที', timer: 2200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: errorText(err) ?? (err instanceof Error ? err.message : undefined) });
    } finally {
      setBusy(null);
    }
  };

  const removeGrassSchedule = async () => {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'ลบตารางคิวตัดหญ้า?',
      text: 'เจ้าหน้าที่และประชาชนจะไม่เห็นตารางนี้อีก (ไฟล์บน Cloudinary ไม่ถูกลบ)',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#DC2626',
    });
    if (!isConfirmed) return;
    setBusy('grass');
    try {
      await putGrassSchedule({ url: '', fileName: '' });
      Swal.fire({ icon: 'success', title: 'ลบตารางคิวแล้ว', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  if (!settings) return <p className="py-10 text-center text-[13px] text-tk-ink-5">กำลังโหลด…</p>;

  return (
    <div className="flex flex-col gap-5">
      <Section
        icon={<CalendarDaysIcon className="h-4 w-4" strokeWidth={2} />}
        title="วันหยุดราชการ (ไม่นับเป็นวันทำการ)"
        caption="กำหนดปิดเรื่องนับเฉพาะ จ.–ศ. ที่ไม่อยู่ในรายการนี้ · เกณฑ์กดรับเรื่องภายใน 24 ชม. นับตามนาฬิกาจริง ไม่ข้ามวันหยุด"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-[12.5px] text-tk-ink-4" htmlFor="holiday-year">ปี พ.ศ.</label>
          <select id="holiday-year" value={year} onChange={(e) => setYear(Number(e.target.value))} className={INPUT}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button type="button" onClick={fillFixed} className={clsx(BTN, 'bg-tk-primary-tint text-tk-primary hover:bg-tk-primary-tint-2')}>
            เติมวันหยุดที่วันที่ตายตัวของปี พ.ศ. {year}
          </button>
        </div>
        <p className="mb-3 rounded-[10px] bg-tk-due-soft px-3 py-2 text-[12px] text-tk-due-ink">
          วันหยุดทางจันทรคติ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา) วันหยุดชดเชย และวันหยุดพิเศษตาม ครม. ต้องเพิ่มเอง
        </p>

        {yearHolidays.length === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-tk-ink-5">ยังไม่มีวันหยุดของปี {year}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {yearHolidays.map((h) => (
              <li key={h.date} className="flex items-center gap-2 rounded-[10px] bg-tk-bg px-3 py-1.5">
                <span className="w-[150px] shrink-0 text-[12.5px] font-semibold text-tk-ink">
                  {formatThaiDate(`${h.date}T12:00:00+07:00`)}
                  <span className={clsx('ml-1 text-[11px] font-normal', isWeekend(h.date) ? 'text-tk-ink-6' : 'text-tk-ink-5')}>({weekdayOf(h.date)})</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-tk-ink-3">
                  {h.name || '—'}
                  {isWeekend(h.date) && <span className="ml-1 text-[11px] text-tk-ink-6">· ตรงเสาร์/อาทิตย์ (ถ้ามีวันชดเชยให้เพิ่มเอง)</span>}
                </span>
                <button
                  type="button"
                  aria-label={`ลบ ${h.name || h.date}`}
                  onClick={() => setHolidays(holidays.filter((x) => x.date !== h.date))}
                  className="rounded-[8px] p-1 text-tk-ink-6 hover:bg-tk-overdue-soft hover:text-tk-overdue-ink"
                >
                  <TrashIcon className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-tk-line-light pt-3">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={INPUT} aria-label="วันที่" />
          <input
            type="text"
            value={newName}
            maxLength={100}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อวันหยุด เช่น วันมาฆบูชา"
            className={clsx(INPUT, 'min-w-0 flex-1')}
            aria-label="ชื่อวันหยุด"
          />
          <button type="button" onClick={addHoliday} className={clsx(BTN, 'bg-tk-line-light text-tk-ink-3 hover:bg-tk-line')}>เพิ่มวันหยุด</button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-3">
          {holidaysDirty && <span className="text-[12px] text-tk-due-ink">ยังไม่บันทึก</span>}
          <button type="button" disabled={!holidaysDirty || busy !== null} onClick={saveHolidays} className={clsx(BTN, 'bg-tk-primary text-white hover:bg-tk-primary-dark')}>
            {busy === 'holidays' ? 'กำลังบันทึก…' : 'บันทึกวันหยุด'}
          </button>
        </div>
      </Section>

      <Section
        icon={<ClockIcon className="h-4 w-4" strokeWidth={2} />}
        title="กำหนดปิดเรื่องตามชนิดงาน (วันทำการ)"
        caption="นับจากวันที่ประชาชนแจ้ง (วันแจ้งไม่นับ · แจ้งวันหยุดเริ่มนับวันทำการถัดไป) · เปลี่ยนแล้วมีผลกับงานที่รับใหม่"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11.5px] text-tk-ink-5">
                <th className="py-1.5 pr-2 font-semibold">ชนิดงาน</th>
                <th className="py-1.5 pr-2 font-semibold whitespace-nowrap">ค่าตั้งต้น</th>
                <th className="py-1.5 pr-2 font-semibold whitespace-nowrap">ใช้จริง (วันทำการ)</th>
                <th className="py-1.5 font-semibold whitespace-nowrap">ถ้าแจ้งวันนี้ ครบกำหนด</th>
              </tr>
            </thead>
            <tbody>
              {WORK_TYPES.map((t) => {
                const raw = slaInput[t.key] ?? '';
                const valid = isPositiveInt(raw);
                const preview = valid ? addBusinessDays(new Date(), Number(raw), holidays) : null;
                return (
                  <tr key={t.key} className="border-t border-tk-line-light">
                    <td className="py-1.5 pr-2 text-tk-ink">{t.label}</td>
                    <td className="py-1.5 pr-2 text-tk-ink-5">{t.key === 'general' ? DEFAULT_TASK_SETTINGS.defaultSlaDays : t.slaDays}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={raw}
                        onChange={(e) => setSlaInput((s) => ({ ...s, [t.key]: e.target.value }))}
                        className={clsx(INPUT, 'w-20', !valid && 'border-tk-overdue text-tk-overdue-ink')}
                        aria-label={`กำหนดปิด ${t.label}`}
                      />
                    </td>
                    <td className="py-1.5 whitespace-nowrap text-tk-ink-4">{preview ? formatThaiDate(preview) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {settings.slaByWorkType.some((r) => r.workType === 'general') && (
          <p className="mt-2 text-[11.5px] text-tk-due-ink">
            ตอนนี้งานทั่วไปมีค่าตั้งทับทุกประเภทเรื่อง — กดบันทึกแล้วค่านี้จะย้ายไปเป็นค่าตั้งต้นของงานทั่วไป และค่าแยกตามประเภทเรื่อง (ถ้ามี) จะกลับมามีผล
          </p>
        )}
        {settings.slaByCategory.length > 0 && (
          <p className="mt-2 text-[11.5px] text-tk-ink-5">
            งานทั่วไปบางประเภทเรื่องมีค่าตั้งแยก: {settings.slaByCategory.map((r) => `${r.category} ${r.slaDays} วันทำการ`).join(' · ')}
          </p>
        )}
        <p className="mt-2 text-[11.5px] text-tk-ink-5">
          เตือน &ldquo;ใกล้ครบกำหนด&rdquo; เมื่อเหลือ ≤ {settings.warnBeforeDays} วันทำการ · วันครบกำหนดคำนวณตอนกดรับงาน — งานที่เปิดอยู่แล้วไม่เปลี่ยนเองจนกว่าจะรันสคริปต์ recompute
        </p>
        <div className="mt-3 flex items-center justify-end gap-3">
          {slaInvalid && <span className="text-[12px] text-tk-overdue-ink">ใส่จำนวนเต็ม 1–365</span>}
          {!slaInvalid && slaDirty && <span className="text-[12px] text-tk-due-ink">ยังไม่บันทึก</span>}
          <button type="button" disabled={!slaDirty || slaInvalid || busy !== null} onClick={saveSla} className={clsx(BTN, 'bg-tk-primary text-white hover:bg-tk-primary-dark')}>
            {busy === 'sla' ? 'กำลังบันทึก…' : 'บันทึกกำหนดปิด'}
          </button>
        </div>
      </Section>

      <Section
        icon={<DocumentArrowUpIcon className="h-4 w-4" strokeWidth={2} />}
        title="ตารางคิวตัดหญ้า"
        caption="ใช้แนบให้เรื่องตัดหญ้า และแสดงให้ประชาชนเห็นในหน้าติดตามสถานะ (เฉพาะเรื่องที่ยังไม่ปิด)"
      >
        {settings.grassSchedule?.url ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-tk-bg px-3 py-2">
            <a
              href={settings.grassSchedule.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-[13px] font-semibold text-tk-primary hover:underline"
            >
              {settings.grassSchedule.fileName || 'เปิดไฟล์ตารางคิว'} ↗
            </a>
            {settings.grassSchedule.updatedAt && (
              <span className="text-[11.5px] text-tk-ink-5">อัปเดต {formatThaiDate(settings.grassSchedule.updatedAt)}</span>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={removeGrassSchedule}
              className={clsx(BTN, 'bg-tk-overdue-soft text-tk-overdue-ink hover:opacity-90')}
            >
              ลบตาราง
            </button>
          </div>
        ) : (
          <p className="py-2 text-[12.5px] text-tk-ink-5">ยังไม่มีตารางคิว — เจ้าหน้าที่จะเห็นข้อความให้ติดต่อ superadmin</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <span className="text-[11.5px] text-tk-ink-6">รูปภาพหรือ PDF ไม่เกิน 10 MB · อัปโหลดแล้วบันทึกทันที แทนที่ไฟล์เดิม</span>
          <label className={clsx(BTN, 'cursor-pointer bg-tk-primary text-white hover:bg-tk-primary-dark', busy !== null && 'pointer-events-none opacity-50')}>
            {busy === 'grass' ? 'กำลังอัปโหลด…' : settings.grassSchedule?.url ? 'อัปโหลดไฟล์ใหม่' : 'อัปโหลดตารางคิว'}
            <input type="file" accept="image/*,application/pdf,.pdf" className="hidden" disabled={busy !== null} onChange={uploadGrassSchedule} />
          </label>
        </div>
      </Section>
    </div>
  );
}

function slaInputFor(s: TaskSettings): Record<string, string> {
  return Object.fromEntries(WORK_TYPES.map((t) => [t.key, String(effectiveSla(s, t.key))]));
}

function isPositiveInt(v: string | undefined) {
  const n = Number(v);
  return v !== undefined && v.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 365;
}

/** SLA ที่ใช้จริงของชนิดงาน (ไม่รวม slaByCategory) — งานทั่วไป = override ของ general หรือ defaultSlaDays */
function effectiveSla(s: TaskSettings, key: string): number {
  const override = s.slaByWorkType.find((r) => r.workType === key);
  if (override) return override.slaDays;
  if (key === 'general') return s.defaultSlaDays;
  return WORK_TYPES.find((t) => t.key === key)?.slaDays ?? s.defaultSlaDays;
}

export default TaskSettingsPanel;
