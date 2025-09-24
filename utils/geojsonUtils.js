// Utility functions for GeoJSON management

/**
 * แปลงข้อมูล GeoJSON เป็นรูปแบบ polygon ที่ระบบสามารถใช้งานได้
 * @param {Object} geojsonData - ข้อมูล GeoJSON
 * @returns {Array} ข้อมูล polygon
 */
export const convertGeoJSONToPolygons = (geojsonData) => {
  if (!geojsonData || !geojsonData.features) {
    console.warn('Invalid GeoJSON data');
    return [];
  }

  return geojsonData.features.map((feature, index) => {
    const { properties, geometry } = feature;
    
    // ตรวจสอบว่าเป็น Polygon หรือไม่
    if (geometry.type !== 'Polygon') {
      console.warn(`Feature ${index} is not a Polygon: ${geometry.type}`);
      return null;
    }

    // แปลงพิกัดจาก [lng, lat] เป็น [lat, lng] สำหรับ Leaflet
    const coordinates = geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
    
    // สร้างสีตามชื่อหมู่บ้าน
    const color = generateColorFromName(properties.title || `หมู่${index + 1}`);
    
    return {
      id: `geojson-${properties.title || `หมู่${index + 1}`}-${index}`,
      name: properties.title || `หมู่${index + 1}`,
      boundaryor: properties.boundaryor || 'ไม่ระบุ',
      coordinates: coordinates,
      color: color,
      fillColor: color,
      fillOpacity: 0.2,
      weight: 2,
      popup: {
        title: properties.title || `หมู่${index + 1}`,
        description: `พื้นที่${properties.boundaryor || 'ไม่ระบุ'}`,
        content: `
          <div class="text-sm">
            <p><strong>ชื่อหมู่บ้าน:</strong> ${properties.title || `หมู่${index + 1}`}</p>
            <p><strong>ตำบล:</strong> ${properties.boundaryor || 'ไม่ระบุ'}</p>
            <p><strong>จำนวนพิกัด:</strong> ${coordinates.length} จุด</p>
          </div>
        `
      },
      onClick: (polygon) => {
        console.log('คลิกที่ polygon:', polygon.name);
        // สามารถเพิ่ม logic เพิ่มเติมได้ เช่น เปิด modal แสดงรายละเอียด
      }
    };
  }).filter(Boolean); // กรอง null values
};

/**
 * สร้างสีจากชื่อหมู่บ้าน
 * @param {string} name - ชื่อหมู่บ้าน
 * @returns {string} hex color code
 */
const generateColorFromName = (name) => {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#f43f5e', // rose
  ];
  
  // ใช้ hash ของชื่อเพื่อเลือกสี
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return colors[Math.abs(hash) % colors.length];
};

/**
 * โหลดข้อมูล GeoJSON จากไฟล์
 * @param {string} filePath - เส้นทางไฟล์
 * @returns {Promise<Object>} ข้อมูล GeoJSON
 */
export const loadGeoJSONFromFile = async (filePath) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading GeoJSON file:', error);
    throw error;
  }
};

/**
 * โหลดข้อมูล GeoJSON จาก URL
 * @param {string} url - URL ของไฟล์ GeoJSON
 * @returns {Promise<Object>} ข้อมูล GeoJSON
 */
export const loadGeoJSONFromURL = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading GeoJSON from URL:', error);
    throw error;
  }
};

/**
 * ตรวจสอบว่าจุดอยู่ในพื้นที่ GeoJSON หรือไม่
 * @param {Array} point - พิกัดจุด [lat, lng]
 * @param {Array} polygons - ข้อมูล polygon จาก GeoJSON
 * @returns {Object|null} ข้อมูล polygon ที่จุดอยู่ หรือ null
 */
export const findPolygonContainingPoint = (point, polygons) => {
  for (const polygon of polygons) {
    if (isPointInPolygon(point, polygon.coordinates)) {
      return polygon;
    }
  }
  return null;
};

