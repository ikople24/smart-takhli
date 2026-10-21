import { useRouter } from "next/router";
import Head from "next/head";
import CheckinApp from "@/components/elderly-school/public/CheckinApp";
import { currentYearBE } from "@/lib/elderly-school/followUp";

// หน้าเช็คอินผู้สูงอายุ (สาธารณะ) — ⚠️ ห้ามเปลี่ยน path /elderly/checkin เพราะ QR ที่พิมพ์แจกแล้วฝัง URL นี้
// query: personId (จำเป็น), yearBE, n (ชื่อสำหรับทักทายก่อนยืนยันตัวตน)
function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v || "").trim();
}

export default function ElderlyCheckinPage() {
  const router = useRouter();
  const personId = first(router.query.personId);
  const yearParam = Number(first(router.query.yearBE));
  const yearBE = Number.isFinite(yearParam) && yearParam > 2500 ? yearParam : currentYearBE();
  const nameHint = first(router.query.n);

  return (
    <>
      <Head>
        <title>โรงเรียนผู้สูงอายุ · เช็คอิน</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      {router.isReady && <CheckinApp key={`${personId}-${yearBE}`} personId={personId} yearBE={yearBE} nameHint={nameHint} />}
    </>
  );
}
