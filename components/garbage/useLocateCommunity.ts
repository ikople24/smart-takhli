import { useCallback, useState } from "react";

/**
 * ขอพิกัดจากเบราว์เซอร์ แล้วถามว่าอยู่ใน polygon ชุมชนไหน
 * ใช้ /api/citizen/locate-community ตัวเดียวกับปุ่ม "ชุมชนใกล้ฉัน" ในฟอร์มร้องเรียน
 * (อ่าน geojsonfeatures ของแอปพี่น้อง — อ่านอย่างเดียว)
 *
 * คืนชื่อชุมชนดิบตามที่ polygon ตั้งไว้ (เช่น "รจนา") ผู้เรียกเอาไปค้นต่อได้เลย
 * เพราะ /api/garbage/search ตัดคำนำหน้าด้วย normalizePlaceName ให้อยู่แล้ว
 */
export type LocateState = "idle" | "locating";

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 60_000,
};

export function useLocateCommunity() {
  const [state, setState] = useState<LocateState>("idle");
  const [message, setMessage] = useState("");

  const locate = useCallback(
    (onFound: (community: string) => void) => {
      if (state === "locating") return;
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        setMessage("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง — พิมพ์ชื่อถนนหรือชุมชนแทนได้");
        return;
      }

      setState("locating");
      setMessage("");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(
              `/api/citizen/locate-community?lat=${latitude}&lng=${longitude}`
            );
            const json = await res.json();
            if (json?.success && json.community) {
              onFound(json.community as string);
            } else {
              // นอก polygon = นอกเขตเทศบาล (หรือคาบเกี่ยวขอบเขต) — บอกให้ค้นเองต่อได้
              setMessage("ตำแหน่งของคุณอยู่นอกเขตเทศบาล — พิมพ์ชื่อถนนหรือชุมชนเพื่อค้นหาแทน");
            }
          } catch {
            setMessage("เช็คชุมชนไม่สำเร็จ ลองใหม่อีกครั้งหรือพิมพ์ชื่อถนนเอง");
          } finally {
            setState("idle");
          }
        },
        () => {
          setState("idle");
          setMessage("ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง — พิมพ์ชื่อถนนหรือชุมชนแทนได้");
        },
        GEO_OPTIONS
      );
    },
    [state]
  );

  const clearMessage = useCallback(() => setMessage(""), []);

  return { state, message, locate, clearMessage };
}
