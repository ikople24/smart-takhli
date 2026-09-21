// components/citizen/home/ComplaintCTA.tsx
export default function ComplaintCTA({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="mx-4 mt-3 block w-[calc(100%-2rem)] rounded-[20px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] px-5 py-4 text-left shadow-[0_10px_22px_rgba(124,58,237,0.30)]"
    >
      <div className="text-[15px] font-semibold text-white">พบปัญหาในพื้นที่?</div>
      <div className="mt-0.5 text-xs text-white/80">แจ้งเทศบาลได้เลย ติดตามสถานะได้ทุกขั้นตอน</div>
      <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#7C3AED]">
        เริ่มแจ้งเรื่อง
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}
