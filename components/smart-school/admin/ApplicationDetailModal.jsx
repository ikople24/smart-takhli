import React from 'react';
import Image from 'next/image';
import { statusBadgeCls, ghostBtnCls, primaryBtnCls, FONT_DISPLAY } from '@/components/smart-school/adminTheme';

// ประกาศซ้ำจาก models/smart-school/SchoolApplication.js โดยเจตนา —
// ห้าม import จาก model ใน client component (จะลาก mongoose เข้า browser bundle)
const APPLICATION_STATUSES = ['รับคำร้อง', 'ตรวจสอบแล้ว', 'ได้รับทุน', 'ไม่ผ่านเกณฑ์'];

function Row({ label, value }) {
  return (
    <div className="flex text-[13px] gap-2 py-0.5">
      <span className="w-36 shrink-0 text-[#8A8398]">{label}</span>
      <span className="text-[#211B2E] font-medium break-words">{value ?? '-'}</span>
    </div>
  );
}

function Section({ title, first, children }) {
  return (
    <div className={first ? '' : 'pt-4 border-t border-[#EDE7FD]'}>
      <div className="text-[12px] font-bold text-[#7C3AED] mb-2.5 tracking-wide">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export default function ApplicationDetailModal({ row, onClose, onSetStatus, onEdit, onDelete }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAF8FF] rounded-[24px] shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4" style={{ background: '#7C3AED' }}>
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-white truncate" style={{ fontFamily: FONT_DISPLAY }}>
                {row.applicationId}
              </div>
              <div className="text-[12.5px] text-white/85 truncate">{row.prefix}{row.name}</div>
            </div>
            <span className={statusBadgeCls(row.status) + ' shrink-0'}>{row.status}</span>
          </div>
          <button
            type="button"
            className="shrink-0 text-white/85 hover:text-white transition text-lg leading-none"
            onClick={onClose}
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {row.household?.members?.length > 0 && (
            <div className="rounded-[14px] border border-[#F7DFA4] bg-[#FEF6E4] px-3.5 py-3 text-[12.5px] text-[#92700F]">
              🏠 สมาชิกครัวเรือนเดียวกัน:
              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                {row.household.members.map((m) => (
                  <li key={m.ref}>{m.name} · {m.level || '-'} · {m.status}</li>
                ))}
              </ul>
            </div>
          )}

          <Section title="ข้อมูลการศึกษา" first>
            <Row label="ปีงบประมาณ" value={row.surveyYear} />
            <Row label="ประเภท" value={row.isRenewal ? 'รายเก่า (อัปเดตข้อมูล)' : 'รายใหม่'} />
            <Row label="ระดับการศึกษา" value={row.educationLevel} />
            <Row label="โรงเรียน / ชั้น / GPA"
              value={`${row.schoolName || '-'} / ${row.gradeLevel || '-'} / ${row.gpa ?? '-'}`} />
            <Row label="สถานศึกษา (เกณฑ์)"
              value={`${row.schoolName || '-'} — ${row.schoolEligibility === 'block' ? 'ไม่ผ่าน (เอกชน/นอกเขต) ✗' : 'ok ✓'}`} />
            <Row label="ทะเบียนบ้าน ≥1 ปี"
              value={row.residencyOverOneYear === true ? 'ใช่' : row.residencyOverOneYear === false ? 'ไม่ใช่/ไม่แน่ใจ' : '-'} />
            <Row label="เจ้าหน้าที่ตรวจ"
              value={`ทะเบียนบ้าน ${row.eligibilityChecklist?.residencyVerified ? '✓' : '—'} · โรงเรียน ${row.eligibilityChecklist?.schoolVerified ? '✓' : '—'} · เอกสาร ${row.eligibilityChecklist?.documentsVerified ? '✓' : '—'}`} />
          </Section>

          <Section title="ข้อมูลติดต่อ & ที่อยู่">
            <Row label="เบอร์โทร" value={row.phone} />
            <Row label="เลขบัตรประชาชน" value={row.citizenIdMasked || 'ยังไม่มี'} />
            <Row label="ที่อยู่" value={row.address} />
            <Row label="ที่อยู่จริง" value={row.actualAddress} />
            <Row label="สถานภาพที่อยู่" value={row.housingStatus} />
            <Row label="สมาชิกในบ้าน" value={row.householdMembers} />
            <Row
              label="พิกัด"
              value={
                row.location?.lat != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${row.location.lat},${row.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#7C3AED] hover:underline"
                  >
                    📍 {row.location.lat.toFixed(5)}, {row.location.lng.toFixed(5)} — เปิดแผนที่
                  </a>
                ) : (
                  'ยังไม่มีพิกัด'
                )
              }
            />
          </Section>

          <Section title="ครัวเรือน & รายได้">
            <Row label="รายได้/ปี" value={(row.annualIncome || 0).toLocaleString() + ' บาท'} />
            <Row label="สถานะครอบครัว" value={(row.familyStatus || []).join(', ') || '-'} />
            <Row label="ทุนที่เคยได้ (self-report)" value={(row.takhliScholarshipHistory || []).join(', ') || '-'} />
            <Row label="หมายเหตุ" value={row.note} />
          </Section>

          <Section title="สถานะใบสมัคร & ทุนการศึกษา">
            <Row label="สถานะ"
              value={`${row.status}${row.statusUpdatedBy ? ` (โดย ${row.statusUpdatedBy})` : ''}`} />
            {row.scholarshipAmount != null && (
              <Row label="จำนวนเงินทุน" value={`${row.scholarshipAmount.toLocaleString()} บาท`} />
            )}
          </Section>

          {(row.imageUrl || []).length > 0 && (
            <Section title="รูปภาพ">
              <div className="grid grid-cols-3 gap-2">
                {row.imageUrl.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="relative aspect-square rounded-[10px] overflow-hidden border border-[#E7E2F2]">
                    <Image src={url} alt={`รูปที่ ${i + 1}`} fill className="object-cover" />
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-2.5 px-5 py-4 border-t border-[#EDE7FD] bg-[#FAF8FF] rounded-b-[24px]">
          <select
            className="select select-bordered select-sm rounded-[10px] border-[#E7E2F2] text-[#211B2E] text-[13px] focus:border-[#7C3AED] focus:outline-none"
            value={row.status}
            onChange={(e) => onSetStatus(row, e.target.value)}
          >
            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            type="button"
            className="text-[13px] font-semibold text-[#DC2626] hover:text-[#B91C1C] px-2 transition"
            onClick={() => onDelete(row)}
          >
            ลบใบสมัคร
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className={ghostBtnCls} onClick={onClose}>ปิด</button>
            <button type="button" className={primaryBtnCls} onClick={onEdit}>✎ แก้ไขข้อมูล</button>
          </div>
        </div>
      </div>
    </div>
  );
}
