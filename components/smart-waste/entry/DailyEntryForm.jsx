// components/smart-waste/entry/DailyEntryForm.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { HIGH_KG_WARNING_THRESHOLD, round2 } from '@/lib/smart-waste/aggregate';
import { bangkokToday } from '@/lib/smart-waste/fiscalYear';
import { addDays, draftKey, nextEntryDate, thaiDateLabel } from '@/lib/smart-waste/uiDate';
import { wasteGroupLabel } from '@/lib/smart-waste/wasteGroups';
import { chipCls, inputCls, formatKg } from '../wasteTheme';
import TotalBar from './TotalBar';
import TypePickerSheet from './TypePickerSheet';

// ฟอร์มกรอกน้ำหนักขยะรายวัน (mobile-first) — สเปกข้อ 7.2
// types: รายการประเภททั้งหมดจากหน้าแม่ (ฟอร์มกรองเฉพาะ active เอง)
// initialDate: เปิดที่วันไหน (มาจากแท็บ "ข้อมูล" กดแก้) — ไม่ส่ง = วันนี้
// onSaved(recordDate): แจ้งหน้าแม่ให้ refresh ข้อมูลแท็บอื่น
export default function DailyEntryForm({ types, initialDate, onSaved }) {
  const today = bangkokToday();
  const activeTypes = useMemo(() => types.filter((type) => type.active), [types]);
  const typeByKey = useMemo(() => new Map(types.map((type) => [type.key, type])), [types]);

  const [recordDate, setRecordDate] = useState(initialDate || today);
  const [values, setValues] = useState({});      // typeKey -> string ที่ผู้ใช้พิมพ์
  const [extraKeys, setExtraKeys] = useState([]); // ประเภทนอกชุด isCommon ที่ถูกเพิ่มเข้าฟอร์ม
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState(null); // record เดิมของวันนี้ (null = วันใหม่)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const dirtyRef = useRef(false); // เขียน draft เฉพาะเมื่อผู้ใช้แก้เอง ไม่ใช่ตอนโหลด
  const reqIdRef = useRef(0);

  // เปิดจากแท็บ "ข้อมูล" ด้วยวันอื่น → เปลี่ยนวันตาม
  useEffect(() => {
    if (initialDate) setRecordDate(initialDate);
  }, [initialDate]);

  const commonTypes = useMemo(() => activeTypes.filter((type) => type.isCommon), [activeTypes]);
  const visibleTypes = useMemo(() => {
    const extras = extraKeys
      .map((key) => typeByKey.get(key))
      .filter(Boolean)
      .filter((type) => !type.isCommon);
    return [...commonTypes, ...extras];
  }, [commonTypes, extraKeys, typeByKey]);

  // ยอดรวมโชว์สด — server คำนวณของจริงใหม่เสมอ ตัวนี้เพื่อ UI เท่านั้น
  const totalKg = useMemo(() => {
    let total = 0;
    for (const type of visibleTypes) {
      const kg = Number(values[type.key]);
      if (Number.isFinite(kg) && kg > 0) total = round2(total + kg);
    }
    return total;
  }, [values, visibleTypes]);

  // โหลดข้อมูลของวัน + กู้ draft ถ้ามี (draft ชนะค่าจาก server — มันใหม่กว่าเสมอ
  // เพราะถูกล้างทุกครั้งที่บันทึกสำเร็จ)
  const loadDate = useCallback(async (date) => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    dirtyRef.current = false;
    try {
      const res = await fetch(`/api/smart-waste/daily/${date}`);
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดข้อมูลไม่สำเร็จ');
      const { record } = await res.json();
      if (myId !== reqIdRef.current) return;

      const nextValues = {};
      const nextExtras = [];
      for (const entry of record?.entries || []) {
        nextValues[entry.typeKey] = String(entry.kg);
        const type = typeByKey.get(entry.typeKey);
        if (!type?.isCommon) nextExtras.push(entry.typeKey);
      }
      setExisting(record);
      setNote(record?.note || '');

      let draft = null;
      try {
        draft = JSON.parse(localStorage.getItem(draftKey(date)) || 'null');
      } catch { /* draft พัง → ทิ้ง */ }
      if (draft) {
        setValues(draft.values || {});
        setExtraKeys(draft.extraKeys || nextExtras);
        setNote(draft.note ?? (record?.note || ''));
        dirtyRef.current = true;
        Swal.fire({
          toast: true, position: 'top', icon: 'info', timer: 3500, showConfirmButton: false,
          title: 'กู้ข้อมูลร่างที่ยังไม่ได้บันทึกกลับมาให้แล้ว',
        });
      } else {
        setValues(nextValues);
        setExtraKeys(nextExtras);
      }
    } catch (error) {
      if (myId === reqIdRef.current) {
        Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: error.message });
      }
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [typeByKey]);

  useEffect(() => { loadDate(recordDate); }, [recordDate, loadDate]);

  // draft autosave — เขียนเมื่อผู้ใช้แก้เท่านั้น (สเปกข้อ 7.2: กันเน็ตหลุด/ปิดจอ)
  useEffect(() => {
    if (!dirtyRef.current || loading) return;
    localStorage.setItem(
      draftKey(recordDate),
      JSON.stringify({ values, extraKeys, note })
    );
  }, [values, extraKeys, note, recordDate, loading]);

  const setValue = (typeKey, raw) => {
    dirtyRef.current = true;
    setValues((prev) => ({ ...prev, [typeKey]: raw }));
  };
  const addExtra = (typeKey) => {
    dirtyRef.current = true;
    setExtraKeys((prev) => (prev.includes(typeKey) ? prev : [...prev, typeKey]));
  };
  const removeExtra = (typeKey) => {
    dirtyRef.current = true;
    setExtraKeys((prev) => prev.filter((key) => key !== typeKey));
    setValues((prev) => ({ ...prev, [typeKey]: '' }));
  };

  const handleSave = async () => {
    const entries = visibleTypes
      .map((type) => ({ typeKey: type.key, kg: Number(values[type.key]) }))
      .filter((entry) => Number.isFinite(entry.kg) && entry.kg > 0);

    // ล้างข้อมูลวันเดิม (entries ว่าง + มีของเดิม) — ต้องยืนยันก่อน server จะลบ record
    if (entries.length === 0) {
      if (!existing) {
        Swal.fire({ icon: 'info', title: 'ยังไม่ได้กรอกน้ำหนัก', text: 'ใส่ตัวเลขอย่างน้อย 1 ช่องก่อนบันทึก' });
        return;
      }
      const confirm = await Swal.fire({
        icon: 'warning',
        title: `ล้างข้อมูลของวันที่ ${thaiDateLabel(recordDate)}?`,
        text: `ข้อมูลเดิม ${formatKg(existing.totalKg)} กก. จะถูกลบทั้งวัน`,
        showCancelButton: true, confirmButtonText: 'ล้างข้อมูล', cancelButtonText: 'ยกเลิก',
      });
      if (!confirm.isConfirmed) return;
    }

    // ตัวเลขสูงผิดปกติ (> 1,000 กก./ประเภท/วัน) — เตือนแต่ไม่บล็อก (สเปกข้อ 11)
    const high = entries.filter((entry) => entry.kg > HIGH_KG_WARNING_THRESHOLD);
    if (high.length > 0) {
      const lines = high
        .map((entry) => `${typeByKey.get(entry.typeKey)?.label || entry.typeKey} ${formatKg(entry.kg)} กก.`)
        .join(' · ');
      const confirm = await Swal.fire({
        icon: 'warning', title: 'ตัวเลขสูงผิดปกติ', text: `${lines} — ยืนยันว่าถูกต้อง?`,
        showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'กลับไปแก้',
      });
      if (!confirm.isConfirmed) return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/smart-waste/daily/${recordDate}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, note }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'บันทึกไม่สำเร็จ');
      const data = await res.json();

      // สำเร็จแล้วเท่านั้นจึงล้าง draft — เน็ตหลุด draft ต้องยังอยู่ (สเปกข้อ 11)
      localStorage.removeItem(draftKey(recordDate));
      dirtyRef.current = false;
      onSaved?.(recordDate);

      await Swal.fire({
        toast: true, position: 'top', icon: 'success', timer: 2500, showConfirmButton: false,
        title: data.record
          ? `บันทึก ${thaiDateLabel(recordDate)} รวม ${formatKg(data.record.totalKg)} กก.`
          : `ล้างข้อมูล ${thaiDateLabel(recordDate)} แล้ว`,
      });

      const next = nextEntryDate(recordDate, today);
      if (next !== recordDate) setRecordDate(next);
      else loadDate(recordDate); // ค้างวันเดิม → โหลดใหม่ให้ badge/ค่าตรง server
    } catch (error) {
      // ไม่เคลียร์ฟอร์ม ไม่ล้าง draft — ให้กดส่งซ้ำได้
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      {/* ── เลือกวันที่ ── */}
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <input type="date" value={recordDate} max={today}
          onChange={(e) => e.target.value && setRecordDate(e.target.value)}
          className={inputCls + ' !w-auto'} aria-label="เลือกวันที่บันทึก" />
        <button type="button" className={chipCls(recordDate === today)}
          onClick={() => setRecordDate(today)}>วันนี้</button>
        <button type="button" className={chipCls(recordDate === addDays(today, -1))}
          onClick={() => setRecordDate(addDays(today, -1))}>เมื่อวาน</button>
        <span className="text-[13px] font-semibold text-[#57506A]">📅 {thaiDateLabel(recordDate)}</span>
      </div>
      {existing && !loading && (
        <p className="text-[12px] font-semibold text-[#B45309] bg-[#FEF3C7] rounded-lg px-3 py-1.5 mb-2 w-fit">
          ⚠ วันนี้บันทึกแล้ว ({formatKg(existing.totalKg)} กก.) — กำลังแก้ไข
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : (
        <>
          {/* ── ช่องกรอก: กรอกบ่อยก่อน แล้วตามด้วยประเภทที่เพิ่มเอง ── */}
          <p className="text-[12px] font-bold text-[#57506A] mt-3 mb-2">กรอกบ่อย</p>
          <div className="space-y-2">
            {visibleTypes.map((type) => (
              <div key={type.key} className="flex items-center gap-2">
                <label htmlFor={`kg-${type.key}`}
                  className="flex-1 min-w-0 text-[13.5px] font-medium text-[#211B2E] truncate">
                  {type.label}
                  {!type.isCommon && (
                    <span className="ml-1.5 text-[11px] text-[#8A8398]">({wasteGroupLabel(type.group)})</span>
                  )}
                </label>
                {!type.isCommon && (
                  <button type="button" onClick={() => removeExtra(type.key)}
                    aria-label={`เอา ${type.label} ออก`}
                    className="text-[#B9B0C9] hover:text-[#e34948] text-[15px] px-1">✕</button>
                )}
                <input id={`kg-${type.key}`} inputMode="decimal" placeholder="0"
                  value={values[type.key] ?? ''}
                  onChange={(e) => setValue(type.key, e.target.value)}
                  className={inputCls + ' !w-[110px] text-right'} />
                <span className="text-[12px] text-[#8A8398] w-6">กก.</span>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setSheetOpen(true)}
            className="mt-3 w-full rounded-[14px] border-[1.5px] border-dashed border-[#C9BCE8]
              py-3 text-[13.5px] font-semibold text-[#7C3AED] hover:bg-[#F1ECFB] transition">
            + เพิ่มประเภทอื่น
          </button>

          <div className="mt-4">
            <label htmlFor="waste-note" className="text-[12px] font-bold text-[#57506A]">หมายเหตุ (ถ้ามี)</label>
            <input id="waste-note" value={note} maxLength={500}
              onChange={(e) => { dirtyRef.current = true; setNote(e.target.value); }}
              placeholder="เช่น วันหยุดไม่มีการคัดแยก" className={inputCls + ' mt-1.5'} />
          </div>

          <div className="h-4" />
          <TotalBar totalKg={totalKg} saving={saving} editing={Boolean(existing)} onSave={handleSave} />
        </>
      )}

      <TypePickerSheet open={sheetOpen} onClose={() => setSheetOpen(false)}
        types={activeTypes.filter((type) => !type.isCommon)}
        selectedKeys={extraKeys} onPick={addExtra} />
    </div>
  );
}
