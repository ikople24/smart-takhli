// ผู้เรียนของปี = ลงทะเบียนปีนั้น (elderly_enrollments) ∪ มีผลวัด/เช็คอินปีนั้น (elderly_visits)
// ใช้ที่เดียวทั้งโมดูล (ทะเบียน · บัตร QR · การ์ดภาพรวม) — อย่า distinct visits เองที่อื่น
import ElderlyVisit from "@/models/elderly-school/ElderlyVisit";
import ElderlyEnrollment from "@/models/elderly-school/ElderlyEnrollment";

/** คืน personId (ObjectId) ไม่ซ้ำ */
export async function yearPersonIds(yearBE) {
  const [fromVisits, fromEnrollments] = await Promise.all([
    ElderlyVisit.distinct("personId", { yearBE }),
    ElderlyEnrollment.distinct("personId", { yearBE }),
  ]);
  const byKey = new Map();
  for (const id of [...fromVisits, ...fromEnrollments]) {
    if (id) byKey.set(String(id), id);
  }
  return Array.from(byKey.values());
}
