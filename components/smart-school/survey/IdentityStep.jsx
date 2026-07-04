import React, { useState } from 'react';

// ขั้นที่ 1: ระบุตัวตน — ค้นด้วยชื่อ (ไม่ใช้เลขบัตร; เจ้าหน้าที่ยืนยันเอกสารเอง)
export default function IdentityStep({ onDone, disabled }) {
  const [mode, setMode] = useState(null); // 'new' | 'renewal'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null | []
  const [selectedRef, setSelectedRef] = useState(null);

  const post = async (url, body) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: { message: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' } };
    }
  };

  const handleSearchName = async () => {
    setError('');
    setSelectedRef(null);
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { name: searchName });
    setLoading(false);
    if (!ok) return setError(data.message || 'เกิดข้อผิดพลาด');
    setSearchResults(data.results || []);
  };

  // เลือกรายการ → ดึงข้อมูลใบล่าสุดมา prefill
  const handlePickPrev = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/prefill', { ref: selectedRef });
    setLoading(false);
    if (!ok) return setError(data.message || 'ดึงข้อมูลไม่สำเร็จ');
    onDone({ ref: data.applicant.ref, applicant: data.applicant, prevApplication: data.application });
  };

  return (
    <div className="space-y-4">
      <div className="alert alert-info text-xs">
        กรอกข้อมูลตามจริง เจ้าหน้าที่จะตรวจสอบคุณสมบัติและเอกสารอีกครั้ง
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">ท่านเคยยื่นแบบสำรวจนี้มาก่อนหรือไม่</label>
        <div className="flex gap-2 justify-center">
          <button type="button" disabled={disabled || loading}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'new' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('new'); setSearchResults(null); setSelectedRef(null); setError(''); }}>
            รายใหม่ (ครั้งแรก)
          </button>
          <button type="button" disabled={disabled || loading}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'renewal' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('renewal'); setSearchResults(null); setSelectedRef(null); setError(''); }}>
            รายเก่า (เคยยื่นแล้ว)
          </button>
        </div>
      </div>

      {mode === 'new' && (
        <button type="button" className="btn btn-primary w-full" disabled={loading || disabled}
          onClick={() => onDone({ ref: null, applicant: null, prevApplication: null })}>
          ถัดไป
        </button>
      )}

      {mode === 'renewal' && (
        <div className="card bg-base-200 p-3 space-y-2">
          <label className="text-sm text-gray-600">ค้นด้วยชื่อ-นามสกุลที่เคยยื่น</label>
          <div className="flex gap-2">
            <input type="text" className="input input-bordered input-sm flex-1"
              placeholder="ชื่อ-นามสกุล" value={searchName} disabled={disabled}
              onChange={(e) => setSearchName(e.target.value)} />
            <button type="button" className="btn btn-sm btn-primary"
              disabled={searchName.trim().length < 2 || loading || disabled}
              onClick={handleSearchName}>
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'ค้นหา'}
            </button>
          </div>

          {searchResults && searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((r) => (
                <label key={r.ref} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" className="radio radio-sm" name="pick"
                    checked={selectedRef === r.ref} onChange={() => setSelectedRef(r.ref)} />
                  {r.maskedName}
                  {r.level ? ` · ${r.level}` : ''}
                  {r.lastYear ? ` · ปีงบ ${r.lastYear}` : ''}
                </label>
              ))}
              <button type="button" className="btn btn-success btn-sm w-full"
                disabled={!selectedRef || loading || disabled} onClick={handlePickPrev}>
                ใช่ ข้อมูลของฉัน — ดึงข้อมูลเดิมมาแก้ไข
              </button>
            </div>
          )}
          {searchResults && searchResults.length === 0 && (
            <p className="text-xs text-gray-500">ไม่พบรายการ</p>
          )}

          <button type="button" className="btn btn-outline btn-sm w-full" disabled={loading || disabled}
            onClick={() => onDone({ ref: null, applicant: null, prevApplication: null })}>
            หาไม่เจอ — ยื่นเป็นรายใหม่
          </button>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
