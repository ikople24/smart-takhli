import { useEffect, useState } from "react";
import ComplaintDetailModal from "@/components/ComplaintDetailModal";
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
    byCommunity: {},
    byProcessingTime: {},
    byCategoryAndTime: {},
    byOfficer: {}
  });
  const [officerNames, setOfficerNames] = useState({});
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");
  const [selectedStatus, setSelectedStatus] = useState("ทั้งหมด");
  const [dateRange, setDateRange] = useState("all"); // 7d, 30d, 90d, all
  const [fiscalYearFilter, setFiscalYearFilter] = useState(null); // null, "2568"
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  
  // ข้อมูล polygon สำหรับแสดงพื้นที่ชุมชนและพื้นที่ปัญหา
  const [polygons, setPolygons] = useState([]);
  const [geojsonData, setGeojsonData] = useState(null);
  const [geojsonLoading, setGeojsonLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [assignedUsersMap, setAssignedUsersMap] = useState({});
  const [recentPage, setRecentPage] = useState(1);
  const RECENT_PAGE_SIZE = 10;
  const [topReporters, setTopReporters] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);

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
  }, [userId, dateRange, fiscalYearFilter]);

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
      
      // Fetch assignments with user data (joined) - ส่งพารามิเตอร์การกรอง
      const assignmentsUrl = `/api/assignments/with-users?dateRange=${dateRange}&fiscalYear=${fiscalYearFilter || ''}`;
      const assignmentsRes = await fetch(assignmentsUrl);
      const assignmentsData = await assignmentsRes.json();
      
      // Create officer names mapping from joined data
      const namesMap = {};
      if (assignmentsData.success && assignmentsData.assignments) {
        assignmentsData.assignments.forEach(assignment => {
          if (assignment.userId && assignment.user) {
            namesMap[assignment.userId] = assignment.user.name || `พนักงาน ${assignment.userId.slice(-6)}`;
          }
        });
        // เก็บ assignments และ mapping ของผู้ใช้ที่ถูกมอบหมายไว้ใช้กับ modal รายละเอียด
        setAssignments(assignmentsData.assignments);
        const usersMap = {};
        assignmentsData.assignments.forEach(a => {
          if (a.userId && a.user) usersMap[a.userId] = a.user;
        });
        setAssignedUsersMap(usersMap);
      }
      setOfficerNames(namesMap);
      
      // Process data based on date range and fiscal year
      const filteredComplaints = filterComplaintsByDateRange(complaintsData, dateRange, fiscalYearFilter);
      
      // Filter complaints with valid location data for map
      const complaintsWithLocation = filteredComplaints.filter(complaint => 
        complaint.location && 
        typeof complaint.location.lat === 'number' && 
        typeof complaint.location.lng === 'number' &&
        !isNaN(complaint.location.lat) && 
        !isNaN(complaint.location.lng)
      );
      
      // Calculate statistics
      const calculatedStats = calculateStats(filteredComplaints, satisfactionData, assignmentsData.assignments || assignmentsData);
      
      setComplaints(filteredComplaints);
      setStats(calculatedStats);
      
      // คำนวณผู้แจ้งบ่อยที่สุด
      const topReportersData = calculateTopReporters(filteredComplaints);
      setTopReporters(topReportersData);
      
      // คำนวณข้อมูลพายชาร์ต
      const pieChartDataResult = calculatePieChartData(filteredComplaints);
      setPieChartData(pieChartDataResult);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterComplaintsByDateRange = (complaints, range, fiscalYear = null) => {
    const now = new Date();
    const filtered = complaints.filter(complaint => {
      const complaintDate = new Date(complaint.timestamp || complaint.createdAt);
      
      // ตรวจสอบปีงบประมาณก่อน
      if (fiscalYear === "2568") {
        // ปีงบประมาณ 2568: 1 ตุลาคม 2567 - 30 กันยายน 2568
        const fiscalStart = new Date(2024, 9, 1); // ตุลาคม 2567 (month 9 = ตุลาคม)
        const fiscalEnd = new Date(2025, 8, 30); // กันยายน 2568 (month 8 = กันยายน)
        if (complaintDate < fiscalStart || complaintDate > fiscalEnd) {
          return false;
        }
      }
      
      // ตรวจสอบช่วงเวลาปกติ
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

  // ฟังก์ชันกรองเรื่องร้องเรียนตามประเภทและระยะเวลา
  const filterComplaintsByCategoryAndTime = (category, timeCategory) => {
    const filtered = complaints.filter(complaint => {
      // ตรวจสอบประเภทปัญหา
      if (complaint.category !== category) {
        return false;
      }
      
      // ตรวจสอบระยะเวลาการจัดการ
      if (complaint.status === "completed" || complaint.status === "ดำเนินการเสร็จสิ้น") {
        const createdAt = new Date(complaint.timestamp || complaint.createdAt);
        const completedAt = new Date(complaint.completedAt || complaint.updatedAt);
        const processingTimeHours = (completedAt - createdAt) / (1000 * 60 * 60);
        
        let complaintTimeCategory;
        if (processingTimeHours <= 24) {
          complaintTimeCategory = '≤ 24 ชม.';
        } else if (processingTimeHours <= 48) {
          complaintTimeCategory = '1-2 วัน';
        } else if (processingTimeHours <= 72) {
          complaintTimeCategory = '2-3 วัน';
        } else if (processingTimeHours <= 168) {
          complaintTimeCategory = '3-7 วัน';
        } else if (processingTimeHours <= 360) {
          complaintTimeCategory = '7-15 วัน';
        } else {
          complaintTimeCategory = '> 15 วัน';
        }
        
        return complaintTimeCategory === timeCategory;
      }
      
      return false;
    });
    
    return filtered;
  };

  // ฟังก์ชันเปิด modal แสดงรายการเรื่องร้องเรียน
  const handleShowComplaints = (category, timeCategory) => {
    const filteredComplaints = filterComplaintsByCategoryAndTime(category, timeCategory);
    setSelectedComplaints(filteredComplaints);
    setModalTitle(`${category} - ${timeCategory} (${filteredComplaints.length} เรื่อง)`);
    setShowComplaintsModal(true);
  };

  // Modal รายละเอียดแบบหน้า manage-complaints
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedComplaintDetail, setSelectedComplaintDetail] = useState(null);
  const openDetailModal = (complaint) => {
    setSelectedComplaintDetail(complaint);
    setShowDetailModal(true);
  };
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedComplaintDetail(null);
  };

  // ฟังก์ชันนับผู้แจ้งบ่อยที่สุดจากเบอร์โทร
  const calculateTopReporters = (complaints) => {
    const phoneCounts = {};
    
    complaints.forEach(complaint => {
      if (complaint.phone && complaint.fullName) {
        const phone = complaint.phone.trim();
        const name = complaint.fullName.trim();
        
        if (phone && name) {
          if (!phoneCounts[phone]) {
            phoneCounts[phone] = {
              phone: phone,
              name: name,
              count: 0,
              complaints: []
            };
          }
          phoneCounts[phone].count++;
          phoneCounts[phone].complaints.push(complaint);
        }
      }
    });
    
    // แปลงเป็น array และเรียงตามจำนวน
    const reporters = Object.values(phoneCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // เอาแค่ 5 อันดับแรก
    
    return reporters;
  };

  // ฟังก์ชันคำนวณข้อมูลพายชาร์ตสำหรับผู้แจ้ง
  const calculatePieChartData = (complaints) => {
    const uniqueReporters = new Set();
    const categoryCounts = {};
    
    complaints.forEach(complaint => {
      if (complaint.phone && complaint.fullName) {
        const phone = complaint.phone.trim();
        const name = complaint.fullName.trim();
        
        if (phone && name) {
          // สร้าง unique key จากเบอร์โทรและชื่อ
          const uniqueKey = `${phone}_${name}`;
          uniqueReporters.add(uniqueKey);
          
          // นับตามประเภทปัญหา
          if (complaint.category) {
            categoryCounts[complaint.category] = (categoryCounts[complaint.category] || 0) + 1;
          }
        }
      }
    });
    
    // สร้างข้อมูลสำหรับพายชาร์ต
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
    ];
    
    const pieData = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([category, count], index) => ({
        name: category,
        value: count,
        color: colors[index % colors.length],
        percentage: ((count / complaints.length) * 100).toFixed(1)
      }));
    
    return {
      totalUniqueReporters: uniqueReporters.size,
      totalComplaints: complaints.length,
      pieData: pieData
    };
  };

  const calculateStats = (complaints, satisfactionData, assignmentsData) => {
    const stats = {
      total: complaints.length,
      inProgress: 0,
      completed: 0,
      overdue: 0,
      satisfaction: satisfactionData.averageRating || 0,
      byCategory: {},
      byCommunity: {},
      byProcessingTime: {},
      byCategoryAndTime: {},
      byOfficer: {}
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

      // Calculate processing time for completed complaints
      if (complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น') {
        const startDate = new Date(complaint.timestamp || complaint.createdAt);
        const endDate = new Date(complaint.updatedAt || complaint.timestamp || complaint.createdAt);
        const processingTimeHours = Math.floor((endDate - startDate) / (1000 * 60 * 60));
        
        // Categorize processing time
        let timeCategory;
        if (processingTimeHours <= 24) {
          timeCategory = '≤ 24 ชม.';
        } else if (processingTimeHours <= 48) {
          timeCategory = '1-2 วัน';
        } else if (processingTimeHours <= 72) {
          timeCategory = '2-3 วัน';
        } else if (processingTimeHours <= 168) {
          timeCategory = '3-7 วัน';
        } else if (processingTimeHours <= 360) {
          timeCategory = '7-15 วัน';
        } else {
          timeCategory = '> 15 วัน';
        }

        // Count by processing time
        stats.byProcessingTime[timeCategory] = (stats.byProcessingTime[timeCategory] || 0) + 1;

        // Count by category and time
        if (!stats.byCategoryAndTime[category]) {
          stats.byCategoryAndTime[category] = {};
        }
        stats.byCategoryAndTime[category][timeCategory] = (stats.byCategoryAndTime[category][timeCategory] || 0) + 1;
      }
    });

    // Calculate officer performance statistics
    assignmentsData.forEach(assignment => {
      if (assignment.userId && assignment.completedAt) {
        const officerId = assignment.userId.toString();
        
        if (!stats.byOfficer[officerId]) {
          stats.byOfficer[officerId] = {
            totalAssigned: 0,
            totalCompleted: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            fastCompletions: 0, // ≤ 24 hours
            mediumCompletions: 0, // 1-7 days
            slowCompletions: 0 // > 7 days
          };
        }
        
        stats.byOfficer[officerId].totalAssigned++;
        stats.byOfficer[officerId].totalCompleted++;
        
        // Calculate processing time for this assignment
        const startDate = new Date(assignment.assignedAt);
        const endDate = new Date(assignment.completedAt);
        const processingTimeHours = Math.floor((endDate - startDate) / (1000 * 60 * 60));
        
        // ป้องกันค่าติดลบ - ถ้าเวลาติดลบให้เป็น 0
        const validProcessingTime = Math.max(0, processingTimeHours);
        stats.byOfficer[officerId].totalProcessingTime += validProcessingTime;
        
        
        // Categorize completion speed
        if (processingTimeHours <= 24) {
          stats.byOfficer[officerId].fastCompletions++;
        } else if (processingTimeHours <= 168) { // 7 days
          stats.byOfficer[officerId].mediumCompletions++;
        } else {
          stats.byOfficer[officerId].slowCompletions++;
        }
      } else if (assignment.userId) {
        // Assignment exists but not completed
        const officerId = assignment.userId.toString();
        
        if (!stats.byOfficer[officerId]) {
          stats.byOfficer[officerId] = {
            totalAssigned: 0,
            totalCompleted: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            fastCompletions: 0,
            mediumCompletions: 0,
            slowCompletions: 0
          };
        }
        
        stats.byOfficer[officerId].totalAssigned++;
      }
    });

    // Calculate average processing time and performance score for each officer
    Object.keys(stats.byOfficer).forEach(officerId => {
      const officer = stats.byOfficer[officerId];
      if (officer.totalCompleted > 0) {
        officer.averageProcessingTime = Math.round(officer.totalProcessingTime / officer.totalCompleted);
        
        // Calculate performance score (0-100) - สูตรใหม่
        // Higher score = better performance
        
        // 1. Completion Rate (อัตราเสร็จสิ้น) - 40%
        const completionRate = Math.min(100, (officer.totalCompleted / officer.totalAssigned) * 100);
        
        // 2. Speed Score (ความเร็วในการทำงาน) - 40%
        let speedScore;
        if (officer.averageProcessingTime <= 0) {
          speedScore = 100;
        } else if (officer.averageProcessingTime <= 24) {
          speedScore = 100;
        } else {
          speedScore = Math.max(0, Math.min(100, 100 - ((officer.averageProcessingTime - 24) / 24) * 20));
        }
        
        // 3. Volume Bonus (โบนัสปริมาณงาน) - 20%
        let volumeBonus;
        if (officer.totalAssigned >= 20) {
          volumeBonus = 20; // รับงาน 20+ เรื่อง = โบนัสเต็ม
        } else if (officer.totalAssigned >= 10) {
          volumeBonus = 15; // รับงาน 10-19 เรื่อง = โบนัส 15
        } else if (officer.totalAssigned >= 5) {
          volumeBonus = 10; // รับงาน 5-9 เรื่อง = โบนัส 10
        } else {
          volumeBonus = 0; // รับงานน้อยกว่า 5 เรื่อง = ไม่มีโบนัส
        }
        
        // คำนวณคะแนนรวม (จำกัดไม่เกิน 100)
        officer.performanceScore = Math.min(100, Math.round(
          (completionRate * 0.4) + 
          (speedScore * 0.4) + 
          (volumeBonus * 0.2)
        ));
      } else {
        officer.averageProcessingTime = 0;
        officer.performanceScore = 0;
      }
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

  // Modal component สำหรับแสดงรายการเรื่องร้องเรียน
  const ComplaintsModal = () => {
    if (!showComplaintsModal) return null;

    return (
      <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{modalTitle}</h3>
            <button
              onClick={() => setShowComplaintsModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedComplaints.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ไม่พบเรื่องร้องเรียนที่ตรงกับเงื่อนไข
              </div>
            ) : (
              <div className="space-y-4">
                {selectedComplaints.map((complaint, index) => {
                  const createdAt = new Date(complaint.timestamp || complaint.createdAt);
                  const completedAt = new Date(complaint.completedAt || complaint.updatedAt);
                  const processingTimeHours = (completedAt - createdAt) / (1000 * 60 * 60);
                  const titleText = (
                    typeof complaint.title === 'string' && complaint.title.trim().length > 0
                  ) ? complaint.title
                    : (typeof complaint.detail === 'string' && complaint.detail.trim().length > 0
                      ? complaint.detail
                      : (Array.isArray(complaint.problems) && complaint.problems.length > 0
                        ? complaint.problems[0]
                        : 'ไม่มีหัวข้อ'));
                  const descriptionText = (typeof complaint.detail === 'string' && complaint.detail.trim().length > 0)
                    ? complaint.detail
                    : (Array.isArray(complaint.problems) && complaint.problems.length > 0
                      ? complaint.problems.join(', ')
                      : 'ไม่มีรายละเอียด');
                  
                  return (
                    <div 
                      key={complaint._id} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openDetailModal(complaint)}
                      title="คลิกเพื่อดูรายละเอียดเต็ม"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {complaint.community || 'ไม่ระบุชุมชน'}
                            </span>
                          </div>
                          
                          <h4 className="font-medium text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                            {titleText}
                          </h4>
                          
                          <p className="text-sm text-gray-600 mb-3">
                            {descriptionText}
                          </p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">วันที่แจ้ง:</span>
                              <div className="font-medium">
                                {createdAt.toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-gray-500">วันที่เสร็จ:</span>
                              <div className="font-medium">
                                {completedAt.toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-gray-500">ระยะเวลา:</span>
                              <div className="font-medium">
                                {processingTimeHours <= 24 
                                  ? `${Math.round(processingTimeHours)} ชม.`
                                  : `${Math.round(processingTimeHours / 24)} วัน`
                                }
                              </div>
                            </div>
                            
                            <div>
                              <span className="text-gray-500">ชุมชน:</span>
                              <div className="font-medium">
                                {complaint.community || 'ไม่ระบุ'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="ml-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="w-3 h-3 mr-1" />
                            เสร็จสิ้น
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t bg-gray-50/80 backdrop-blur-sm">
            <div className="text-sm text-gray-600">
              แสดง {selectedComplaints.length} เรื่อง
            </div>
            <button
              onClick={() => setShowComplaintsModal(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    );
  };

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
              onClick={() => {
                setDateRange(range.value);
                setFiscalYearFilter(null); // รีเซ็ตปีงบประมาณเมื่อเลือกช่วงเวลาปกติ
              }}
              className={`px-4 py-2 rounded-lg font-medium ${
                dateRange === range.value && !fiscalYearFilter
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {range.label}
            </button>
          ))}
          
          {/* ปุ่มปีงบประมาณ */}
          <button
            onClick={() => {
              setFiscalYearFilter("2568");
              setDateRange("all"); // รีเซ็ตช่วงเวลาปกติเมื่อเลือกปีงบประมาณ
            }}
            className={`px-4 py-2 rounded-lg font-medium ${
              fiscalYearFilter === "2568"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            ปีงบ2568
          </button>
        </div>
        
        {/* แสดงข้อมูลปีงบประมาณ */}
        {fiscalYearFilter === "2568" && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <ClockIcon className="h-3 w-3 mr-1" />
              1 ตุลาคม 2567 - 30 กันยายน 2568
            </span>
          </div>
        )}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">สถิติตามชุมชน</h3>
            <div className="text-sm text-gray-500">
              แสดง 22 ชุมชน (รวมชุมชนที่ยังไม่มีการแจ้ง)
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {(() => {
              // รายชื่อชุมชนทั้งหมด
              const allCommunities = [
                "สามล", "รจนา", "หัวเขาตาคลี", "สว่างวงษ์", "ตาคลีพัฒนา", "ตีคลี",
                "ทิพย์พิมาน", "ตาคลีใหญ่", "บ้านใหม่โพนทอง", "วิลาวัลย์", "โพธิ์งาม",
                "พุทธนิมิต", "ยศวิมล", "ศรีเทพ", "สังข์ทอง", "ศรีสวัสดิ์", "เขาใบไม้",
                "จันทร์เทวี", "รวมใจ", "ตลาดโพนทอง", "มาลัย", "สารภี"
              ];
              
              // สร้างข้อมูลชุมชนทั้งหมด รวมทั้งชุมชนที่ยังไม่มีการแจ้ง
              const allCommunityStats = allCommunities.map(community => ({
                name: community,
                count: stats.byCommunity[community] || 0
              }));
              
              // เรียงลำดับตามจำนวน (จากมากไปน้อย)
              allCommunityStats.sort((a, b) => b.count - a.count);
              
              return allCommunityStats.map(({ name, count }, index) => {
                const percentage = count > 0 ? (count / stats.total) * 100 : 0;
                const isZero = count === 0;
                
                // คำนวณเปอร์เซ็นต์ใหม่ให้แถบยาวขึ้น
                // ใช้ค่าสูงสุดเป็นฐานแทนการใช้ total
                const maxCount = Math.max(...Object.values(stats.byCommunity));
                const adjustedPercentage = count > 0 ? (count / maxCount) * 100 : 0;
                
                // เพิ่มความยาวขั้นต่ำและสูงสุด
                const minWidth = isZero ? 0 : 8; // ความยาวขั้นต่ำ 8% (0% สำหรับชุมชนที่ไม่มีข้อมูล)
                const maxWidth = 95; // ความยาวสูงสุด 95%
                const finalWidth = Math.min(Math.max(adjustedPercentage, minWidth), maxWidth);
                
                // สีแถบตามจำนวน
                const getBarColor = (count) => {
                  if (count === 0) return 'bg-gray-300';
                  if (count <= 2) return 'bg-yellow-400';
                  if (count <= 5) return 'bg-orange-400';
                  if (count <= 10) return 'bg-green-500';
                  return 'bg-red-500';
                };
                
                const getTextColor = (count) => {
                  if (count === 0) return 'text-gray-500';
                  if (count <= 2) return 'text-yellow-700';
                  if (count <= 5) return 'text-orange-700';
                  if (count <= 10) return 'text-green-700';
                  return 'text-red-700';
                };
                
                return (
                  <div key={name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono w-6 text-right">
                          {index + 1}.
                        </span>
                        <span className={`text-sm font-medium ${isZero ? 'text-gray-500' : 'text-gray-700'}`}>
                          {name}
                        </span>
                        {isZero && (
                          <span className="text-xs text-gray-400 italic">
                            (ยังไม่มีการแจ้ง)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${getTextColor(count)}`}>
                          {count}
                        </span>
                      </div>
                    </div>
                    
                    {/* แถบสถิติที่มีมิติ */}
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                        <div
                          className={`${getBarColor(count)} h-4 rounded-full transition-all duration-500 ease-out shadow-sm relative overflow-hidden`}
                          style={{ width: `${finalWidth}%` }}
                        >
                          {/* เอฟเฟกต์เงาและมิติ */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"></div>
                          <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent opacity-30"></div>
                          
                          {/* เอฟเฟกต์แอนิเมชันเมื่อ hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-40 transition-opacity duration-300 transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                        </div>
                      </div>
                      
                      {/* เปอร์เซ็นต์ */}
                      <div className="absolute right-0 top-0 h-4 flex items-center">
                        <span className="text-xs text-gray-500 bg-white px-1 rounded shadow-sm">
                          {isZero ? '0.0%' : `${percentage.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          
          {/* แสดงข้อความเมื่อมีชุมชนมากกว่า 10 */}
          {22 > 10 && (
            <div className="mt-4 pt-3 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-500">
                💡 เลื่อนขึ้น-ลงเพื่อดูชุมชนลำดับที่ 11 ขึ้นไป
              </p>
            </div>
          )}
        </div>
      </div>

      {/* สถิติการจัดการปัญหาตามระยะเวลา */}
      <div className="bg-white rounded-lg shadow p-6 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">สถิติการจัดการปัญหาตามระยะเวลา</h3>
          <div className="text-sm text-gray-500">
            แสดง {stats.completed} รายการที่เสร็จสิ้น
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            '≤ 24 ชม.',
            '1-2 วัน',
            '2-3 วัน',
            '3-7 วัน',
            '7-15 วัน',
            '> 15 วัน'
          ].map((timeRange) => {
              const count = stats.byProcessingTime[timeRange] || 0;
              const percentage = stats.completed > 0 ? (count / stats.completed) * 100 : 0;
              
              // สีตามระยะเวลา
              const getTimeColor = (timeRange) => {
                if (timeRange === '≤ 24 ชม.') return 'bg-green-500';
                if (timeRange === '1-2 วัน') return 'bg-blue-500';
                if (timeRange === '2-3 วัน') return 'bg-indigo-500';
                if (timeRange === '3-7 วัน') return 'bg-yellow-500';
                if (timeRange === '7-15 วัน') return 'bg-orange-500';
                return 'bg-red-500';
              };
              
              const getTimeTextColor = (timeRange) => {
                if (timeRange === '≤ 24 ชม.') return 'text-green-700';
                if (timeRange === '1-2 วัน') return 'text-blue-700';
                if (timeRange === '2-3 วัน') return 'text-indigo-700';
                if (timeRange === '3-7 วัน') return 'text-yellow-700';
                if (timeRange === '7-15 วัน') return 'text-orange-700';
                return 'text-red-700';
              };
              
              return (
                <div key={timeRange} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {timeRange}
                    </span>
                    <span className={`text-sm font-bold ${getTimeTextColor(timeRange)}`}>
                      {count} รายการ
                    </span>
                  </div>
                  
                  <div className="relative">
                    <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                      <div
                        className={`${getTimeColor(timeRange)} h-3 rounded-full transition-all duration-500 ease-out shadow-sm relative overflow-hidden`}
                        style={{ width: `${Math.max(percentage, 2)}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-white to-transparent opacity-30"></div>
                      </div>
                    </div>
                    
                    <div className="absolute right-0 top-0 h-3 flex items-center">
                      <span className="text-xs text-gray-500 bg-white px-1 rounded shadow-sm">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* สถิติการจัดการปัญหาตามประเภทและระยะเวลา */}
      <div className="bg-white rounded-lg shadow p-6 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">สถิติการจัดการปัญหาตามประเภทและระยะเวลา</h3>
          <div className="text-sm text-gray-500">
            แสดงรายละเอียดตามประเภทปัญหา
          </div>
        </div>
        
        <div className="space-y-6">
          {Object.entries(stats.byCategoryAndTime)
            .sort(([,a], [,b]) => {
              const totalA = Object.values(a).reduce((sum, count) => sum + count, 0);
              const totalB = Object.values(b).reduce((sum, count) => sum + count, 0);
              return totalB - totalA;
            })
            .map(([category, timeStats]) => {
              const totalForCategory = Object.values(timeStats).reduce((sum, count) => sum + count, 0);
              
              return (
                <div key={category} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">{category}</h4>
                    <span className="text-sm text-gray-600">
                      รวม {totalForCategory} รายการ
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {['≤ 24 ชม.', '1-2 วัน', '2-3 วัน', '3-7 วัน', '7-15 วัน', '> 15 วัน'].map(timeRange => {
                      const count = timeStats[timeRange] || 0;
                      const percentage = totalForCategory > 0 ? (count / totalForCategory) * 100 : 0;
                      
                      // สีตามระยะเวลา
                      const getTimeColor = (timeRange) => {
                        if (timeRange === '≤ 24 ชม.') return 'bg-green-100 text-green-800 border-green-300';
                        if (timeRange === '1-2 วัน') return 'bg-blue-100 text-blue-800 border-blue-300';
                        if (timeRange === '2-3 วัน') return 'bg-indigo-100 text-indigo-800 border-indigo-300';
                        if (timeRange === '3-7 วัน') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                        if (timeRange === '7-15 วัน') return 'bg-orange-100 text-orange-800 border-orange-300';
                        return 'bg-red-100 text-red-800 border-red-300';
                      };
                      
                      return (
                        <div key={timeRange} className="text-center">
                          <div 
                            className={`px-3 py-2 rounded-lg border ${getTimeColor(timeRange)} ${
                              count > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                            }`}
                            onClick={() => count > 0 && handleShowComplaints(category, timeRange)}
                            title={count > 0 ? `คลิกเพื่อดูรายละเอียด ${count} เรื่อง` : 'ไม่มีข้อมูล'}
                          >
                            <div className="text-lg font-bold">{count}</div>
                            <div className="text-xs">{timeRange}</div>
                            <div className="text-xs opacity-75">
                              {percentage.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* สถิติพนักงานที่จัดการเรื่องได้ดีที่สุด */}
      <div className="bg-white rounded-lg shadow p-6 mb-12">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">พนักงานที่จัดการเรื่องได้ดีที่สุด</h3>
          <div className="text-sm text-gray-500">
            อันดับ 1-5 ตามคะแนนประสิทธิภาพ
            {dateRange !== 'all' && (
              <span className="ml-2 text-blue-600">
                • กรองตาม {dateRange === '7d' ? '7 วันล่าสุด' : dateRange === '30d' ? '30 วันล่าสุด' : '90 วันล่าสุด'}
              </span>
            )}
            {fiscalYearFilter === "2568" && (
              <span className="ml-2 text-green-600">
                • ปีงบประมาณ 2568
              </span>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          {Object.entries(stats.byOfficer)
            .sort(([,a], [,b]) => {
              // กำหนดเกณฑ์ขั้นต่ำสำหรับจำนวนงานที่รับ
              const minWorkThreshold = 3; // ต้องรับงานอย่างน้อย 3 เรื่อง
              
              // ถ้าคนหนึ่งรับงานน้อยกว่าเกณฑ์ และอีกคนรับงานมากกว่าเกณฑ์
              if (a.totalAssigned < minWorkThreshold && b.totalAssigned >= minWorkThreshold) {
                return 1; // a ไปต่อท้าย
              }
              if (b.totalAssigned < minWorkThreshold && a.totalAssigned >= minWorkThreshold) {
                return -1; // b ไปต่อท้าย
              }
              
              // ถ้าทั้งคู่รับงานน้อยกว่าเกณฑ์ หรือทั้งคู่รับงานมากกว่าเกณฑ์
              // ให้เรียงตามคะแนนประสิทธิภาพก่อน
              if (b.performanceScore !== a.performanceScore) {
                return b.performanceScore - a.performanceScore;
              }
              
              // ถ้าคะแนนเท่ากัน ให้เรียงตามจำนวนงานที่รับมากที่สุด
              if (b.totalAssigned !== a.totalAssigned) {
                return b.totalAssigned - a.totalAssigned;
              }
              
              // ถ้าจำนวนงานเท่ากัน ให้ถือว่าเท่ากัน
              return 0;
            })
            .slice(0, 5)
            .map(([officerId, officerData], index) => {
              const rank = index + 1;
              const completionRate = officerData.totalAssigned > 0 
                ? ((officerData.totalCompleted / officerData.totalAssigned) * 100)
                : 0;
              
              // สีตามอันดับ
              const getRankColor = (rank) => {
                if (rank === 1) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
                if (rank === 2) return 'bg-gray-100 border-gray-300 text-gray-800';
                if (rank === 3) return 'bg-orange-100 border-orange-300 text-orange-800';
                return 'bg-blue-100 border-blue-300 text-blue-800';
              };
              
              const getRankIcon = (rank) => {
                if (rank === 1) return '🥇';
                if (rank === 2) return '🥈';
                if (rank === 3) return '🥉';
                return `#${rank}`;
              };
              
              return (
                <div key={officerId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${getRankColor(rank)}`}>
                        {getRankIcon(rank)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800">
                          {officerNames[officerId] || `พนักงาน #${officerId.slice(-6)}`}
                        </h4>
                        <p className="text-sm text-gray-600">
                          คะแนนประสิทธิภาพ: {officerData.performanceScore}/100
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {officerData.totalCompleted}
                      </div>
                      <div className="text-xs text-gray-500">
                        รายการเสร็จสิ้น
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-gray-700">{officerData.totalAssigned}</div>
                      <div className="text-xs text-gray-500">รับงานทั้งหมด</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{completionRate.toFixed(0)}%</div>
                      <div className="text-xs text-gray-500">อัตราเสร็จสิ้น</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">
                        {officerData.averageProcessingTime <= 0 
                          ? "ทันที"
                          : officerData.averageProcessingTime > 24 
                            ? `${Math.round(officerData.averageProcessingTime / 24)} วัน`
                            : `${officerData.averageProcessingTime} ชม.`
                        }
                      </div>
                      <div className="text-xs text-gray-500">เวลาเฉลี่ย</div>
                    </div>
                  </div>
                  
                  {/* แถบแสดงประสิทธิภาพ */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>ประสิทธิภาพ</span>
                      <span>{officerData.performanceScore}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          officerData.performanceScore >= 80 ? 'bg-green-500' :
                          officerData.performanceScore >= 60 ? 'bg-yellow-500' :
                          officerData.performanceScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(officerData.performanceScore, 100)}%` }}
                      ></div>
                    </div>
                    
                    {/* รายละเอียดคะแนน */}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-green-600">{completionRate.toFixed(0)}%</div>
                        <div className="text-gray-500">เสร็จสิ้น</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-blue-600">
                          {officerData.averageProcessingTime <= 24 ? 'เร็ว' : 'ช้า'}
                        </div>
                        <div className="text-gray-500">ความเร็ว</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-orange-600">
                          {officerData.totalAssigned >= 20 ? 'มาก' : officerData.totalAssigned >= 10 ? 'ปานกลาง' : 'น้อย'}
                        </div>
                        <div className="text-gray-500">ปริมาณ</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
        
        {Object.keys(stats.byOfficer).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>ยังไม่มีข้อมูลพนักงานที่ได้รับมอบหมายงาน</p>
            {dateRange !== 'all' && (
              <p className="text-sm mt-2">
                ในช่วงเวลา {dateRange === '7d' ? '7 วันล่าสุด' : dateRange === '30d' ? '30 วันล่าสุด' : '90 วันล่าสุด'}
              </p>
            )}
            {fiscalYearFilter === "2568" && (
              <p className="text-sm mt-2">ในปีงบประมาณ 2568</p>
            )}
          </div>
        )}
        
        {Object.keys(stats.byOfficer).length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              แสดง {Object.keys(stats.byOfficer).length} พนักงาน
              {dateRange !== 'all' && (
                <span className="text-blue-600">
                  {' '}ในช่วงเวลา {dateRange === '7d' ? '7 วันล่าสุด' : dateRange === '30d' ? '30 วันล่าสุด' : '90 วันล่าสุด'}
                </span>
              )}
              {fiscalYearFilter === "2568" && (
                <span className="text-green-600"> ในปีงบประมาณ 2568</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Pie Chart Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">การแจ้งปัญหาตามประเภท</h3>
          <div className="text-sm text-gray-500">
            ผู้แจ้งไม่ซ้ำ: {pieChartData.totalUniqueReporters} คน
          </div>
        </div>
        
        {pieChartData.pieData && pieChartData.pieData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pie Chart */}
            <div className="flex items-center justify-center">
              <div className="relative w-64 h-64">
                {/* Background Circle */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg"></div>
                
                <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 100 100">
                  {(() => {
                    let cumulativePercentage = 0;
                    return pieChartData.pieData.map((item, index) => {
                      const percentage = (item.value / pieChartData.totalComplaints) * 100;
                      const startAngle = (cumulativePercentage / 100) * 360;
                      const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
                      
                      const startAngleRad = (startAngle * Math.PI) / 180;
                      const endAngleRad = (endAngle * Math.PI) / 180;
                      
                      const largeArcFlag = percentage > 50 ? 1 : 0;
                      
                      const x1 = 50 + 40 * Math.cos(startAngleRad);
                      const y1 = 50 + 40 * Math.sin(startAngleRad);
                      const x2 = 50 + 40 * Math.cos(endAngleRad);
                      const y2 = 50 + 40 * Math.sin(endAngleRad);
                      
                      const pathData = [
                        `M 50 50`,
                        `L ${x1} ${y1}`,
                        `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                        `Z`
                      ].join(' ');
                      
                      cumulativePercentage += percentage;
                      
                      return (
                        <g key={index}>
                          {/* Shadow/Glow Effect */}
                          <path
                            d={pathData}
                            fill="rgba(0,0,0,0.1)"
                            stroke="none"
                            transform="translate(1, 1)"
                            className="opacity-0 hover:opacity-100 transition-opacity duration-300"
                          />
                          {/* Main Path */}
                          <path
                            d={pathData}
                            fill={item.color}
                            stroke="white"
                            strokeWidth="1"
                            className="hover:opacity-90 transition-all duration-500 cursor-pointer transform hover:scale-110 hover:rotate-2"
                            style={{ 
                              transformOrigin: '50px 50px',
                              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                            }}
                            title={`${item.name}: ${item.value} เรื่อง (${item.percentage}%)`}
                            onMouseEnter={(e) => {
                              e.target.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.3)) brightness(1.15) saturate(1.2)';
                              e.target.style.strokeWidth = '2';
                              e.target.style.stroke = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
                              e.target.style.strokeWidth = '1';
                              e.target.style.stroke = 'white';
                            }}
                          />
                          {/* Inner Glow */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="0.5"
                            className="opacity-0 hover:opacity-100 transition-opacity duration-300"
                          />
                        </g>
                      );
                    });
                  })()}
                </svg>
                
                {/* Center Text */}
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="text-center">
                    <div className="relative">
                      {/* Background Glow */}
                      <div className="absolute inset-0 bg-white/20 rounded-full blur-sm scale-110"></div>
                      {/* Main Number */}
                      <div className="relative text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700 transition-all duration-500 cursor-default transform hover:scale-110">
                        {pieChartData.totalComplaints}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 hover:text-gray-800 transition-colors duration-300 mt-1 font-medium">เรื่องทั้งหมด</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 mb-4">รายละเอียดตามประเภท</h4>
              {pieChartData.pieData.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-blue-50 hover:to-purple-50 hover:shadow-lg hover:shadow-blue-200/50 transition-all duration-500 cursor-pointer group border border-gray-200 hover:border-blue-300"
                  onMouseEnter={(e) => {
                    // Highlight corresponding pie slice
                    const svgPaths = document.querySelectorAll('svg path');
                    if (svgPaths[index]) {
                      svgPaths[index].style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.3)) brightness(1.15) saturate(1.2)';
                      svgPaths[index].style.transform = 'scale(1.1) rotate(2deg)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    // Reset pie slice
                    const svgPaths = document.querySelectorAll('svg path');
                    if (svgPaths[index]) {
                      svgPaths[index].style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
                      svgPaths[index].style.transform = 'scale(1) rotate(0deg)';
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {/* Glow Effect */}
                      <div 
                        className="absolute inset-0 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      {/* Main Dot */}
                      <div 
                        className="relative w-5 h-5 rounded-full group-hover:scale-125 transition-all duration-300 border-2 border-white shadow-md"
                        style={{ backgroundColor: item.color }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                      {item.value} เรื่อง
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors duration-300 font-medium">
                      {item.percentage}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>ไม่มีข้อมูลสำหรับแสดงพายชาร์ต</p>
          </div>
        )}
      </div>

      {/* Top Reporters Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">ผู้แจ้งบ่อยที่สุด</h3>
          <div className="text-sm text-gray-500">
            นับจากเบอร์โทรศัพท์
            {dateRange !== 'all' && (
              <span className="ml-2 text-blue-600">
                • กรองตาม {dateRange === '7d' ? '7 วันล่าสุด' : dateRange === '30d' ? '30 วันล่าสุด' : '90 วันล่าสุด'}
              </span>
            )}
            {fiscalYearFilter === "2568" && (
              <span className="ml-2 text-green-600">
                • ปีงบประมาณ 2568
              </span>
            )}
          </div>
        </div>
        
        {topReporters.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>ไม่มีข้อมูลผู้แจ้ง</p>
            {dateRange !== 'all' && (
              <p className="text-sm mt-2">
                ในช่วงเวลา {dateRange === '7d' ? '7 วันล่าสุด' : dateRange === '30d' ? '30 วันล่าสุด' : '90 วันล่าสุด'}
              </p>
            )}
            {fiscalYearFilter === "2568" && (
              <p className="text-sm mt-2">ในปีงบประมาณ 2568</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {topReporters.map((reporter, index) => {
              const getRankColor = (rank) => {
                if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-300';
                if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-300';
                return 'bg-blue-100 text-blue-800 border-blue-300';
              };
              
              const getRankIcon = (rank) => {
                if (rank === 1) return '🥇';
                if (rank === 2) return '🥈';
                if (rank === 3) return '🥉';
                return `#${rank}`;
              };
              
              return (
                <div key={reporter.phone} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${getRankColor(index + 1)}`}>
                        {getRankIcon(index + 1)}
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{reporter.name}</h4>
                        <p className="text-sm text-gray-600">{reporter.phone}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>แจ้ง {reporter.count} ครั้ง</span>
                          <span>•</span>
                          <span>ชุมชน: {reporter.complaints[0]?.community || 'ไม่ระบุ'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{reporter.count}</div>
                      <div className="text-xs text-gray-500">ครั้ง</div>
                    </div>
                  </div>
                  
                  {/* แสดงประเภทปัญหาที่แจ้งบ่อย */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        const categoryCounts = {};
                        reporter.complaints.forEach(complaint => {
                          if (complaint.category) {
                            categoryCounts[complaint.category] = (categoryCounts[complaint.category] || 0) + 1;
                          }
                        });
                        
                        return Object.entries(categoryCounts)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 3)
                          .map(([category, count]) => (
                            <span key={category} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {category} ({count})
                            </span>
                          ));
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {topReporters.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              แสดง {topReporters.length} ผู้แจ้ง
              {dateRange !== 'all' && (
                <span className="text-blue-600">
                  {' '}ในช่วงเวลา {dateRange === '7d' ? '7 วันล่าสุด' : dateRange === '30d' ? '30 วันล่าสุด' : '90 วันล่าสุด'}
                </span>
              )}
              {fiscalYearFilter === "2568" && (
                <span className="text-green-600"> ในปีงบประมาณ 2568</span>
              )}
            </p>
          </div>
        )}
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
                {filteredComplaints
                  .slice()
                  .sort((a,b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
                  .slice((recentPage - 1) * RECENT_PAGE_SIZE, recentPage * RECENT_PAGE_SIZE)
                  .map((complaint) => (
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
        {/* Pagination */}
        {filteredComplaints.length > 0 && (
          <div className="flex items-center justify-between p-4 border-t text-sm text-gray-600">
            <div>
              แสดง {(recentPage - 1) * RECENT_PAGE_SIZE + 1}
              -{Math.min(recentPage * RECENT_PAGE_SIZE, filteredComplaints.length)} จาก {filteredComplaints.length} เรื่อง
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRecentPage(p => Math.max(1, p - 1))}
                disabled={recentPage === 1}
                className={`px-3 py-1 rounded border ${recentPage === 1 ? 'text-gray-400 bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
              >ก่อนหน้า</button>
              <button
                onClick={() => setRecentPage(p => (p * RECENT_PAGE_SIZE < filteredComplaints.length ? p + 1 : p))}
                disabled={recentPage * RECENT_PAGE_SIZE >= filteredComplaints.length}
                className={`px-3 py-1 rounded border ${recentPage * RECENT_PAGE_SIZE >= filteredComplaints.length ? 'text-gray-400 bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
              >ถัดไป</button>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal สำหรับแสดงรายการเรื่องร้องเรียน */}
      <ComplaintsModal />

      {/* Modal รายละเอียดแบบหน้า manage-complaints */}
      {showDetailModal && selectedComplaintDetail && (
        <ComplaintDetailModal
          complaint={selectedComplaintDetail}
          isOpen={showDetailModal}
          onClose={closeDetailModal}
          assignments={assignments}
          menu={menu}
          assignedUsers={assignedUsersMap}
        />
      )}
    </div>
  );
}
