// components/citizen/status/BeforeAfter.tsx
// รูปประกอบเรื่องร้องเรียน: มีทั้งรูปแจ้ง (ก่อน) และรูปผลงาน (หลัง) → สไลด์เทียบ
// ด้วย ReactCompareImage (dependency เดิมของหน้า /status) · มีอย่างเดียว → แกลเลอรี
// หมายเหตุ: เรื่อง PDPA รูปถูกเบลอมาจาก server แล้ว (Cloudinary e_blur) — แสดงตรง ๆ
import dynamic from "next/dynamic";

const ReactCompareImage = dynamic(() => import("react-compare-image"), { ssr: false });

export default function BeforeAfter({ before = [], after = [] }: { before?: string[]; after?: string[] }) {
  const hasBefore = before.length > 0;
  const hasAfter = after.length > 0;
  if (!hasBefore && !hasAfter) return null;

  return (
    <div className="rounded-[18px] bg-white p-4 shadow-[0_4px_14px_rgba(60,40,100,0.05)]">
      {hasBefore && hasAfter ? (
        <>
          <div className="mb-2.5 flex items-center justify-between text-[11.5px] font-semibold">
            <span className="text-[#C77E10]">ก่อนดำเนินการ</span>
            <span className="text-[#1B935A]">หลังดำเนินการ</span>
          </div>
          <div className="overflow-hidden rounded-[12px]">
            <ReactCompareImage leftImage={before[0]} rightImage={after[0]} sliderLineColor="#7C3AED" />
          </div>
          <p className="mt-2 text-center text-[10.5px] text-[#9590A8]">ลากเส้นกลางเพื่อเทียบก่อน-หลัง</p>
        </>
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {(hasBefore ? before : after).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={`รูปที่ ${i + 1}`}
              className="h-[120px] w-[120px] shrink-0 rounded-[12px] object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}
