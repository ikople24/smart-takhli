/** ใช้ร่วมกับแผนที่ Leaflet ชุมชน (แยกจาก AdminDashboardMap เพื่อนำไปใช้ซ้ำ) */

export const calculatePolygonCenter = (coordinates) => {
  if (!coordinates || coordinates.length === 0) return null;
  try {
    let area = 0;
    let centerLat = 0;
    let centerLng = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length;
      const cross = coordinates[i][0] * coordinates[j][1] - coordinates[j][0] * coordinates[i][1];
      area += cross;
      centerLat += (coordinates[i][0] + coordinates[j][0]) * cross;
      centerLng += (coordinates[i][1] + coordinates[j][1]) * cross;
    }
    area /= 2;
    if (Math.abs(area) < 0.000001) {
      let sumLat = 0;
      let sumLng = 0;
      coordinates.forEach((coord) => {
        sumLat += coord[0];
        sumLng += coord[1];
      });
      return [sumLat / coordinates.length, sumLng / coordinates.length];
    }
    centerLat /= 6 * area;
    centerLng /= 6 * area;
    if (isNaN(centerLat) || isNaN(centerLng)) return null;
    return [centerLat, centerLng];
  } catch {
    return null;
  }
};

export const shortenCommunityName = (name, maxLength = 15) => {
  if (!name || name.length <= maxLength) return name;
  const parts = name.split("-");
  if (parts.length > 1) {
    const prefix = parts[0];
    if (prefix.length <= maxLength - 3) return `${prefix}-...`;
    if (prefix.length > maxLength - 3) return prefix.substring(0, maxLength - 3) + "...";
  }
  return name.substring(0, maxLength - 3) + "...";
};

export const adjustLabelPositions = (polygons) => {
  const adjustedPolygons = [];
  const usedPositions = new Set();
  polygons.forEach((polygon, index) => {
    const centerPoint = calculatePolygonCenter(polygon.coordinates);
    if (!centerPoint) return;
    let adjustedPosition = [...centerPoint];
    let offset = 0;
    const maxOffset = 0.01;
    const offsetStep = 0.002;
    while (offset <= maxOffset) {
      const positionKey = `${adjustedPosition[0].toFixed(4)},${adjustedPosition[1].toFixed(4)}`;
      if (!usedPositions.has(positionKey)) {
        usedPositions.add(positionKey);
        break;
      }
      const angle = (index * 45 + offset * 100) * (Math.PI / 180);
      adjustedPosition = [
        centerPoint[0] + Math.cos(angle) * offset,
        centerPoint[1] + Math.sin(angle) * offset,
      ];
      offset += offsetStep;
    }
    adjustedPolygons.push({ ...polygon, adjustedCenter: adjustedPosition });
  });
  return adjustedPolygons;
};
