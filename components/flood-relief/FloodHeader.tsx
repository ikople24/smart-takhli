// components/flood-relief/FloodHeader.tsx — แถบหัวน้ำเงินของหน้าฟอร์ม/รายการสถานะ (ปุ่มย้อนกลับ + ชิปเบอร์ศูนย์ฯ)
import Link from "next/link";
import { ChevronLeft, Phone } from "lucide-react";
import { telHref } from "@/lib/flood-relief/settings";

export default function FloodHeader({ title, backHref = "/", hotline }: { title: string; backHref?: string; hotline: string }) {
  return (
    <header className="flex h-14 items-center gap-1.5 bg-tk-flood pl-2 pr-3 text-white">
      <Link href={backHref} aria-label="ย้อนกลับ" className="flex h-10 w-10 items-center justify-center rounded-full">
        <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="text-[15.5px] font-bold leading-[1.2]">{title}</div>
        <div className="text-[10.5px] text-white/80">ศูนย์ช่วยเหลือผู้ประสบภัย เทศบาลเมืองตาคลี</div>
      </div>
      <a
        href={telHref(hotline)}
        className="inline-flex h-8 items-center gap-1 rounded-full bg-white/15 px-2.5 text-[11.5px] font-semibold"
      >
        <Phone size={14} aria-hidden />
        {hotline}
      </a>
    </header>
  );
}
