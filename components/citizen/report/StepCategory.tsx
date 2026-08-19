// components/citizen/report/StepCategory.tsx
// ขั้น 1: เลือกหมวดหมู่ — การ์ดแถว รูปหมวด + ชื่อ + ตัวอย่างปัญหาของหมวด
// (จาก problemOptions ตัวจริง) · เลือกแล้วขอบม่วง + วงติ๊ก
import Image from "next/image";
import { MenuItem } from "@/stores/useMenuStore";

type ProblemOption = { _id: string; label: string; category: string };

export default function StepCategory({
  menu,
  loading,
  problemOptions,
  value,
  onChange,
}: {
  menu: MenuItem[];
  loading: boolean;
  problemOptions: ProblemOption[];
  value: string;
  onChange: (label: string) => void;
}) {
  const exampleFor = (name: string) =>
    problemOptions
      .filter((o) => o.category === name)
      .slice(0, 3)
      .map((o) => o.label)
      .join(" · ");

  return (
    <div className="flex-1 overflow-auto px-4 pb-4">
      <p className="mx-0.5 mb-3.5 mt-1.5 text-[13px] text-[#6B6880]">เลือกประเภทเรื่องที่ต้องการแจ้ง</p>
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[16px] bg-white/70" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {menu.map((item) => {
            const selected = item.Prob_name === value;
            const example = exampleFor(item.Prob_name);
            return (
              <button
                key={item._id || item.Prob_name}
                type="button"
                onClick={() => onChange(item.Prob_name)}
                className={`flex items-center gap-3 rounded-[16px] bg-white p-3.5 text-left ${
                  selected
                    ? "border-2 border-[#7C3AED] shadow-[0_6px_16px_rgba(124,58,237,0.12)]"
                    : "border-2 border-transparent shadow-[0_4px_12px_rgba(60,40,100,0.04)]"
                }`}
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[13px]">
                  <Image src={item.Prob_pic} alt={item.Prob_name} width={44} height={44} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{item.Prob_name}</div>
                  {example && <div className="line-clamp-1 text-[11px] text-[#9590A8]">{example}</div>}
                </div>
                {selected ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
                    <circle cx="12" cy="12" r="11" fill="#7C3AED" />
                    <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CFC8DE" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
