import proj4 from 'proj4';

/**
 * เทศบาลเมืองตาคลีอยู่ใน UTM zone 47N
 * คำนวณระยะบนพิกัดฉาก คลาดเคลื่อนจาก scale factor ~0.04%
 * ดีกว่าคิดระยะบนองศาโดยตรงซึ่งบิดมาก
 */
proj4.defs(
  'EPSG:32647',
  '+proj=utm +zone=47 +datum=WGS84 +units=m +no_defs'
);

const converter = proj4('EPSG:4326', 'EPSG:32647');

export type LngLat = [number, number];

export function projectToUTM(coord: LngLat): [number, number] {
  const r = converter.forward(coord);
  return [r[0], r[1]];
}

/**
 * ความยาวราบของเส้น หน่วยเมตร
 * หมายเหตุ: นี่คือระยะบนแผนที่ ไม่ใช่ความยาวท่อจริง
 * ท่อจริงมีข้องอและความลึกเปลี่ยน มักยาวกว่า 2-5%
 */
export function computeLengthM(coords: LngLat[]): number {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  const pts = coords.map(projectToUTM);
  let sum = 0;
  for (let i = 1; i < pts.length; i++) {
    sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return Number(sum.toFixed(2));
}

/** bounding box [west, south, east, north] จาก coordinates */
export function bboxOf(coords: LngLat[]): [number, number, number, number] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}
