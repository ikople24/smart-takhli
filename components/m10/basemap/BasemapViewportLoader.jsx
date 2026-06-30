import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";

// แจ้ง bbox + zoom (debounce) เมื่อแผนที่ขยับ; zoom < minZoom → ส่ง bbox = null (parent โชว์ป้าย "ซูมเข้า")
export default function BasemapViewportLoader({ onViewport, minZoom }) {
  const map = useMap();
  const timer = useRef(null);

  const fire = () => {
    const z = map.getZoom();
    if (z < minZoom) { onViewport(null, z); return; }
    const b = map.getBounds();
    onViewport([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], z);
  };

  useMapEvents({
    moveend() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fire, 400);
    },
  });

  useEffect(() => {
    map.whenReady(() => fire());
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
