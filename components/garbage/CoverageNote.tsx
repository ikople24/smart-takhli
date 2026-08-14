import { weekdayName } from "@/lib/garbage/labels";

interface Props {
  /** เลขวันในสัปดาห์ที่ยังไม่มีตารางในระบบ */
  emptyWeekdays: number[];
  contactPhone: string | null;
  contactNote: string | null;
}

/**
 * แถบท้ายหน้า: วันที่ยังไม่มีตาราง + ช่องทางติดต่อกองสาธารณสุข
 *
 * เดิมคืน null ทันทีเมื่อ emptyWeekdays ว่าง ซึ่งพอตารางครบ 7 วัน (M7) เบอร์ติดต่อก็หายไปด้วย
 * ทั้งที่เป็นค่าที่เจ้าหน้าที่ตั้งไว้ให้ชาวบ้านโทรถาม — สองเรื่องนี้ต้องแยกเงื่อนไขกัน
 */
export default function CoverageNote({ emptyWeekdays, contactPhone, contactNote }: Props) {
  const hasPending = emptyWeekdays.length > 0;
  const hasContact = Boolean(contactPhone || contactNote);
  if (!hasPending && !hasContact) return null;

  const names = emptyWeekdays.map((w) => `วัน${weekdayName(w)}`).join(" ");

  return (
    <div
      className={
        "rounded-3xl p-4 ring-1 " +
        (hasPending ? "bg-sky-50/90 ring-sky-200/80" : "bg-white ring-slate-200")
      }
    >
      {hasPending ? (
        <>
          <p className="text-sm font-medium text-sky-900">ตารางบางวันยังอยู่ระหว่างจัดทำ</p>
          <p className="mt-1 text-xs text-sky-900/80">
            {names} ยังไม่มีข้อมูลในระบบ กองสาธารณสุขและสิ่งแวดล้อมกำลังจัดทำเพิ่ม
          </p>
        </>
      ) : (
        <p className="text-sm font-medium text-slate-800">สอบถามเรื่องการเก็บขยะ</p>
      )}

      {contactNote && (
        <p className={"mt-1 text-xs " + (hasPending ? "text-sky-900/80" : "text-slate-600")}>
          {contactNote}
        </p>
      )}

      {contactPhone && (
        <p className={"mt-1.5 text-xs " + (hasPending ? "text-sky-900" : "text-slate-700")}>
          กองสาธารณสุขและสิ่งแวดล้อม{" "}
          <a
            href={`tel:${contactPhone.replace(/[^0-9+]/gu, "")}`}
            className="font-semibold underline"
          >
            {contactPhone}
          </a>
        </p>
      )}
    </div>
  );
}
