// components/citizen/report/WizardHeader.tsx
// หัว wizard: ปุ่มย้อน + ชื่อขั้น + "ขั้นที่ N จาก 3 · <คำโปรย>" + progress 3 ท่อน
export default function WizardHeader({
  step,
  title,
  hint,
  onBack,
}: {
  step: 1 | 2 | 3;
  title: string;
  hint: string;
  onBack: () => void;
}) {
  return (
    <div className="shrink-0 px-4 pb-3.5 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="ย้อนกลับ"
          className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white shadow-[0_2px_8px_rgba(60,40,100,0.06)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4458" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-bold leading-tight">{title}</div>
          <div className="text-[11px] text-[#9590A8]">
            ขั้นที่ {step} จาก 3 · {hint}
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-[5px] flex-1 rounded-full" style={{ background: n <= step ? "#7C3AED" : "#E4DEF2" }} />
        ))}
      </div>
    </div>
  );
}
