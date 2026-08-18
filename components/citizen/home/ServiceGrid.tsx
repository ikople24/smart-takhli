// components/citizen/home/ServiceGrid.tsx
// grid หมวดแจ้งเรื่อง/บริการ จาก useMenuStore เดิม — id="report-categories"
// เป็นเป้าเลื่อนของปุ่มแจ้งเรื่อง (FAB/CTA) เพราะ flow เดิมต้องเลือกหมวดก่อน
import Image from "next/image";
import { MenuItem } from "@/stores/useMenuStore";

export default function ServiceGrid({
  menu,
  loading,
  onSelect,
}: {
  menu: MenuItem[];
  loading: boolean;
  onSelect: (label: string) => void;
}) {
  return (
    <section id="report-categories" className="mx-4 mt-6 scroll-mt-4">
      <h2 className="text-[15px] font-bold">แจ้งเรื่อง / บริการ</h2>
      <p className="text-[11px] text-[#9590A8]">เลือกหมวดที่ต้องการแจ้งหรือใช้บริการ</p>
      {loading ? (
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-[16px] bg-white/70" />
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {menu.map((item, index) => (
            <button
              key={item._id || index}
              type="button"
              onClick={() => onSelect(item.Prob_name)}
              className="flex flex-col items-center rounded-[16px] bg-white px-1 py-3 shadow-[0_4px_12px_rgba(60,40,100,0.04)] transition hover:-translate-y-0.5"
            >
              <div className="relative h-12 w-12 overflow-hidden rounded-full">
                <Image src={item.Prob_pic} alt={item.Prob_name} width={48} height={48} className="h-full w-full object-cover" />
              </div>
              <span className="mt-1.5 text-center text-[10.5px] leading-tight text-[#4A4458]">{item.Prob_name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
