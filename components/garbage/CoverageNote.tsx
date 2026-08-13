import { weekdayName } from "@/lib/garbage/labels";

interface Props {
  /** เลขวันในสัปดาห์ที่ยังไม่มีตารางในระบบ */
  emptyWeekdays: number[];
  contactPhone: string | null;
  contactNote: string | null;
}

/** แถบบอกความครอบคลุมข้อมูล — ตอนนี้มีเฉพาะวันจันทร์กับอังคาร ต้องบอกตรง ๆ ว่ารออีก 5 วัน */
export default function CoverageNote({ emptyWeekdays, contactPhone, contactNote }: Props) {
  if (emptyWeekdays.length === 0) return null;
  const names = emptyWeekdays.map((w) => `วัน${weekdayName(w)}`).join(" ");
  return (
    <div className="rounded-3xl bg-sky-50/90 ring-1 ring-sky-200/80 p-4">
      <p className="text-sm font-medium text-sky-900">ตารางบางวันยังอยู่ระหว่างจัดทำ</p>
      <p className="text-xs text-sky-900/80 mt-1">
        {names} ยังไม่มีข้อมูลในระบบ กองสาธารณสุขและสิ่งแวดล้อมกำลังจัดทำเพิ่ม
      </p>
      {contactNote && <p className="text-xs text-sky-900/80 mt-1">{contactNote}</p>}
      {contactPhone && (
        <p className="text-xs text-sky-900 mt-1.5">
          สอบถามเพิ่มเติม{" "}
          <a href={`tel:${contactPhone.replace(/[^0-9+]/gu, "")}`} className="font-semibold underline">
            {contactPhone}
          </a>
        </p>
      )}
    </div>
  );
}