/**
 * ตรวจสอบว่าจุดอยู่ใน polygon หรือไม่ (Ray casting algorithm)
 * @param {Array} point - พิกัดจุด [lat, lng]
 * @param {Array} polygon - พิกัดของ polygon
 * @returns {boolean} true ถ้าจุดอยู่ใน polygon
 */
const isPointInPolygon = (point, polygon) => {
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
 * คำนวณพื้นที่ของ polygon จาก GeoJSON
 * @param {Array} coordinates - พิกัดของ polygon
 * @returns {number} พื้นที่ในตารางเมตร (ประมาณการ)
 */
export const calculatePolygonAreaFromGeoJSON = (coordinates) => {
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
 * สร้างข้อมูล polygon สำหรับแสดงพื้นที่ชุมชนจาก GeoJSON
 * @param {Object} geojsonData - ข้อมูล GeoJSON
 * @param {Object} options - ตัวเลือกเพิ่มเติม
 * @returns {Array} ข้อมูล polygon
 */
export const createCommunityPolygonsFromGeoJSON = (geojsonData, options = {}) => {
  const polygons = convertGeoJSONToPolygons(geojsonData);
  
  // ปรับแต่งตาม options
  return polygons.map(polygon => ({
    ...polygon,
    fillOpacity: options.fillOpacity || 0.2,
    weight: options.weight || 2,
    popup: {
      ...polygon.popup,
      content: options.customPopupContent ? 
        options.customPopupContent(polygon) : 
        polygon.popup.content
    }
  }));
};

/**
 * สร้างข้อมูล polygon สำหรับแสดงพื้นที่ที่มีปัญหามากจาก GeoJSON
 * @param {Object} geojsonData - ข้อมูล GeoJSON
 * @param {Array} complaints - ข้อมูลการร้องเรียน
 * @param {Object} options - ตัวเลือกเพิ่มเติม
 * @returns {Array} ข้อมูล polygon
 */
export const createProblemAreaPolygonsFromGeoJSON = (geojsonData, complaints, options = {}) => {
  const polygons = convertGeoJSONToPolygons(geojsonData);
  
  return polygons.map(polygon => {
    // นับจำนวนปัญหาที่อยู่ในพื้นที่นี้
    const complaintsInArea = complaints.filter(complaint => {
      if (!complaint.location || !complaint.location.lat || !complaint.location.lng) {
        return false;
      }
      return isPointInPolygon([complaint.location.lat, complaint.location.lng], polygon.coordinates);
    });
    
    const complaintCount = complaintsInArea.length;
    const severity = complaintCount >= 10 ? 'high' : complaintCount >= 5 ? 'medium' : 'low';
    
    const colors = {
      high: { color: '#ef4444', fillColor: '#ef4444' },
      medium: { color: '#f59e0b', fillColor: '#f59e0b' },
      low: { color: '#3b82f6', fillColor: '#3b82f6' }
    };
    
    return {
      ...polygon,
      ...colors[severity],
      fillOpacity: 0.3,
      popup: {
        title: `${polygon.name} (${complaintCount} ปัญหา)`,
        description: `พบปัญหา ${complaintCount} รายการในพื้นที่นี้`,
        content: `
          <div class="text-sm">
            <p><strong>ชื่อหมู่บ้าน:</strong> ${polygon.name}</p>
            <p><strong>จำนวนปัญหา:</strong> ${complaintCount} รายการ</p>
            <p><strong>ระดับความรุนแรง:</strong> ${severity === 'high' ? 'สูง' : severity === 'medium' ? 'ปานกลาง' : 'ต่ำ'}</p>
            ${complaintCount > 0 ? `<p><strong>ประเภทหลัก:</strong> ${getTopCategory(complaintsInArea)}</p>` : ''}
          </div>
        `
      }
    };
  });
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
