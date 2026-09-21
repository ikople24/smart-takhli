// components/smart-waste/admin/TypeManagerModal.jsx
import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { WASTE_GROUPS, wasteGroupLabel } from '@/lib/smart-waste/wasteGroups';
import { chipCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, tableHeadCls, formatKg } from '../wasteTheme';

// สร้าง key เริ่มต้นจาก label — label ไทยล้วนจะได้ '' (ผู้ใช้ต้องตั้ง key อังกฤษเอง)
// กติกาเดียวกับ slugify ฝั่ง server ใน pages/api/smart-waste/types/index.js
function slugify(label) {
  return String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function patchType(id, body) {
  const res = await fetch(`/api/smart-waste/types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).message || 'บันทึกไม่สำเร็จ');
}

export default function TypeManagerModal({ open, onClose, onChanged, isSuperAdmin }) {
  const [tab, setTab] = useState('types'); // 'types' | 'import'
  const [types, setTypes] = useState(null);
  // ฟอร์มเพิ่มประเภท — keyTouched: ผู้ใช้แก้ key เองแล้ว หยุด auto-gen จาก label
  const [form, setForm] = useState({ label: '', key: '', group: WASTE_GROUPS[0].key, keyTouched: false });
  // แท็บนำเข้า
  const [file, setFile] = useState(null);
  const [dryResult, setDryResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/smart-waste/types?includeInactive=1');
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดไม่สำเร็จ');
      setTypes((await res.json()).types);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'โหลดประเภทขยะไม่สำเร็จ', text: error.message });
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTab('types');
      setTypes(null);
      setDryResult(null);
      setFile(null);
      fetchTypes();
    }
  }, [open, fetchTypes]);

  if (!open) return null;

  const mutate = async (action) => {
    try {
      await action();
      await fetchTypes();
      onChanged();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: error.message });
    }
  };

  const handleToggle = (type, field) => mutate(() => patchType(type.id, { [field]: !type[field] }));

  const handleEditLabel = async (type) => {
    const { value, isConfirmed } = await Swal.fire({
      title: 'แก้ชื่อประเภท',
      input: 'text', inputValue: type.label,
      text: `key: ${type.key} (แก้ไม่ได้) · ชื่อใหม่มีผลย้อนหลังทุกรายงาน`,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
      inputValidator: (v) => (!v?.trim() ? 'ชื่อว่างไม่ได้' : undefined),
    });
    if (isConfirmed) await mutate(() => patchType(type.id, { label: value.trim() }));
  };

  const handleDelete = async (type) => {
    const confirm = await Swal.fire({
      icon: 'warning', title: `ลบ "${type.label}"?`,
      text: 'ลบได้เฉพาะประเภทที่ไม่มีข้อมูลอ้างถึง — ลบแล้วกู้คืนไม่ได้',
      showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก',
    });
    if (!confirm.isConfirmed) return;
    await mutate(async () => {
      const res = await fetch(`/api/smart-waste/types/${type.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).message || 'ลบไม่สำเร็จ');
    });
  };

  const handleCreate = async () => {
    await mutate(async () => {
      const res = await fetch('/api/smart-waste/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.label, key: form.key, group: form.group }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'เพิ่มไม่สำเร็จ');
      setForm({ label: '', key: '', group: WASTE_GROUPS[0].key, keyTouched: false });
    });
  };

  // นำเข้า: dry-run ก่อนเสมอ → ผู้ใช้เห็นผลตรวจแล้วจึงยืนยันของจริง (สเปกข้อ 9)
  const postImport = async (dryRun) => {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(`/api/smart-waste/import${dryRun ? '?dryRun=1' : ''}`, {
      method: 'POST', body,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'นำเข้าไม่สำเร็จ');
    return json;
  };

  const handleDryRun = async () => {
    if (!file) return;
    setImporting(true);
    setDryResult(null);
    try {
      setDryResult(await postImport(true));
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'ตรวจไฟล์ไม่ผ่าน', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await postImport(false);
      setDryResult(null);
      setFile(null);
      onChanged();
      Swal.fire({
        icon: 'success', title: `นำเข้าปีงบ ${result.fiscalYear} สำเร็จ`,
        text: `เพิ่มใหม่ ${result.inserted} วัน · อัปเดต ${result.updated} วัน · ทับข้อมูลเดิม ${result.overwritten} วัน`,
      });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: error.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-3xl max-h-[90vh] bg-white rounded-t-[24px]
        sm:rounded-[24px] flex flex-col">
        <div className="flex items-center justify-between p-4 pb-3 border-b border-[#E7E2F2]">
          <p className="text-[15px] font-bold text-[#211B2E]">⚙️ จัดการประเภทขยะ</p>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <>
                <button type="button" className={chipCls(tab === 'types')} onClick={() => setTab('types')}>ประเภท</button>
                <button type="button" className={chipCls(tab === 'import')} onClick={() => setTab('import')}>นำเข้าข้อมูลเก่า</button>
              </>
            )}
            <button type="button" onClick={onClose} aria-label="ปิด"
              className="grid h-8 w-8 place-items-center rounded-full text-[#8A8398] hover:bg-[#F1ECFB]">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'types' ? (
            !types ? (
              <div className="flex justify-center py-12">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-[#E7E2F2] rounded-[16px]">
                  <table className="text-[12.5px] min-w-full whitespace-nowrap">
                    <thead>
                      <tr className={tableHeadCls}>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">ประเภท</th>
                        <th className="px-3 py-2 text-left">กลุ่ม</th>
                        <th className="px-3 py-2 text-center" title="เด้งขึ้นหน้าแรกของฟอร์ม">กรอกบ่อย</th>
                        <th className="px-3 py-2 text-center" title="StatCard + แถวเฉพาะใน Excel">สนใจพิเศษ</th>
                        <th className="px-3 py-2 text-center">ใช้งาน</th>
                        <th className="px-3 py-2 text-right">มีข้อมูล (วัน)</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((type) => (
                        <tr key={type.id} className={'border-b border-[#F1ECFB] ' + (type.active ? '' : 'opacity-50')}>
                          <td className="px-3 py-2 text-[#8A8398]">{type.order}</td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => handleEditLabel(type)}
                              className="font-semibold text-[#211B2E] hover:text-[#7C3AED]"
                              title={`key: ${type.key} · คลิกเพื่อแก้ชื่อ`}>
                              {type.label} ✏️
                            </button>
                          </td>
                          <td className="px-3 py-2 text-[#57506A]">{wasteGroupLabel(type.group)}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
                              checked={type.isCommon} onChange={() => handleToggle(type, 'isCommon')} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
                              checked={type.isHighlighted} onChange={() => handleToggle(type, 'isHighlighted')} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" className="toggle toggle-sm toggle-primary"
                              checked={type.active} onChange={() => handleToggle(type, 'active')} />
                          </td>
                          <td className="px-3 py-2 text-right">{type.usedDays ? formatKg(type.usedDays) : '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => handleDelete(type)}
                              disabled={type.usedDays > 0}
                              title={type.usedDays > 0 ? 'มีข้อมูลใช้งานอยู่ ปิดใช้งานแทนได้' : 'ลบประเภทนี้'}
                              className="text-[#e34948] disabled:text-[#D9D4E4] disabled:cursor-not-allowed">
                              🗑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── เพิ่มประเภทใหม่ — key ล็อกถาวรหลังบันทึก (สเปกข้อ 7.5) ── */}
                <div className="border border-dashed border-[#C9BCE8] rounded-[16px] p-4 space-y-3">
                  <p className="text-[13px] font-bold text-[#57506A]">+ เพิ่มประเภทใหม่</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>ชื่อประเภท (ไทย)</label>
                      <input value={form.label} className={inputCls} placeholder="เช่น ทองแดง"
                        onChange={(e) => setForm((f) => ({
                          ...f, label: e.target.value,
                          key: f.keyTouched ? f.key : slugify(e.target.value),
                        }))} />
                    </div>
                    <div>
                      <label className={labelCls}>key (a-z, 0-9, _ — ล็อกถาวรหลังบันทึก)</label>
                      <input value={form.key} className={inputCls} placeholder="เช่น copper"
                        onChange={(e) => setForm((f) => ({ ...f, key: e.target.value, keyTouched: true }))} />
                    </div>
                    <div>
                      <label className={labelCls}>กลุ่มรายงาน</label>
                      <select value={form.group} className={inputCls}
                        onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}>
                        {WASTE_GROUPS.map((g) => (
                          <option key={g.key} value={g.key}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="button" onClick={handleCreate}
                    disabled={!form.label.trim() || !/^[a-z][a-z0-9_]*$/.test(form.key)}
                    className={primaryBtnCls + ' !py-2.5'}>
                    เพิ่มประเภท
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ── แท็บนำเข้าข้อมูลเก่า (superadmin) — สเปกข้อ 9 ── */
            <div className="space-y-4 max-w-lg">
              <p className="text-[12.5px] text-[#57506A] leading-relaxed">
                อัปโหลดไฟล์ Excel รายปีงบ (รูปแบบเดิมของกองสาธารณสุข) — ระบบอ่านปีงบจากชื่อชีตเอง
                ตรวจยอดกับแถว "รวม" ทุกเดือนก่อน ไม่ตรง = ไม่บันทึกเลยทั้งไฟล์ · อัปโหลดซ้ำได้ (ทับตามวันที่)
              </p>
              <input type="file" accept=".xlsx" className="file-input file-input-bordered w-full"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setDryResult(null); }} />
              <button type="button" onClick={handleDryRun} disabled={!file || importing}
                className={ghostBtnCls + ' !py-2.5'}>
                {importing && !dryResult ? 'กำลังตรวจ…' : '1) ตรวจไฟล์ก่อน (ยังไม่บันทึก)'}
              </button>

              {dryResult && (
                <div className="border border-[#E7E2F2] rounded-[16px] p-4 space-y-2 text-[12.5px]">
                  <p className="font-bold text-[#15803D]">✓ ยอดตรงกับแถว "รวม" ของไฟล์ทุกเดือน</p>
                  <p>ปีงบ <b>{dryResult.fiscalYear}</b> · รวม <b>{formatKg(dryResult.verification.totalKg)} กก.</b></p>
                  <p>วันที่มีข้อมูลในระบบแล้ว {dryResult.existingDays} วัน
                    · จะถูกทับด้วยยอดใหม่ {dryResult.willOverwrite.length} วัน</p>
                  {dryResult.willOverwrite.length > 0 && (
                    <ul className="text-[#B45309] max-h-32 overflow-y-auto list-disc pl-5">
                      {dryResult.willOverwrite.map((row) => (
                        <li key={row.recordDate}>
                          {row.recordDate}: {formatKg(row.from)} → {formatKg(row.to)} กก.
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" onClick={handleImport} disabled={importing}
                    className={primaryBtnCls + ' !py-2.5 mt-2'}>
                    {importing ? 'กำลังนำเข้า…' : '2) ยืนยันนำเข้าจริง'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
