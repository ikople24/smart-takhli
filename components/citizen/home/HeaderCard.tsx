// components/citizen/home/HeaderCard.tsx
import Image from "next/image";

export default function HeaderCard() {
  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-[22px] bg-gradient-to-br from-[#7C3AED] to-[#9050F0] px-4 py-4 shadow-[0_12px_26px_rgba(124,58,237,0.28)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/90">
        <Image src="/logoTK.png" alt="ตราเทศบาลเมืองตาคลี" width={40} height={40} className="h-10 w-10 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold leading-tight text-white">เทศบาลเมืองตาคลี</div>
        <div className="text-[10px] font-medium tracking-[2px] text-white/75">SMART TAKHLI</div>
      </div>
    </div>
  );
}
