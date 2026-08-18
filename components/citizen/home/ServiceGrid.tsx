// components/citizen/home/ServiceGrid.tsx
// grid หมวดจาก useMenuStore เดิม แยกสองกลุ่ม: เรื่องร้องเรียน กับ บริการ
// (ลงทะเบียนกายอุปกรณ์/สำรวจการศึกษา ไม่ใช่เรื่องร้องเรียน — เปิด modal คนละตัว
// ใน pages/preview.tsx) — id="report-categories" เป็นเป้าเลื่อนของปุ่มแจ้งเรื่อง
import Image from "next/image";
import Link from "next/link";
import { MenuItem } from "@/stores/useMenuStore";

// หมวดที่เป็น "บริการ" — ต้องสะกดตรงกับ Prob_name ใน DB (ตัวเดียวกับที่
// handleSelect ใน pages/preview.tsx ใช้แยก modal · wizard ใช้กรองหมวดร้องเรียน)
export const SERVICE_LABELS = ["ลงทะเบียนกายอุปกรณ์", "สำรวจการศึกษา"];

const cardClass =
  "flex flex-col items-center rounded-[16px] bg-white px-2 py-4 shadow-[0_4px_12px_rgba(60,40,100,0.04)] transition hover:-translate-y-0.5";

function CardInner({ item }: { item: MenuItem }) {
  return (
    <>
      <div className="relative h-16 w-16 overflow-hidden rounded-full">
        <Image src={item.Prob_pic} alt={item.Prob_name} width={64} height={64} className="h-full w-full object-cover" />
      </div>
      <span className="mt-2 text-center text-[12px] leading-tight text-[#4A4458]">{item.Prob_name}</span>
    </>
  );
}

// หมวดร้องเรียน → เข้า wizard ขั้น 2 (หมวดตั้งให้แล้ว) · หมวดบริการ → เปิด modal เดิมผ่าน onSelect
function CategoryCard({ item, onSelect }: { item: MenuItem; onSelect: (label: string) => void }) {
  if (!SERVICE_LABELS.includes(item.Prob_name)) {
    return (
      <Link href={`/preview/report?category=${encodeURIComponent(item.Prob_name)}`} className={cardClass}>
        <CardInner item={item} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onSelect(item.Prob_name)} className={cardClass}>
      <CardInner item={item} />
    </button>
  );
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-[16px] bg-white/70" />
      ))}
    </div>
  );
}

export default function ServiceGrid({
  menu,
  loading,
  onSelect,
}: {
  menu: MenuItem[];
  loading: boolean;
  onSelect: (label: string) => void;
}) {
  const complaints = menu.filter((m) => !SERVICE_LABELS.includes(m.Prob_name));
  const services = menu.filter((m) => SERVICE_LABELS.includes(m.Prob_name));

  return (
    <>
      <section id="report-categories" className="mx-4 mt-6 scroll-mt-4">
        <h2 className="text-[15px] font-bold">แจ้งทุกข์-แจ้งเหตุ</h2>
        <p className="text-[11px] text-[#9590A8]">เลือกหมวดปัญหาที่ต้องการแจ้ง</p>
        {loading ? (
          <SkeletonGrid count={6} />
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {complaints.map((item, index) => (
              <CategoryCard key={item._id || index} item={item} onSelect={onSelect} />
            ))}
          </div>
        )}
      </section>

      {(loading || services.length > 0) && (
        <section className="mx-4 mt-6">
          <h2 className="text-[15px] font-bold">บริการ</h2>
          <p className="text-[11px] text-[#9590A8]">ลงทะเบียนและแบบสำรวจของเทศบาล</p>
          {loading ? (
            <SkeletonGrid count={2} />
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {services.map((item, index) => (
                <CategoryCard key={item._id || index} item={item} onSelect={onSelect} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
