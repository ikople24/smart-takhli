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
}) => {
  const [loading, setLoading] = useState(false);

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
      <div className="form-control bg-blue-50 p-3 rounded-md border border-blue-200">
        <label className="flex items-center gap-2 cursor-pointer w-full justify-between">
          <span className="label-text text-base font-medium text-gray-700">
            กดปุ่มเพื่อใช้ตำแหน่งปัจจุบันของคุณ
          </span>
          <input
            id="toggle-location"
            type="checkbox"
            className={`toggle ${
              useCurrent
                ? "toggle-success"
                : formSubmitted
                ? "toggle-error"
                : ""
            }`}
            checked={useCurrent}
            onChange={() => onToggle(!useCurrent)}
          />
        </label>
      </div>

      {loading && <p className="text-sm text-gray-500">กำลังดึงตำแหน่ง...</p>}

      {typeof window !== "undefined" && useCurrent && location?.lat && location?.lng && (
        <div className="rounded-lg overflow-hidden border border-blue-200 shadow-sm bg-blue-50 space-y-2">
          <div className="h-64 rounded overflow-hidden border">
            <MapDisplay lat={location.lat} lng={location.lng} showPopup={true} />
          </div>
          
        </div>
      )}
    </div>
  );
};

export default LocationConfirm;
