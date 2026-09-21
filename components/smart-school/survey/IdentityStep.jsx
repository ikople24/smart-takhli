import React, { useRef, useState } from 'react';
import {
  StepHeader,
  inputCls,
  primaryBtnCls,
  FONT_DISPLAY,
} from './surveyTheme';

// ขั้นที่ 1: ระบุตัวตน — ค้นด้วยชื่อ (ไม่ใช้เลขบัตร; เจ้าหน้าที่ยืนยันเอกสารเอง)
// 3 หน้าจอย่อย: เลือกราย (choose) → ค้นหา (search) → ยืนยัน 4 ตัวท้าย (verify)
export default function IdentityStep({ onDone, onClose, disabled }) {
  const [screen, setScreen] = useState('choose'); // choose | search | verify
  const [mode, setMode] = useState('new'); // new | renewal
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null | []
  const [selected, setSelected] = useState(null); // ผลลัพธ์ที่เลือก
  const [phoneLast4, setPhoneLast4] = useState('');
  const otpRefs = useRef([]);

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

  const startNew = () => onDone({ ref: null, applicant: null, prevApplication: null });

  const goSearch = () => {
    setError('');
    setSearchResults(null);
    setSelected(null);
    setPhoneLast4('');
    setScreen('search');
  };

  const handleSearchName = async () => {
    setError('');
    setSelected(null);
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { name: searchName });
    setLoading(false);
    if (!ok) return setError(data.message || 'เกิดข้อผิดพลาด');
    setSearchResults(data.results || []);
  };

  const pickResult = (r) => {
    setSelected(r);
    setPhoneLast4('');
    setError('');
    setScreen('verify');
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  };

  // ยืนยันด้วย 4 ตัวท้าย → ดึงข้อมูลใบล่าสุดมา prefill
  const handlePickPrev = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/prefill', { ref: selected.ref, phoneLast4 });
    setLoading(false);
    if (!ok) return setError(data.message || 'ดึงข้อมูลไม่สำเร็จ');
    onDone({ ref: data.applicant.ref, applicant: data.applicant, prevApplication: data.application });
  };

  const setOtp = (i, char) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const chars = phoneLast4.padEnd(4, ' ').split('');
    chars[i] = digit || ' ';
    setPhoneLast4(chars.join('').replace(/ /g, ''));
    if (digit && i < 3) otpRefs.current[i + 1]?.focus();
  };

  const otpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !phoneLast4[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const IdentityCard = ({ active, onSelect, icon, iconBg, iconColor, title, sub }) => (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || loading}
      className={
        'w-full text-left rounded-[18px] p-4 transition ' +
        (active
          ? 'border-2 border-[#7C3AED] bg-white shadow-[0_8px_20px_-12px_rgba(124,58,237,0.5)]'
          : 'border-[1.5px] border-[#E7E2F2] bg-white hover:border-[#C9BCEE]')
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-[12px] text-lg"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </span>
        <div className="flex-1">
          <div className="text-[15px] font-bold text-[#211B2E]">{title}</div>
          <div className="text-[11px] text-[#8A8398]">{sub}</div>
        </div>
        <span
          className={
            'grid h-5 w-5 place-items-center rounded-full text-[12px] transition ' +
            (active ? 'bg-[#7C3AED] text-white' : 'bg-[#EDE7FD] text-transparent')
          }
        >
          ✓
        </span>
      </div>
    </button>
  );

  // ---------- หน้าจอ: เลือกราย ----------
  if (screen === 'choose') {
    return (
      <>
        <StepHeader
          eyebrow="เทศบาลเมืองตาคลี · ทุนการศึกษา"
          title="แบบสำรวจการศึกษา"
          step={1}
          subtitle="ขั้นที่ 1 จาก 3 · ระบุตัวตน"
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="rounded-[14px] bg-[#EDE7FD] px-3.5 py-3 text-[12px] leading-relaxed text-[#5B21B6]">
            กรอกข้อมูลตามจริง เจ้าหน้าที่จะตรวจสอบคุณสมบัติและเอกสารอีกครั้ง
          </div>
          <div className="text-[14px] font-bold text-[#211B2E]">ท่านเคยยื่นแบบสำรวจนี้ไหม?</div>
          <IdentityCard
            active={mode === 'new'}
            onSelect={() => setMode('new')}
            icon="✎"
            iconBg="#7C3AED"
            iconColor="#fff"
            title="รายใหม่"
            sub="ยื่นครั้งแรก"
          />
          <IdentityCard
            active={mode === 'renewal'}
            onSelect={() => setMode('renewal')}
            icon="↻"
            iconBg="#F1ECFB"
            iconColor="#7C3AED"
            title="รายเก่า"
            sub="เคยยื่นแล้ว · ดึงข้อมูลเดิม"
          />
          {error && <p className="text-[12px] text-[#B91C1C]">{error}</p>}
        </div>
        <div className="shrink-0 px-5 pb-5 pt-3">
          <button
            type="button"
            className={primaryBtnCls + ' w-full'}
            disabled={disabled || loading}
            onClick={() => (mode === 'new' ? startNew() : goSearch())}
          >
            ถัดไป →
          </button>
        </div>
      </>
    );
  }

  // ---------- หน้าจอ: ค้นหา ----------
  if (screen === 'search') {
    return (
      <>
        <StepHeader
          title="ค้นหาข้อมูลเดิม"
          subtitle="รายเก่า · ค้นด้วยชื่อ-นามสกุล"
          onBack={() => setScreen('choose')}
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="rounded-[14px] bg-[#EDE7FD] px-3.5 py-3 text-[12px] leading-relaxed text-[#5B21B6]">
            พิมพ์ชื่อ-นามสกุลที่เคยยื่นไว้ ระบบจะแสดงรายการที่ตรงกับชื่อ
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-[14px] border-[1.5px] border-[#E7E2F2] bg-white px-3.5 py-2.5 focus-within:border-[#7C3AED] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition">
              <span className="text-[15px] text-[#8A8398]">🔍</span>
              <input
                type="text"
                className="min-w-0 flex-1 border-none bg-transparent text-[16px] sm:text-[13px] text-[#211B2E] outline-none placeholder:text-[#B9B0C9]"
                placeholder="ชื่อ-นามสกุล"
                value={searchName}
                disabled={disabled}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchName.trim().length >= 2 && handleSearchName()}
              />
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center rounded-[14px] bg-[#7C3AED] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_20px_-10px_rgba(124,58,237,0.6)] transition hover:bg-[#6D28D9] disabled:opacity-60 disabled:shadow-none"
              disabled={searchName.trim().length < 2 || loading || disabled}
              onClick={handleSearchName}
            >
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'ค้นหา'}
            </button>
          </div>

          {searchResults && searchResults.length > 0 && (
            <>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#8A8398]">
                พบ {searchResults.length} รายการ · ข้อมูลถูกปิดบางส่วน
              </div>
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <button
                    key={r.ref}
                    type="button"
                    onClick={() => pickResult(r)}
                    className="flex w-full items-center gap-3 rounded-[16px] border-[1.5px] border-[#E7E2F2] bg-white p-3.5 text-left transition hover:border-[#7C3AED]"
                  >
                    <span className="grid h-[42px] w-[42px] place-items-center rounded-[12px] bg-[#EDE7FD] text-[22px]">
                      🧒
                    </span>
                    <div className="flex-1">
                      <div className="text-[14px] font-bold text-[#211B2E]">{r.maskedName}</div>
                      <div className="mt-0.5 text-[11px] text-[#8A8398]">
                        {[r.lastYear ? `ปีงบ ${r.lastYear}` : null, r.level || null, r.maskedPhone ? `📞 ${r.maskedPhone}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <span className="text-[14px] text-[#C9BCEE]">›</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {searchResults && searchResults.length === 0 && (
            <p className="text-center text-[12px] text-[#8A8398]">ไม่พบรายการที่ตรงกับชื่อนี้</p>
          )}
          {error && <p className="text-[12px] text-[#B91C1C]">{error}</p>}

          <div className="text-center text-[11px] text-[#8A8398]">
            ไม่พบข้อมูล?{' '}
            <button
              type="button"
              onClick={startNew}
              disabled={disabled || loading}
              className="font-semibold text-[#7C3AED] hover:underline"
            >
              ยื่นเป็นรายใหม่แทน
            </button>
          </div>
        </div>
      </>
    );
  }

  // ---------- หน้าจอ: ยืนยันตัวตน ----------
  return (
    <>
      <StepHeader
        title="ยืนยันตัวตน"
        subtitle="กรอกเลข 4 ตัวท้ายของเบอร์โทรที่เคยยื่น"
        onBack={() => setScreen('search')}
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="flex items-center gap-3 rounded-[14px] bg-[#F6F3FD] px-3.5 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-[#EDE7FD] text-xl">🧒</span>
          <div>
            <div className="text-[13px] font-bold text-[#211B2E]">{selected?.maskedName}</div>
            <div className="text-[11px] text-[#8A8398]">
              {[selected?.lastYear ? `ปีงบ ${selected.lastYear}` : null, selected?.level || null, selected?.maskedPhone ? `📞 ${selected.maskedPhone}` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>

        <div className="text-[12px] font-bold text-[#57506A]">เลข 4 ตัวท้ายเบอร์โทร</div>
        {selected?.maskedPhone && (
          <p className="text-center text-[12px] text-[#57506A]">
            เบอร์ที่เคยให้ไว้{' '}
            <span className="font-bold text-[#7C3AED]" style={{ fontFamily: FONT_DISPLAY }}>
              {selected.maskedPhone}
            </span>{' '}
            — กรอก 4 ตัวท้าย
          </p>
        )}
        <div className="flex justify-center gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              ref={(el) => (otpRefs.current[i] = el)}
              inputMode="numeric"
              maxLength={1}
              value={phoneLast4[i] || ''}
              disabled={disabled}
              onChange={(e) => setOtp(i, e.target.value)}
              onKeyDown={(e) => otpKeyDown(i, e)}
              style={{ fontFamily: FONT_DISPLAY }}
              className={
                'h-[60px] w-[52px] rounded-[14px] border-[1.5px] bg-white text-center text-2xl font-bold text-[#211B2E] outline-none transition ' +
                (phoneLast4[i]
                  ? 'border-[#7C3AED] shadow-[0_0_0_3px_rgba(124,58,237,0.12)]'
                  : 'border-[#E7E2F2] focus:border-[#7C3AED] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)]')
              }
            />
          ))}
        </div>
        <p className="text-center text-[11px] text-[#8A8398]">
          เพื่อความปลอดภัยของข้อมูลผู้ขอทุน
        </p>
        {error && <p className="text-center text-[12px] text-[#B91C1C]">{error}</p>}
        <div className="text-center text-[11px] text-[#8A8398]">
          จำเบอร์ไม่ได้?{' '}
          <button
            type="button"
            onClick={startNew}
            disabled={disabled || loading}
            className="font-semibold text-[#7C3AED] hover:underline"
          >
            ยื่นเป็นรายใหม่แทน
          </button>
        </div>
      </div>
      <div className="shrink-0 px-5 pb-5 pt-3">
        <button
          type="button"
          className={primaryBtnCls + ' w-full'}
          disabled={phoneLast4.length !== 4 || loading || disabled}
          onClick={handlePickPrev}
        >
          {loading ? <span className="loading loading-spinner loading-sm" /> : '🔒 ดึงข้อมูลเข้าฟอร์ม'}
        </button>
      </div>
    </>
  );
}
