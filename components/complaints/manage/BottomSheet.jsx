// components/complaints/manage/BottomSheet.jsx
// bottom sheet บนมือถือ / dialog กลางจอบน md+ — pattern เดียวกับ components/tasks/QuickTaskSheet.tsx
import { useEffect, useId, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function BottomSheet({ open, title, onClose, headerAction, footer, children }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // SweetAlert2 เปิดอยู่ (เช่น ยืนยันลบ/ปิดเรื่อง) → ให้ Esc ปิดแค่ Swal ไม่ปิดชีตข้างหลังไปด้วย
      if (document.querySelector(".swal2-container")) return;
      onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    panel?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // ไม่แย่ง focus จาก popup อื่น (เช่น SweetAlert2 ที่เปิดทันทีหลังปิด sheet)
      const active = document.activeElement;
      const focusFree = !active || active === document.body || (panel && panel.contains(active));
      if (focusFree && previouslyFocused && typeof previouslyFocused.focus === "function" && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" tabIndex={-1} aria-hidden="true" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="relative flex max-h-[85dvh] w-full flex-col rounded-t-[20px] bg-white shadow-xl outline-none md:max-w-md md:rounded-2xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300 md:hidden" aria-hidden />
        <div className="flex items-center gap-1 py-2 pl-5 pr-2">
          <h2 id={titleId} className="flex-1 text-lg font-bold text-gray-800">{title}</h2>
          {headerAction}
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl text-gray-500 hover:bg-gray-100" aria-label="ปิด">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 ${footer ? "pb-4" : "pb-[max(env(safe-area-inset-bottom),16px)]"}`}>{children}</div>
        {footer && (
          <div className="border-t border-gray-200 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">{footer}</div>
        )}
      </div>
    </div>
  );
}
