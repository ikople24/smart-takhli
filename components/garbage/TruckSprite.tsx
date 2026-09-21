import Image from "next/image";
import type { TruckColor } from "@/types/garbage";

/**
 * รูปรถเก็บขยะ + หมายเลขคันในวงกลมกลางตัวรถ
 *
 * ตำแหน่งวงกลมวัดจากไฟล์รูปจริง (200x200) ทั้งสองสี: กรอบวงกลมอยู่ที่ x 54–129 y 50–125
 * → จุดศูนย์กลาง 46% / 44% เส้นผ่านศูนย์กลาง 38% ของด้านกว้าง (ห้ามกะเอง)
 * สีเลขต่างกันตามพื้นวงกลม: คันเหลืองวงกลมเทาเข้มจึงใช้ตัวอักษรครีม คันเขียววงกลมขาวจึงใช้เขียวเข้ม
 *
 * animation อยู่ที่ <span> ที่ครอบทั้งรูปและเลข ห้ามย้ายไปที่ <Image> ไม่งั้นเลขไม่ขยับตามรถ
 */
export default function TruckSprite({
  number,
  color,
  size = 104,
  bob = true,
  className = "",
}: {
  number: number | string;
  color: TruckColor;
  size?: number;
  bob?: boolean;
  className?: string;
}) {
  const src = color === "yellow" ? "/garbage/truck-yellow.png" : "/garbage/truck-green.png";
  return (
    <span
      className={"relative block flex-none " + (bob ? "animate-truck-bob " : "") + className}
      style={{ width: size, height: size }}
    >
      {/* alt ว่างโดยตั้งใจ — เป็นภาพประกอบ ข้อความข้าง ๆ บอกเลขรถและสถานะอยู่แล้ว */}
      <Image src={src} alt="" width={size} height={size} className="block" priority={false} />
      <span
        aria-hidden
        className="absolute -translate-x-1/2 -translate-y-1/2 font-mono font-semibold"
        style={{
          left: "45.8%",
          top: "44.5%",
          fontSize: Math.round(size * 0.22),
          color: color === "yellow" ? "#fff8e1" : "#065f46",
        }}
      >
        {number}
      </span>
    </span>
  );
}
