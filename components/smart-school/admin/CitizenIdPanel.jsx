import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cardCls, inputCls, tableHeadCls, successBtnCls } from '@/components/smart-school/adminTheme';
import { normalizeCitizenId, isValidThaiCitizenId } from '@/lib/smart-school/citizenId';

// แท็บ "เลขบัตร" — worklist ให้เจ้าหน้าที่ไล่กรอกเลขบัตร 13 หลักของผู้สมัครปีงบที่เลือก
// Enter = บันทึกแล้วเด้ง focus ไปแถวถัดไป; บันทึกสำเร็จเก็บ masked ใน savedMap
// (ไม่ refetch ทั้งลิสต์ กัน focus หลุด — dashboard refetch เองตอนเปลี่ยนปี/แก้ไขผ่าน modal)
export default function CitizenIdPanel({ rows }) {
  const [savedMap, setSavedMap] = useState({}); // applicantRef -> masked (บันทึกรอบนี้)
  const [errorMap, setErrorMap] = useState({}); // applicantRef -> ข้อความ error
  const [inputMap, setInputMap] = useState({}); // applicantRef -> ค่าที่พิมพ์
  const [savingSet, setSavingSet] = useState(() => new Set()); // applicantRef ที่กำลังบันทึก (กันกดซ้อนรายแถว)
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState('');
  const inputRefs = useRef({});

  // เปลี่ยนปีงบ/refetch แล้วล้าง draft กับ error ค้าง (savedMap คงไว้ — เลขผูกที่ตัวบุคคล ข้ามปีได้)
  useEffect(() => {
    setInputMap({});
    setErrorMap({});
  }, [rows]);

  // 1 คน = 1 แถวต่อปีงบ (unique applicantRef+surveyYear การันตีจาก model)
  const withStatus = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        done: !!savedMap[r.applicantRef] || r.hasCitizenId,
        masked: savedMap[r.applicantRef] || r.citizenIdMasked,
      })),
    [rows, savedMap]
  );
  const doneCount = withStatus.filter((r) => r.done).length;
  const visible = withStatus.filter(
    (r) => (showAll || !r.done) && (!q.trim() || `${r.prefix}${r.name}`.includes(q.trim()))
  );

  const setRowError = (ref, msg) => setErrorMap((m) => ({ ...m, [ref]: msg }));

  const save = async (row) => {
    const id = normalizeCitizenId(inputMap[row.applicantRef] || '');
    if (!isValidThaiCitizenId(id)) {
      setRowError(row.applicantRef, 'เลขไม่ถูกต้อง (ต้องครบ 13 หลักและ checksum ผ่าน)');
      return false;
    }
    setSavingSet((s) => new Set(s).add(row.applicantRef));
    try {
      const res = await fetch('/api/smart-school/citizen-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantRef: row.applicantRef, citizenId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(row.applicantRef, data.message || 'บันทึกไม่สำเร็จ');
        return false;
      }
      setSavedMap((m) => ({ ...m, [row.applicantRef]: data.citizenIdMasked }));
      setRowError(row.applicantRef, null);
      return true;
    } catch {
      setRowError(row.applicantRef, 'เครือข่ายมีปัญหา ลองใหม่อีกครั้ง');
      return false;
    } finally {
      setSavingSet((s) => {
        const n = new Set(s);
        n.delete(row.applicantRef);
        return n;
      });
    }
  };

  // Enter → บันทึก สำเร็จแล้ว focus ช่องของแถวถัดไปที่ยังไม่มีเลข
  const handleKeyDown = async (e, row, idx) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const ok = await save(row);
    if (!ok) return;
    const next = visible.slice(idx + 1).find((r) => !r.done && r.applicantRef !== row.applicantRef);
    if (next) inputRefs.current[next.applicantRef]?.focus();
  };

  return (
    <div className={cardCls + ' p-5 space-y-4'}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[15px] font-bold text-[#211B2E]">🪪 กรอกเลขบัตรประชาชน</div>
        <span className="text-[12.5px] font-semibold text-[#7C3AED] bg-[#EDE7FD] px-2.5 py-1 rounded-full">
          มีเลขแล้ว {doneCount} / {withStatus.length} ราย
        </span>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            className={inputCls + ' !w-48'}
            placeholder="ค้นชื่อ..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-[12.5px] text-[#57506A] cursor-pointer">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-[#E7E2F2] accent-[#7C3AED]"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            แสดงคนที่มีเลขแล้วด้วย
          </label>
        </div>
      </div>

      <div className="text-[12px] text-[#8A8398]">
        กรอกครบ 13 หลักแล้วกด Enter เพื่อบันทึกและไปแถวถัดไป — เลขที่บันทึกแล้วระบบแสดงแบบมาสก์
        (แก้เลขต้องพิมพ์ใหม่ทั้ง 13 หลักผ่านฟอร์มแก้ไข)
      </div>

      {visible.length === 0 ? (
        <div className="text-center text-[13px] text-[#8A8398] py-10">
          {withStatus.length > 0 && doneCount === withStatus.length
            ? '🎉 กรอกเลขบัตรครบทุกรายแล้ว'
            : 'ไม่พบรายการ'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={tableHeadCls}>
                <th className="text-left px-3 py-2 rounded-l-[10px]">ชื่อ-นามสกุล</th>
                <th className="text-left px-3 py-2">โรงเรียน</th>
                <th className="text-left px-3 py-2">ระดับ</th>
                <th className="text-left px-3 py-2 rounded-r-[10px] w-72">เลขบัตรประชาชน</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, idx) => (
                <tr key={row.applicantRef} className="border-b border-[#F1ECFB] hover:bg-white/60">
                  <td className="px-3 py-2 font-medium text-[#211B2E]">{row.prefix}{row.name}</td>
                  <td className="px-3 py-2 text-[#57506A]">{row.schoolName || '-'}</td>
                  <td className="px-3 py-2 text-[#57506A]">{row.educationLevel || '-'}</td>
                  <td className="px-3 py-2">
                    {row.done ? (
                      <span className="text-[#15803D] font-semibold">✓ {row.masked}</span>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => { inputRefs.current[row.applicantRef] = el; }}
                            type="text"
                            inputMode="numeric"
                            className={inputCls + ' !w-44'}
                            placeholder="13 หลัก"
                            value={inputMap[row.applicantRef] || ''}
                            onChange={(e) =>
                              // รับเฉพาะตัวเลข ตัดที่ 13 หลัก — sanitize ใน onChange แทน maxLength
                              // เพื่อให้ paste เลขมีขีด (1-2345-...) ไม่โดน browser ตัดก่อน strip
                              setInputMap((m) => ({
                                ...m,
                                [row.applicantRef]: normalizeCitizenId(e.target.value).slice(0, 13),
                              }))
                            }
                            onKeyDown={(e) => handleKeyDown(e, row, idx)}
                            disabled={savingSet.has(row.applicantRef)}
                          />
                          <button
                            type="button"
                            className={successBtnCls + ' !px-3 !py-1.5 text-[12px]'}
                            onClick={() => save(row)}
                            disabled={savingSet.has(row.applicantRef)}
                          >
                            {savingSet.has(row.applicantRef) ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              'บันทึก'
                            )}
                          </button>
                        </div>
                        {errorMap[row.applicantRef] && (
                          <div className="text-[11.5px] text-[#DC2626]">{errorMap[row.applicantRef]}</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
