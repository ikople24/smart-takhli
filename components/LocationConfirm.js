import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

let L;

const MapDisplay = dynamic(() => import("./MapDisplay"), { ssr: false });

const LocationConfirm = ({
  useCurrent,
  onToggle,
  location,
  setLocation,
  formSubmitted,
  accent = "blue", // "blue" (default เดิม) | "purple" (ธีม Smart School survey)
}) => {
  const [loading, setLoading] = useState(false);
  const isPurple = accent === "purple";
  const boxCls = isPurple ? "bg-[#F6F3FD] border-[#E7E2F2]" : "bg-blue-50 border-blue-200";
  const labelTextCls = isPurple ? "text-[#57506A]" : "text-gray-700";
  const toggleCls = isPurple
    ? `toggle ${useCurrent ? "checked:bg-[#7C3AED] checked:border-[#7C3AED]" : ""}`
    : `toggle ${useCurrent ? "toggle-success" : formSubmitted ? "toggle-error" : ""}`;
  const mapBoxCls = isPurple ? "border-[#E7E2F2] bg-[#F6F3FD]" : "border-blue-200 bg-blue-50";

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Dynamic import for Leaflet to avoid SSR window error
      (async () => {
        const leaflet = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        L = leaflet.default;
        L.Icon.Default.mergeOptions({
          iconUrl: "/leaflet/marker-icon.png",
          iconRetinaUrl: "/leaflet/marker-icon-2x.png",
          shadowUrl: "/leaflet/marker-shadow.png",
        });
      })();
    }
  }, []);

  useEffect(() => {
    if (useCurrent) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocation({ lat: latitude, lng: longitude });
          setLoading(false);
        },
        (err) => {
          console.error("Geolocation error:", err);
          alert("ไม่สามารถเข้าถึงตำแหน่งของคุณได้");
          setLoading(false);
          onToggle(false); // ปิด toggle กลับ
        }
      );
    }
  }, [useCurrent, onToggle, setLocation]);

  return (
    <div className="space-y-2">
      <div className={`form-control p-3 rounded-md border ${boxCls}`}>
        <label className="flex items-center gap-2 cursor-pointer w-full justify-between">
          <span className={`label-text text-base font-medium ${labelTextCls}`}>
            กดปุ่มเพื่อใช้ตำแหน่งปัจจุบันของคุณ
          </span>
          <input
            id="toggle-location"
            type="checkbox"
            className={toggleCls}
            checked={useCurrent}
            onChange={() => onToggle(!useCurrent)}
          />
        </label>
      </div>

      {loading && <p className="text-sm text-gray-500">กำลังดึงตำแหน่ง...</p>}

      {/* โชว์แผนที่เมื่อมีพิกัดแล้ว (ไม่ต้องกดสวิตช์) — รายเก่าที่ prefill พิกัดเดิมมาจะเห็นหมุดทันที
          จึงไม่ต้องกดสวิตช์ ซึ่งจะ getCurrentPosition ทับพิกัดเดิม.
          ฟอร์มอื่นที่ไม่มี prefill พฤติกรรมเท่าเดิม (พิกัดมีค่าก็ต่อเมื่อกดสวิตช์) */}
      {typeof window !== "undefined" && location?.lat && location?.lng && (
        <div className={`rounded-lg overflow-hidden border shadow-sm space-y-2 ${mapBoxCls}`}>
          <div className="h-64 rounded overflow-hidden border">
            <MapDisplay lat={location.lat} lng={location.lng} showPopup={true} />
          </div>
          
        </div>
      )}
    </div>
  );
};

export default LocationConfirm;
