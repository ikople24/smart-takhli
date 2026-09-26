// pages/flood/request.tsx — ฟอร์มขอความช่วยเหลือน้ำท่วม (โมดูล flood-relief · หน้าจอ 2)
// public ไม่ต้องล็อกอิน · ศูนย์ฯ ปิด = แสดงเบอร์โทรแทนฟอร์ม (server ก็ปฏิเสธอยู่แล้ว)
import Head from "next/head";
import { LoaderCircle, Phone } from "lucide-react";
import CitizenShell from "@/components/citizen/CitizenShell";
import FloodHeader from "@/components/flood-relief/FloodHeader";
import RequestForm from "@/components/flood-relief/RequestForm";
import { useFloodSummary } from "@/components/flood-relief/useFloodSummary";
import { DEFAULT_FLOOD_SETTINGS, telHref } from "@/lib/flood-relief/settings";

export default function FloodRequestPage() {
  const { summary, loaded } = useFloodSummary();
  const hotline = summary?.hotline ?? DEFAULT_FLOOD_SETTINGS.hotline;
  // โหลด summary ไม่ได้ = ยังให้กรอกได้ (ให้ server เป็นคนตัดสิน) ดีกว่าปิดทางผู้ประสบภัย
  const closed = loaded && summary != null && !summary.centerOpen;

  return (
    <>
      <Head>
        <title>ขอความช่วยเหลือน้ำท่วม · เทศบาลเมืองตาคลี</title>
      </Head>
      <CitizenShell hideNav>
        <FloodHeader title="ขอความช่วยเหลือน้ำท่วม" hotline={hotline} />
        {!loaded ? (
          <div className="flex justify-center py-16 text-tk-flood">
            <LoaderCircle className="animate-spin" aria-label="กำลังโหลด" />
          </div>
        ) : closed ? (
          <div className="mx-4 mt-6 rounded-[20px] bg-white p-5 text-center shadow-tk-md">
            <h2 className="text-[16px] font-bold">ศูนย์ฯ ยังไม่เปิดรับคำขอทางเว็บ</h2>
            <p className="mt-1.5 text-[13px] leading-normal text-tk-ink-4">ต้องการความช่วยเหลือเร่งด่วน โทรหาเทศบาลได้ตลอดเวลา</p>
            <a
              href={telHref(hotline)}
              className="mt-4 flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-tk-emergency text-[16px] font-bold text-white shadow-tk-emergency"
            >
              <Phone size={18} aria-hidden />
              โทร {hotline}
            </a>
          </div>
        ) : (
          <RequestForm hotline={hotline} />
        )}
      </CitizenShell>
    </>
  );
}
