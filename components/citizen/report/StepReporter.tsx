// components/citizen/report/StepReporter.tsx
// ขั้น 3: ข้อมูลผู้แจ้ง + ตำแหน่งที่เกิดเหตุ — segmented คำนำหน้า + ช่องกรอกสไตล์
// citizen · แผนที่ reuse LocationConfirm เดิมทั้งดุ้น
import dynamic from "next/dynamic";

const LocationConfirm = dynamic(() => import("@/components/LocationConfirm"), { ssr: false });

const PREFIXES = ["นาย", "นาง", "นางสาว"];

const inputClass =
  "w-full rounded-[13px] bg-white px-4 py-3.5 text-[14px] text-[#1B1830] shadow-[0_3px_10px_rgba(60,40,100,0.04)] outline-none placeholder:text-[#B9B4C7] focus:ring-2 focus:ring-[#7C3AED]/60";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[11px] font-medium text-[#DC2626]">{message}</p>;
}

export default function StepReporter({
  prefix,
  setPrefix,
  fullName,
  setFullName,
  phone,
  setPhone,
  detail,
  setDetail,
  location,
  setLocation,
  useCurrentLocation,
  setUseCurrentLocation,
  errors,
}: {
  prefix: string;
  setPrefix: (v: string) => void;
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  detail: string;
  setDetail: (v: string) => void;
  location: { lat: number; lng: number } | null;
  setLocation: (v: { lat: number; lng: number } | null) => void;
  useCurrentLocation: boolean;
  setUseCurrentLocation: (v: boolean) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="flex-1 overflow-auto px-4 pb-4">
      <label className="mx-0.5 mb-2 mt-1.5 block text-[13px] font-semibold">คำนำหน้า</label>
      <div className="flex gap-1.5 rounded-[13px] bg-[#EFEBF7] p-1">
        {PREFIXES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPrefix(p)}
            className={`flex-1 rounded-[10px] py-2.5 text-center text-[13px] transition ${
              prefix === p
                ? "bg-white font-semibold text-[#7C3AED] shadow-[0_2px_6px_rgba(60,40,100,0.08)]"
                : "text-[#6B6880]"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <FieldError message={errors.prefix} />

      <label className="mx-0.5 mb-2 mt-4 block text-[13px] font-semibold">ชื่อ-นามสกุล</label>
      <input
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="เช่น สมชาย ใจดี"
        className={inputClass}
      />
      <FieldError message={errors.fullName} />

      <label className="mx-0.5 mb-2 mt-4 block text-[13px] font-semibold">เบอร์โทรศัพท์</label>
      <input
        type="tel"
        inputMode="tel"
        maxLength={10}
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
        placeholder="08XXXXXXXX"
        className={inputClass}
      />
      <FieldError message={errors.phone} />

      <label className="mx-0.5 mb-2 mt-4 block text-[13px] font-semibold">รายละเอียดเพิ่มเติม</label>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        rows={3}
        placeholder="เล่ารายละเอียดปัญหา จุดสังเกต หรือช่วงเวลาที่พบ"
        className={`${inputClass} resize-none leading-relaxed`}
      />
      <FieldError message={errors.detail} />

      <label className="mx-0.5 mb-2 mt-4 block text-[13px] font-semibold">ตำแหน่งที่เกิดเหตุ</label>
      <div className="overflow-hidden rounded-[14px] shadow-[0_4px_12px_rgba(60,40,100,0.05)]">
        <LocationConfirm
          useCurrent={useCurrentLocation}
          onToggle={setUseCurrentLocation}
          location={location}
          setLocation={setLocation}
          accent="purple"
        />
      </div>
      <FieldError message={errors.location} />
    </div>
  );
}
