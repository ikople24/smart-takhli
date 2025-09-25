import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useMenuStore } from "@/stores/useMenuStore";
import { 
  ChartBarIcon, 
  MapPinIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { createProblemAreaPolygons, createRectanglePolygon, createCommunityPolygon } from '@/utils/polygonUtils';
import { loadGeoJSONFromFile, createCommunityPolygonsFromGeoJSON, createProblemAreaPolygonsFromGeoJSON } from '@/utils/geojsonUtils';

// Dynamic import for map component to avoid SSR issues
const MapWithNoSSR = dynamic(() => import('@/components/AdminDashboardMap'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">กำลังโหลดแผนที่...</div>
});

export default function AdminDashboard() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    satisfaction: 0,
    byCategory: {},
    byCommunity: {}
  });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [selectedStatus, setSelectedStatus] = useState("ทั้งหมด");
  const [dateRange, setDateRange] = useState("all"); // 7d, 30d, 90d, all
  
  // ข้อมูล polygon สำหรับแสดงพื้นที่ชุมชนและพื้นที่ปัญหา
  const [polygons, setPolygons] = useState([]);
  const [geojsonData, setGeojsonData] = useState(null);
  const [geojsonLoading, setGeojsonLoading] = useState(true);

  const { menu, fetchMenu } = useMenuStore();

  useEffect(() => {
    if (isLoaded && !userId) {
      router.replace("/");
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    if (userId) {
      // โหลดข้อมูลทั้งหมดพร้อมกัน
      const loadAllData = async () => {
        try {
          // โหลด GeoJSON และ Menu พร้อมกัน
          await Promise.all([
            loadGeoJSONData(),
            fetchMenu()
          ]);
          
          // รอสักครู่ให้ข้อมูลพร้อม
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // โหลด Dashboard data
          await fetchDashboardData();
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };
      
      loadAllData();
    }
  }, [userId, dateRange]);

  // สร้าง polygons เมื่อ GeoJSON และ complaints พร้อม
  useEffect(() => {
    if (!geojsonLoading && geojsonData && complaints.length > 0) {
      // console.log('Creating polygons from GeoJSON data...');
      
      // สร้าง polygon จากข้อมูล GeoJSON (14 ชุมชน) เท่านั้น
      const communityPolygons = createCommunityPolygonsFromGeoJSON(geojsonData, {
        fillOpacity: 0.15,
        weight: 2
      });
      
      setPolygons(communityPolygons);
      // console.log('Polygons created from GeoJSON:', communityPolygons.length, 'communities:', communityPolygons.length);
    } else if (!geojsonLoading && !geojsonData && complaints.length > 0) {
      // console.log('GeoJSON not available, creating fallback polygons...');
      // Fallback: สร้างเฉพาะ polygon สำหรับพื้นที่ที่มีปัญหามาก (ไม่มีชุมชนตัวอย่าง)
      const problemAreaPolygons = createProblemAreaPolygons(complaints, 3);
      setPolygons(problemAreaPolygons);
    }
  }, [geojsonLoading, geojsonData, complaints]);

  const loadGeoJSONData = async () => {
    try {
      setGeojsonLoading(true);
      // console.log('Starting to load GeoJSON data...');
      const data = await loadGeoJSONFromFile('/takhli.geojson');
      setGeojsonData(data);
      // console.log('GeoJSON data loaded successfully:', data);
      // console.log('Number of communities:', data.features?.length || 0);
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
    } finally {
      setGeojsonLoading(false);
      // console.log('GeoJSON loading finished');
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch complaints with role=admin to get all data
      const complaintsRes = await fetch(`/api/complaints?role=admin`);
      const complaintsData = await complaintsRes.json();
      
      // Fetch satisfaction data
      const satisfactionRes = await fetch('/api/satisfaction/stats');
      const satisfactionData = await satisfactionRes.json();
      
      // Process data based on date range
      const filteredComplaints = filterComplaintsByDateRange(complaintsData, dateRange);
      
      // Filter complaints with valid location data for map
      const complaintsWithLocation = filteredComplaints.filter(complaint => 
        complaint.location && 
        typeof complaint.location.lat === 'number' && 
        typeof complaint.location.lng === 'number' &&
        !isNaN(complaint.location.lat) && 
        !isNaN(complaint.location.lng)
      );
      
      // Calculate statistics
      const calculatedStats = calculateStats(filteredComplaints, satisfactionData);
      
      setComplaints(filteredComplaints);
      setStats(calculatedStats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterComplaintsByDateRange = (complaints, range) => {
    const now = new Date();
    const filtered = complaints.filter(complaint => {
      const complaintDate = new Date(complaint.timestamp || complaint.createdAt);
      
      switch (range) {
        case "7d":
          return (now - complaintDate) <= 7 * 24 * 60 * 60 * 1000;
        case "30d":
          return (now - complaintDate) <= 30 * 24 * 60 * 60 * 1000;
        case "90d":
          return (now - complaintDate) <= 90 * 24 * 60 * 60 * 1000;
        case "all":
        default:
          return true;
      }
    });
    
    return filtered;
  };

  const calculateStats = (complaints, satisfactionData) => {
    const stats = {
      total: complaints.length,
      inProgress: 0,
      completed: 0,
      overdue: 0,
      satisfaction: satisfactionData.averageRating || 0,
      byCategory: {},
      byCommunity: {}
    };

    complaints.forEach(complaint => {
      // Count by status
      switch (complaint.status) {
        case 'in_progress':
        case 'อยู่ระหว่างดำเนินการ':
          stats.inProgress++;
          break;
        case 'completed':
        case 'ดำเนินการเสร็จสิ้น':
          stats.completed++;
          break;
        default:
          stats.inProgress++; // Default to in progress
      }

      // Check for overdue complaints (more than 7 days old)
      const complaintDate = new Date(complaint.timestamp || complaint.createdAt);
      const daysSince = (new Date() - complaintDate) / (1000 * 60 * 60 * 24);
      if (daysSince > 7 && complaint.status !== 'completed' && complaint.status !== 'ดำเนินการเสร็จสิ้น') {
        stats.overdue++;
      }

      // Count by category
      const category = complaint.category || 'ไม่ระบุ';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Count by community
      const community = complaint.community || 'ไม่ระบุ';
      stats.byCommunity[community] = (stats.byCommunity[community] || 0) + 1;
    });

    return stats;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_progress':
      case 'อยู่ระหว่างดำเนินการ':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
      case 'ดำเนินการเสร็จสิ้น':
        return 'bg-green-100 text-green-800';
      default: return 'bg-blue-100 text-blue-800'; // Default to in progress
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_progress':
      case 'อยู่ระหว่างดำเนินการ':
        return 'อยู่ระหว่างดำเนินการ';
      case 'completed':
      case 'ดำเนินการเสร็จสิ้น':
        return 'ดำเนินการเสร็จสิ้น';
      default: return 'อยู่ระหว่างดำเนินการ'; // Default to in progress
    }
  };

  const filteredComplaints = complaints.filter(complaint => {
    const categoryMatch = selectedCategory === "ทั้งหมด" || complaint.category === selectedCategory;
    const statusMatch = selectedStatus === "ทั้งหมด" || 
      (selectedStatus === "in_progress" && (complaint.status === "in_progress" || complaint.status === "อยู่ระหว่างดำเนินการ")) ||
      (selectedStatus === "completed" && (complaint.status === "completed" || complaint.status === "ดำเนินการเสร็จสิ้น"));
    return categoryMatch && statusMatch;
  });

  if (!isLoaded || !userId) {
    return <div className="text-center p-8">กำลังโหลด...</div>;
  }

  if (loading) {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">แดชบอร์ดเจ้าหน้าที่</h1>
            <p className="text-gray-600">ดูสถิติและติดตามการดำเนินการต่างๆ</p>
          </div>
          <button
            onClick={() => router.push('/admin/manage-complaints')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            กลับไปหน้าจัดการ
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "7d", label: "7 วันล่าสุด" },
            { value: "30d", label: "30 วันล่าสุด" },
            { value: "90d", label: "90 วันล่าสุด" },
            { value: "all", label: "ทั้งหมด" }
          ].map((range) => (
            <button
              key={range.value}
              onClick={() => setDateRange(range.value)}
              className={`px-4 py-2 rounded-lg font-medium ${
                dateRange === range.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">รวมทั้งหมด</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">อยู่ระหว่างดำเนินการ</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">เสร็จสิ้น</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">เกินกำหนด</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Satisfaction Score */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <StarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">คะแนนความพึงพอใจเฉลี่ย</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.satisfaction.toFixed(1)} / 5.0
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon
                key={star}
                className={`h-6 w-6 ${
                  star <= Math.round(stats.satisfaction)
                    ? "text-yellow-400 fill-current"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">ตัวกรองข้อมูล</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทปัญหา</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              {Object.keys(stats.byCategory).map((category) => {
                const categoryIcon = menu.find(m => m.Prob_name === category)?.Prob_pic;
                return (
                  <option key={category} value={category}>
                    {category} ({stats.byCategory[category]})
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">สถานะ</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ทั้งหมด">ทั้งหมด</option>
              <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
              <option value="completed">ดำเนินการเสร็จสิ้น</option>
            </select>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <MapPinIcon className="h-6 w-6 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold">แผนที่แสดงตำแหน่งปัญหา</h3>
            {geojsonLoading && (
              <div className="ml-2 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-blue-600">กำลังโหลดข้อมูลชุมชน...</span>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">
            แสดง {filteredComplaints.filter(c => c.location && c.location.lat && c.location.lng).length} จาก {filteredComplaints.length} รายการ
            {!geojsonLoading && geojsonData && geojsonData.features && (
              <span className="ml-2 text-green-600">
                • {geojsonData.features.length} ชุมชน
              </span>
            )}
          </div>
        </div>
        <MapWithNoSSR complaints={filteredComplaints} polygons={polygons} />
      </div>

      {/* Statistics by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">สถิติตามประเภทปัญหา</h3>
          <div className="space-y-3">
            {Object.entries(stats.byCategory)
              .sort(([,a], [,b]) => b - a)
              .map(([category, count]) => {
                const categoryIcon = menu.find(m => m.Prob_name === category)?.Prob_pic;
                return (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {categoryIcon && (
                        <img 
                          src={categoryIcon} 
                          alt={category} 
                          className="w-5 h-5 object-contain"
                        />
                      )}
                      <span className="text-gray-700">{category}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">สถิติตามชุมชน</h3>
          <div className="space-y-3">
            {Object.entries(stats.byCommunity)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 10)
              .map(([community, count]) => (
                <div key={community} className="flex items-center justify-between">
                  <span className="text-gray-700">{community}</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Recent Complaints Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">รายการปัญหาล่าสุด</h3>
        </div>
        <div className="overflow-x-auto">
          {filteredComplaints.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">ไม่มีข้อมูลในกรอบเวลาที่เลือก</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    รายละเอียด
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ประเภท
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ชุมชน
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    สถานะ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    วันที่
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredComplaints.slice(0, 10).map((complaint) => (
                  <tr key={complaint._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {complaint.detail?.substring(0, 50) || 'ไม่มีรายละเอียด'}...
                      </div>
                      <div className="text-sm text-gray-500">
                        {complaint.fullName}
                      </div>
                    </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {menu.find(m => m.Prob_name === complaint.category)?.Prob_pic && (
                        <img 
                          src={menu.find(m => m.Prob_name === complaint.category)?.Prob_pic} 
                          alt={complaint.category} 
                          className="w-5 h-5 object-contain"
                        />
                      )}
                      <span className="text-sm text-gray-900">{complaint.category || 'ไม่ระบุ'}</span>
                    </div>
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{complaint.community || 'ไม่ระบุ'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(complaint.status)}`}>
                        {getStatusText(complaint.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(complaint.timestamp || complaint.createdAt).toLocaleDateString('th-TH')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
