// components/citizen/report/ConsentCancelSheet.tsx
// แผ่นยืนยันตอนผู้ใช้กด "ไม่ยอมรับ" ในจอข้อตกลง (สไตล์ bottom sheet ตามอาร์ตบอร์ด 1b)
// onBack = กลับไปหน้าข้อตกลง · onConfirm = ยืนยันยกเลิก (ล้างฟอร์ม + กลับหน้าแรก)
import { useEffect, useRef } from "react";
import { CANCEL_SHEET } from "@/lib/citizen/report/consentContent";

export default function ConsentCancelSheet({
  onBack,
  onConfirm,
}: {
  onBack: () => void;
  onConfirm: () => void;
}) {
  const backButtonRef = useRef<HTMLButtonElement>(null);

  // จอนี้อ้างว่าเป็น dialog (role="dialog" aria-modal="true") จึงต้องทำตัวเป็น
  // dialog จริง: จำโฟกัสเดิมไว้คืนตอนปิด, ย้ายโฟกัสไปปุ่มปลอดภัย (กลับไปยอมรับ),
  // และ Esc ต้องเทียบเท่าปุ่ม "กลับไปยอมรับ" (ไม่ใช่ยกเลิกคำร้อง)
  // พ่วงล็อกสกรอลพื้นหลังกันหน้าเลื่อนตามใต้ sheet บน iPhone / LINE in-app browser
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    backButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBack();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onBack]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="ปิด"
        onClick={onBack}
        className="absolute inset-0 bg-[rgba(27,24,48,0.45)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[480px] rounded-t-[22px] bg-white px-[18px] pb-[max(env(safe-area-inset-bottom),28px)] pt-2.5 shadow-[0_-12px_40px_rgba(27,24,48,0.22)]"
      >
        <div className="mx-auto mb-3.5 h-1 w-[42px] rounded-full bg-[#E4DEF2]" />
        <div className="text-[17px] font-bold text-[#1B1830]">{CANCEL_SHEET.title}</div>
        <p className="mt-1.5 text-[12.5px] leading-[1.7] text-[#6B6880]">{CANCEL_SHEET.body}</p>
        <button
          ref={backButtonRef}
          type="button"
          onClick={onBack}
          className="mt-4 w-full rounded-[15px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)]"
        >
          {CANCEL_SHEET.backLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-4 w-full rounded-[15px] bg-[#DC2626] py-3.5 text-[15px] font-semibold text-white"
        >
          {CANCEL_SHEET.confirmLabel}
        </button>
      </div>
    </div>
  );
}
