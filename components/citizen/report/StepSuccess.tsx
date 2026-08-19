// components/citizen/report/StepSuccess.tsx
// จอส่งสำเร็จ (แคนวาส F4) — เลขที่เรื่อง + ชิปสถานะ + การ์ด LINE (oaMessage
// deep link "สถานะ <เลขเรื่อง>" logic เดิมจาก ComplaintFormModal.js:152-167)
import Link from "next/link";

export default function StepSuccess({ complaintId }: { complaintId: string }) {
  const lineOaUrl = process.env.NEXT_PUBLIC_LINE_OA_URL || "";
  const oaBasicId = lineOaUrl.match(/@[\w.-]+/)?.[0];
  const followUrl = oaBasicId
    ? `https://line.me/R/oaMessage/${encodeURIComponent(oaBasicId)}/?${encodeURIComponent(`สถานะ ${complaintId}`)}`
    : lineOaUrl;

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-[#F3EEFE] to-[#F6F5FA]">
      <div className="flex flex-1 flex-col items-center px-6 pt-10 text-center">
        <div className="relative h-[108px] w-[108px]">
          <div className="absolute inset-0 rounded-full bg-[#E6F6EC]" />
          <div className="absolute inset-[14px] flex items-center justify-center rounded-full bg-[#27AE60] shadow-[0_12px_28px_rgba(39,174,96,0.35)]">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </div>
        </div>
        <div className="mt-6 text-[22px] font-bold">ส่งเรื่องสำเร็จ</div>
        <p className="mt-2 max-w-[260px] text-[13.5px] leading-relaxed text-[#6B6880]">
          เราได้รับเรื่องร้องเรียนของคุณแล้ว
          <br />
          เจ้าหน้าที่จะดำเนินการภายใน 3 วันทำการ
        </p>

        <div className="mt-6 w-full rounded-[18px] bg-white p-4.5 text-center shadow-[0_8px_22px_rgba(60,40,100,0.07)]">
          <div className="text-[12px] text-[#9590A8]">เลขที่เรื่องของคุณ</div>
          <div className="mt-1.5 font-mono text-[26px] font-semibold tracking-wider text-[#7C3AED]">{complaintId}</div>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FEF6E0] px-3 py-1.5 text-[12px] font-semibold text-[#C77E10]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#F2A93B]" />
            อยู่ระหว่างดำเนินการ
          </span>
        </div>

      </div>

      {/* LINE OA คือช่องทางติดตามหลัก (เฟสโปรไฟล์ถูกยกเลิก 2026-08-19) —
          ปุ่มเพิ่มเพื่อนเป็น action หลักของจอนี้ ปุ่มอื่นเป็นรอง */}
      <div className="shrink-0 px-6 pb-8 pt-3">
        {lineOaUrl && (
          <>
            <p className="mb-2 text-center text-[12.5px] font-medium text-[#4A4458]">
              อย่าลืมเพิ่มเพื่อน LINE เทศบาล — ช่องทางแจ้งเตือนความคืบหน้าเรื่องของคุณ
            </p>
            <a
              href={followUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-[15px] bg-[#06C755] py-4 text-center text-[15px] font-bold text-white shadow-[0_10px_22px_rgba(6,199,85,0.35)]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 2C6.5 2 2 5.7 2 10.2c0 4 3.6 7.4 8.5 8.1.3.07.8.2.9.5.1.3.07.6.04.9l-.1.8c-.05.3-.2 1 .9.5 1.1-.5 5.8-3.4 7.9-5.8C21.3 12.1 22 11.2 22 10.2 22 5.7 17.5 2 12 2Z" />
              </svg>
              เพิ่มเพื่อน LINE รับแจ้งเตือนเรื่องนี้
            </a>
            <p className="mt-1.5 text-center text-[10.5px] text-[#9590A8]">
              กดแล้วระบบเตรียมข้อความ &quot;สถานะ {complaintId}&quot; ให้ — กดส่งในแชทได้เลย
            </p>
          </>
        )}
        <Link
          href="/status"
          className={`mt-3 block rounded-[15px] py-3.5 text-center text-[14px] font-semibold ${
            lineOaUrl
              ? "bg-[#F1ECFE] text-[#7C3AED]"
              : "bg-gradient-to-br from-[#7C3AED] to-[#9050F0] text-white shadow-[0_10px_22px_rgba(124,58,237,0.30)]"
          }`}
        >
          ติดตามสถานะเรื่อง
        </Link>
        <Link href="/" className="mt-1 block py-3 text-center text-[13.5px] font-medium text-[#7C3AED]">
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}
