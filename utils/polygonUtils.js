// Utility functions for polygon management

/**
 * สร้างข้อมูล polygon สำหรับชุมชน
 * @param {string} name - ชื่อชุมชน
 * @param {Array} coordinates - พิกัดของ polygon [[lat, lng], [lat, lng], ...]
 * @param {string} color - สีขอบ
 * @param {string} fillColor - สีพื้น
 * @param {number} fillOpacity - ความโปร่งใส (0-1)
 * @param {number} weight - ความหนาของเส้น
 * @param {Object} popup - ข้อมูล popup
 * @param {Function} onClick - ฟังก์ชันเมื่อคลิก
 * @returns {Object} ข้อมูล polygon
 */
export const createCommunityPolygon = (name, coordinates, options = {}) => {
  return {
    id: `polygon-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    coordinates,
    color: options.color || '#3b82f6',
    fillColor: options.fillColor || '#3b82f6',
    fillOpacity: options.fillOpacity || 0.2,
    weight: options.weight || 2,
    popup: options.popup || {
      title: name,
      description: 'พื้นที่ชุมชน',
      content: ''
    },
    onClick: options.onClick || (() => {})
  };
};

/**
 * สร้าง polygon รูปสี่เหลี่ยมจากจุดศูนย์กลาง
 * @param {number} centerLat - ละติจูดจุดศูนย์กลาง
 * @param {number} centerLng - ลองจิจูดจุดศูนย์กลาง
 * @param {number} width - ความกว้าง (องศา)
 * @param {number} height - ความสูง (องศา)
 * @returns {Array} พิกัดของ polygon
 */
export const createRectanglePolygon = (centerLat, centerLng, width, height) => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  
  return [
    [centerLat - halfHeight, centerLng - halfWidth],
    [centerLat - halfHeight, centerLng + halfWidth],
    [centerLat + halfHeight, centerLng + halfWidth],
    [centerLat + halfHeight, centerLng - halfWidth]
  ];
};

/**
 * สร้าง polygon รูปวงกลมจากจุดศูนย์กลาง
 * @param {number} centerLat - ละติจูดจุดศูนย์กลาง
 * @param {number} centerLng - ลองจิจูดจุดศูนย์กลาง
 * @param {number} radius - รัศมี (เมตร)
 * @param {number} segments - จำนวนส่วนของวงกลม
 * @returns {Array} พิกัดของ polygon
 */
export const createCirclePolygon = (centerLat, centerLng, radius, segments = 32) => {
  const coordinates = [];
  const angleStep = (2 * Math.PI) / segments;
  
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const lat = centerLat + (radius / 111320) * Math.cos(angle);
    const lng = centerLng + (radius / (111320 * Math.cos(centerLat * Math.PI / 180))) * Math.sin(angle);
    coordinates.push([lat, lng]);
  }
  
  return coordinates;
};

/**
 * คำนวณพื้นที่ของ polygon (ประมาณการ)
 * @param {Array} coordinates - พิกัดของ polygon
 * @returns {number} พื้นที่ในตารางเมตร
 */
export const calculatePolygonArea = (coordinates) => {
  if (coordinates.length < 3) return 0;
  
  let area = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordinates[i][1] * coordinates[j][0];
    area -= coordinates[j][1] * coordinates[i][0];
  }
  
  area = Math.abs(area) / 2;
  // แปลงเป็นตารางเมตร (ประมาณการ)
  return area * 111320 * 111320;
};

/**
 * ตรวจสอบว่าจุดอยู่ใน polygon หรือไม่
 * @param {Array} point - พิกัดจุด [lat, lng]
 * @param {Array} polygon - พิกัดของ polygon
 * @returns {boolean} true ถ้าจุดอยู่ใน polygon
 */
export const isPointInPolygon = (point, polygon) => {
  const [lat, lng] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

/**
 * สร้างข้อมูล polygon สำหรับแสดงพื้นที่ที่มีปัญหามาก
 * @param {Array} complaints - ข้อมูลการร้องเรียน
 * @param {number} threshold - เกณฑ์จำนวนปัญหาที่ถือว่ามาก
 * @returns {Array} ข้อมูล polygon
 */
export const createProblemAreaPolygons = (complaints, threshold = 5) => {
  // จัดกลุ่มปัญหาตามพื้นที่
  const areaGroups = {};
  
  complaints.forEach(complaint => {
    if (complaint.location && complaint.location.lat && complaint.location.lng) {
      const areaKey = `${Math.round(complaint.location.lat * 1000) / 1000}_${Math.round(complaint.location.lng * 1000) / 1000}`;
      
      if (!areaGroups[areaKey]) {
        areaGroups[areaKey] = {
          lat: complaint.location.lat,
          lng: complaint.location.lng,
          complaints: [],
          count: 0
        };
      }
      
      areaGroups[areaKey].complaints.push(complaint);
      areaGroups[areaKey].count++;
    }
  });
  
  // สร้าง polygon สำหรับพื้นที่ที่มีปัญหามาก
  const polygons = [];
  
  Object.values(areaGroups).forEach(area => {
    if (area.count >= threshold) {
      const radius = Math.min(area.count * 50, 300); // รัศมีตามจำนวนปัญหา
      const coordinates = createCirclePolygon(area.lat, area.lng, radius);
      
      const severity = area.count >= 10 ? 'high' : area.count >= 7 ? 'medium' : 'low';
      const colors = {
        high: { color: '#ef4444', fillColor: '#ef4444' },
        medium: { color: '#f59e0b', fillColor: '#f59e0b' },
        low: { color: '#3b82f6', fillColor: '#3b82f6' }
      };
      
      polygons.push(createCommunityPolygon(
        `พื้นที่ปัญหาสูง (${area.count} รายการ)`,
        coordinates,
        {
          ...colors[severity],
          fillOpacity: 0.3,
          popup: {
            title: `พื้นที่ปัญหาสูง`,
            description: `พบปัญหา ${area.count} รายการในพื้นที่นี้`,
            content: `
              <div class="text-sm">
                <p><strong>จำนวนปัญหา:</strong> ${area.count} รายการ</p>
                <p><strong>ประเภทหลัก:</strong> ${getTopCategory(area.complaints)}</p>
                <p><strong>สถานะ:</strong> ${getStatusSummary(area.complaints)}</p>
              </div>
            `
          }
        }
      ));
    }
  });
  
  return polygons;
};

/**
 * หาประเภทปัญหาที่พบมากที่สุด
 */
const getTopCategory = (complaints) => {
  const categories = {};
  complaints.forEach(c => {
    categories[c.category] = (categories[c.category] || 0) + 1;
  });
  
  const topCategory = Object.entries(categories)
    .sort(([,a], [,b]) => b - a)[0];
  
  return topCategory ? topCategory[0] : 'ไม่ระบุ';
};

/**
 * สรุปสถานะของปัญหา
 */
const getStatusSummary = (complaints) => {
  const statuses = {};
  complaints.forEach(c => {
    statuses[c.status] = (statuses[c.status] || 0) + 1;
  });
  
  return Object.entries(statuses)
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
};
