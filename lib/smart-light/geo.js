// ฟังก์ชันภูมิศาสตร์ฝั่ง client ของโมดูล smart-light

// ระยะทางระหว่างสองพิกัดเป็นเมตร (haversine)
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ลิงก์นำทาง Google Maps (มือถือเด้งเข้าแอปแผนที่)
export function googleMapsDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// แปลงข้อความเป็นพิกัด ถ้า input เป็นรูปแบบ "lat,lng" — ไม่ใช่คืน null
export function parseLatLng(text) {
  const m = String(text || "").match(
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/
  );
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
