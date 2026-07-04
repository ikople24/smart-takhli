import React from 'react';
import Image from 'next/image';

// ประกาศซ้ำจาก models/smart-school/SchoolApplication.js โดยเจตนา —
// ห้าม import จาก model ใน client component (จะลาก mongoose เข้า browser bundle)
const APPLICATION_STATUSES = ['รับคำร้อง', 'ตรวจสอบแล้ว', 'ได้รับทุน', 'ไม่ผ่านเกณฑ์'];

function Row({ label, value }) {
  return (
    <div className="flex text-sm gap-2">
      <span className="w-36 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-800 break-words">{value ?? '-'}</span>
    </div>
  );
}

export default function ApplicationDetailModal({ row, onClose, onSetStatus, onEdit, onDelete }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-800">
            {row.applicationId} — {row.prefix}{row.name}
          </h2>
          <button className="text-gray-400 hover:text-gray-600" onClick={onClose}>✕</button>
        </div>

        <div className="p-4 space-y-4">
          {row.household?.members?.length > 0 && (
            <div className="alert alert-warning text-xs">
              🏠 สมาชิกครัวเรือนเดียวกัน:
              <ul className="list-disc ml-4">
                {row.household.members.map((m) => (
                  <li key={m.ref}>{m.name} · {m.level || '-'} · {m.status}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
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
            <Row label="เบอร์โทร" value={row.phone} />
            <Row label="ที่อยู่" value={row.address} />
            <Row label="ที่อยู่จริง" value={row.actualAddress} />
            <Row label="สถานภาพที่อยู่" value={row.housingStatus} />
            <Row label="สมาชิกในบ้าน" value={row.householdMembers} />
            <Row label="รายได้/ปี" value={(row.annualIncome || 0).toLocaleString() + ' บาท'} />
            <Row label="สถานะครอบครัว" value={(row.familyStatus || []).join(', ') || '-'} />
            <Row label="ทุนที่เคยได้ (self-report)" value={(row.takhliScholarshipHistory || []).join(', ') || '-'} />
            <Row label="หมายเหตุ" value={row.note} />
            <Row label="สถานะ"
              value={`${row.status}${row.statusUpdatedBy ? ` (โดย ${row.statusUpdatedBy})` : ''}`} />
            {row.scholarshipAmount != null && (
              <Row label="จำนวนเงินทุน" value={`${row.scholarshipAmount.toLocaleString()} บาท`} />
            )}
          </div>

          {(row.imageUrl || []).length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {row.imageUrl.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer"
                  className="relative aspect-square rounded overflow-hidden border">
                  <Image src={url} alt={`รูปที่ ${i + 1}`} fill className="object-cover" />
                </a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center border-t pt-3">
            <select className="select select-bordered select-sm" value={row.status}
              onChange={(e) => onSetStatus(row, e.target.value)}>
              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-sm btn-primary" onClick={onEdit}>แก้ไขข้อมูล</button>
            <button className="btn btn-sm btn-error btn-outline ml-auto" onClick={() => onDelete(row)}>
              ลบใบสมัคร
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
