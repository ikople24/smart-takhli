// components/citizen/report/WizardFooter.tsx
// แถบปุ่มล่างของ wizard: ย้อนกลับ (ถ้ามี) + ปุ่มหลัก gradient
export default function WizardFooter({
  onBack,
  onNext,
  nextLabel = "ถัดไป",
  disabled = false,
  loading = false,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-20 flex shrink-0 gap-2.5 border-t border-[#EFEDF4] bg-white px-4 pb-7 pt-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-[108px] rounded-[15px] bg-[#F1ECFE] py-3.5 text-center text-[15px] font-semibold text-[#7C3AED]"
        >
          ย้อนกลับ
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || loading}
        className="flex-1 rounded-[15px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] py-3.5 text-center text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)] disabled:opacity-60"
      >
        {loading ? "กำลังส่ง…" : nextLabel}
      </button>
    </div>
  );
}
