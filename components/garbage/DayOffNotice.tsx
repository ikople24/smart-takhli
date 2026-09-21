import type { ResolvedAssignment } from "@/types/garbage";
import { truckLabel } from "@/lib/garbage/labels";
import { summarizeDayOff } from "@/lib/garbage/dayOff";

/** "รถเบอร์ 1, 2, 3" — ไม่ซ้ำคำว่า "รถเบอร์" ทุกตัว จึงต่อเลขที่เหลือเข้ากับป้ายของคันแรก */
function truckListLabel(nums: number[]): string {
  if (nums.length === 0) return "";
  return [truckLabel(nums[0]), ...nums.slice(1).map(String)].join(", ");
}

/**
 * ป้ายบอกว่าวันนี้รถคันไหนหยุด — ข้อมูลที่ชาวบ้านถามมากที่สุดในวันที่รถส่วนใหญ่หยุด
 * ยกมาจาก TodayTruckPanel ตอนเปลี่ยนหน้าเป็นแบบไทม์ไลน์ ไทม์ไลน์โชว์แต่คันที่วิ่ง
 * ถ้าไม่มีป้ายนี้ วันอังคารจะดูเหมือน "มีรถแค่ 4 คัน" โดยไม่บอกว่าอีก 4 คันหยุด
 *
 * เกณฑ์ "ตั้งแต่ 3 คัน" มาจากรูปแบบจริงของตาราง: วันอังคารรถ 1–4 หยุด · วันศุกร์รถ 5–7 หยุด
 * ทั้งสองวันต้องขึ้นป้ายใหญ่ ส่วนวันอาทิตย์ที่หยุดแค่รถ 13 คันเดียวพอบอกด้วยบรรทัดเล็ก
 */
export default function DayOffNotice({ assignments }: { assignments: ResolvedAssignment[] }) {
  const { workingNumbers, dayOffNumbers } = summarizeDayOff(assignments);
  if (dayOffNumbers.length === 0) return null;

  if (dayOffNumbers.length < 3) {
    return (
      <p className="px-1 text-xs text-slate-500">วันนี้หยุด: {truckListLabel(dayOffNumbers)}</p>
    );
  }

  return (
    <section className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="text-sm font-semibold text-amber-900">วันนี้รถหยุดดำเนินการหลายคัน</p>
      <p className="mt-0.5 text-xs text-amber-800">
        หยุด {dayOffNumbers.length} คัน ({truckListLabel(dayOffNumbers)})
        {workingNumbers.length > 0 && ` · ยังมี${truckListLabel(workingNumbers)} วิ่งเก็บแทนบางจุด`}
      </p>
      <p className="mt-1 text-xs text-amber-800">
        ค้นหาถนนของคุณด้านบนเพื่อดูว่ารอบถัดไปรถจะมาวันไหน
      </p>
    </section>
  );
}
