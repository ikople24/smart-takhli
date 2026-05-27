import { useEffect, useState, useMemo, useCallback } from "react";
import LayoutAdmin from "@/components/LayoutAdmin";
import ComplaintDetailModal from "@/components/ComplaintDetailModal";
import ExportComplaints from "@/components/ExportComplaints";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { 
  ChartBarIcon, 
  MapPinIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  StarIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  UsersIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ChevronRightIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { createProblemAreaPolygons, createRectanglePolygon, createCommunityPolygon } from '@/utils/polygonUtils';
import { loadGeoJSONFromFile, createCommunityPolygonsFromGeoJSON, createProblemAreaPolygonsFromGeoJSON } from '@/utils/geojsonUtils';

// Dynamic import for map component to avoid SSR issues
const MapWithNoSSR = dynamic(() => import('@/components/AdminDashboardMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse rounded-2xl flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-medium">กำลังโหลดแผนที่...</p>
      </div>
    </div>
  )
});

/** ช่วงละ 4 เดือนในปีงบไทย (1 ต.ค. – 30 ก.ย.) — fyYearBe คือ พ.ศ. ของปีงบ — slot 1..3 */
function getFiscalFourMonthBounds(fyYearBe, slot) {
  const fy = parseInt(fyYearBe, 10);
  if (Number.isNaN(fy) || slot < 1 || slot > 3) return null;
  const ge = fy - 543;
  switch (slot) {
    case 1:
      return { start: new Date(ge - 1, 9, 1), end: new Date(ge, 0, 31, 23, 59, 59, 999) };
    case 2:
      return { start: new Date(ge, 1, 1), end: new Date(ge, 4, 31, 23, 59, 59, 999) };
    case 3:
      return { start: new Date(ge, 5, 1), end: new Date(ge, 8, 30, 23, 59, 59, 999) };
    default:
      return null;
  }
}

function getInitialFiscalFourMonthSlot() {
  const month = new Date().getMonth();
  if (month >= 9 || month === 0) return 1;
  if (month <= 4) return 2;
  return 3;
}

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
  // Calculate initial fiscal year for default selection
  const getInitialFiscalYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    if (currentMonth >= 9) {
      return (currentYear + 543 + 1).toString();
    }
    return (currentYear + 543).toString();
  };

  const [dateRange, setDateRange] = useState("all");
  const [fiscalYearFilter, setFiscalYearFilter] = useState(getInitialFiscalYear);
  const [selectedMonth, setSelectedMonth] = useState(null); // Format: "YYYY-MM"
  const [filterMode, setFilterMode] = useState("fiscal"); // "quick" | "month" | "fiscal" | "fourmonth"
  const [fiscalFourMonthSlot, setFiscalFourMonthSlot] = useState(getInitialFiscalFourMonthSlot);
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");

  // Thai months array
  const thaiMonths = [
    { value: 1, label: "มกราคม", short: "ม.ค." },
    { value: 2, label: "กุมภาพันธ์", short: "ก.พ." },
    { value: 3, label: "มีนาคม", short: "มี.ค." },
    { value: 4, label: "เมษายน", short: "เม.ย." },
    { value: 5, label: "พฤษภาคม", short: "พ.ค." },
    { value: 6, label: "มิถุนายน", short: "มิ.ย." },
    { value: 7, label: "กรกฎาคม", short: "ก.ค." },
    { value: 8, label: "สิงหาคม", short: "ส.ค." },
    { value: 9, label: "กันยายน", short: "ก.ย." },
    { value: 10, label: "ตุลาคม", short: "ต.ค." },
    { value: 11, label: "พฤศจิกายน", short: "พ.ย." },
    { value: 12, label: "ธันวาคม", short: "ธ.ค." }
  ];

  // Calculate current fiscal year and available fiscal years
  const getFiscalYearInfo = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    
    // Thai fiscal year: October to September
    // If current month >= October (9), we're in the next Buddhist year's fiscal year
    // Buddhist year = Gregorian year + 543
    let currentFiscalYear;
    if (currentMonth >= 9) { // October onwards
      currentFiscalYear = currentYear + 543 + 1; // e.g., Oct 2024 = FY 2568
    } else {
      currentFiscalYear = currentYear + 543; // e.g., Jan 2025 = FY 2568
    }
    
    // Generate available fiscal years (current and previous, plus next if we're near the end)
    const availableFiscalYears = [];
    
    // Previous fiscal year
    availableFiscalYears.push({
      year: currentFiscalYear - 1,
      startDate: new Date(currentFiscalYear - 1 - 543 - 1, 9, 1), // Oct of previous year
      endDate: new Date(currentFiscalYear - 1 - 543, 8, 30), // Sep of current gregorian year
      isPast: true
    });
    
    // Current fiscal year
    availableFiscalYears.push({
      year: currentFiscalYear,
      startDate: new Date(currentFiscalYear - 543 - 1, 9, 1),
      endDate: new Date(currentFiscalYear - 543, 8, 30),
      isCurrent: true
    });
    
    // Next fiscal year (show if we're in the last quarter of current fiscal year - July onwards)
    if (currentMonth >= 6) { // July onwards, show next fiscal year
      availableFiscalYears.push({
        year: currentFiscalYear + 1,
        startDate: new Date(currentFiscalYear - 543, 9, 1),
        endDate: new Date(currentFiscalYear - 543 + 1, 8, 30),
        isNext: true
      });
    }
    
    return {
      currentFiscalYear,
      availableFiscalYears,
      currentMonth: currentMonth + 1, // 1-12
      currentYear
    };
  }, []);

  // Get available months for selection based on selected year
  const getAvailableMonths = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    
    // Generate last 24 months for selection
    const months = [];
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const buddhistYear = year + 543;
      
      months.push({
        value: `${year}-${month.toString().padStart(2, '0')}`,
        year,
        month,
        buddhistYear,
        label: `${thaiMonths[month - 1].short} ${buddhistYear}`,
        fullLabel: `${thaiMonths[month - 1].label} ${buddhistYear}`,
        isCurrent: i === 0
      });
    }
    
    return months;
  }, []);

  // Get current month value
  const getCurrentMonthValue = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    return `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
  }, []);
  
  const [polygons, setPolygons] = useState([]);
  const [geojsonData, setGeojsonData] = useState(null);
  const [geojsonLoading, setGeojsonLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [assignedUsersMap, setAssignedUsersMap] = useState({});
  const [recentPage, setRecentPage] = useState(1);
  const RECENT_PAGE_SIZE = 10;
  const [topReporters, setTopReporters] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');

  const { menu, fetchMenu } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();

  useEffect(() => {
    if (isLoaded && !userId) {
      router.replace("/");
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    if (userId) {
      const loadAllData = async () => {
        try {
          await Promise.all([
            loadGeoJSONData(),
            fetchMenu(),
            fetchProblemOptions()
          ]);
          await new Promise(resolve => setTimeout(resolve, 500));
          await fetchDashboardData();
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };
      loadAllData();
    }
  }, [userId, dateRange, fiscalYearFilter, selectedMonth, filterMode, fiscalFourMonthSlot]);

  // Helper function to generate community statistics popup content
  const generateCommunityPopupContent = (polygon, communityComplaints, menuData, problemOptionsData) => {
    const total = communityComplaints.length;
    const completed = communityComplaints.filter(c => 
      c.status === 'completed' || c.status === 'ดำเนินการเสร็จสิ้น'
    ).length;
    const inProgress = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Helper to get category icon
    const getCategoryIcon = (categoryName) => {
      const matched = menuData?.find(m => m.Prob_name === categoryName);
      return matched?.Prob_pic || null;
    };
    
    // Helper to get problem option icon
    const getProblemOptionIcon = (problemLabel) => {
      const cleanLabel = problemLabel.trim().toLowerCase();
      const matched = problemOptionsData?.find(opt => {
        const optLabel = (opt.label || '').trim().toLowerCase();
        return optLabel === cleanLabel || optLabel.includes(cleanLabel) || cleanLabel.includes(optLabel);
      });
      return matched?.iconUrl || null;
    };
    
    // Group complaints by category and count problem options (not just unique)
    const categoryGroups = {};
    communityComplaints.forEach(c => {
      const cat = c.category || 'ไม่ระบุ';
      if (!categoryGroups[cat]) {
        categoryGroups[cat] = {
          count: 0,
          problemCounts: {} // Count each problem option occurrence
        };
      }
      categoryGroups[cat].count++;
      
      // Count problem options from each complaint
      if (c.problems && Array.isArray(c.problems)) {
        c.problems.forEach(p => {
          if (p && typeof p === 'string' && p.trim()) {
            const problemKey = p.trim();
            categoryGroups[cat].problemCounts[problemKey] = (categoryGroups[cat].problemCounts[problemKey] || 0) + 1;
          }
        });
      }
    });
    
    // Sort categories by count
    const sortedCategories = Object.entries(categoryGroups)
      .sort(([,a], [,b]) => b.count - a.count);
    
    // Find top problem across all categories
    let topProblem = { name: '', count: 0, category: '' };
    sortedCategories.forEach(([cat, data]) => {
      Object.entries(data.problemCounts).forEach(([problem, count]) => {
        if (count > topProblem.count) {
          topProblem = { name: problem, count, category: cat };
        }
      });
    });
    
    // Generate HTML for each category with problem option tags (with counts)
    const categoryHtml = sortedCategories.length > 0 
      ? sortedCategories.map(([cat, data]) => {
          // Sort problems by count
          const sortedProblems = Object.entries(data.problemCounts)
            .sort(([,a], [,b]) => b - a);
          
          const catIcon = getCategoryIcon(cat);
          const catIconHtml = catIcon 
            ? `<img src="${catIcon}" alt="${cat}" style="width: 20px; height: 20px; object-fit: contain; border-radius: 4px;" />`
            : '';
          
          // Create tag-style items for problem options with icons and counts
          const tagsHtml = sortedProblems.length > 0 
            ? sortedProblems.slice(0, 6).map(([problem, count]) => {
                const problemIcon = getProblemOptionIcon(problem);
                const iconHtml = problemIcon 
                  ? `<img src="${problemIcon}" alt="${problem}" style="width: 14px; height: 14px; object-fit: contain;" />`
                  : '';
                const countBadge = count > 1 
                  ? `<span style="background: #3b82f6; color: white; font-size: 9px; padding: 1px 5px; border-radius: 8px; margin-left: 2px;">${count}</span>`
                  : '';
                return `<span style="display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #93c5fd; color: #1d4ed8; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; white-space: nowrap;">${iconHtml}${problem}${countBadge}</span>`;
              }).join('')
            : '<span style="font-size: 11px; color: #94a3b8; font-style: italic;">ไม่มีรายละเอียดปัญหา</span>';
          
          const moreCount = sortedProblems.length > 6 
            ? `<span style="display: inline-flex; align-items: center; background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 500;">+${sortedProblems.length - 6} เพิ่มเติม</span>` 
            : '';
          
          return `
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding: 6px 8px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  ${catIconHtml}
                  <span style="font-size: 12px; font-weight: 600; color: #334155;">${cat}</span>
                </div>
                <span style="font-size: 10px; font-weight: 600; color: white; background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 2px 8px; border-radius: 10px;">${data.count}</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-left: 4px;">
                ${tagsHtml}
                ${moreCount}
              </div>
            </div>
          `;
        }).join('')
      : '<p style="font-size: 12px; color: #94a3b8; text-align: center;">ไม่มีข้อมูล</p>';
    
    // Analytics section
    const analyticsHtml = total > 0 ? `
      <div style="margin-top: 12px; padding: 10px; background: linear-gradient(135deg, #faf5ff, #f3e8ff); border-radius: 10px; border: 1px solid #e9d5ff;">
        <p style="font-size: 10px; font-weight: 600; color: #7c3aed; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">📊 สรุปวิเคราะห์</p>
        
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <!-- Completion Rate -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; color: #6b7280; min-width: 80px;">อัตราสำเร็จ:</span>
            <div style="flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;">
              <div style="width: ${completionRate}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 4px;"></div>
            </div>
            <span style="font-size: 11px; font-weight: 600; color: ${completionRate >= 80 ? '#059669' : completionRate >= 50 ? '#d97706' : '#dc2626'};">${completionRate}%</span>
          </div>
          
          <!-- Top Problem -->
          ${topProblem.name ? `
          <div style="display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: white; border-radius: 6px;">
            <span style="font-size: 10px; color: #6b7280;">🔥 ปัญหาพบบ่อย:</span>
            <span style="font-size: 11px; font-weight: 600; color: #dc2626;">${topProblem.name}</span>
            <span style="font-size: 9px; background: #fef2f2; color: #dc2626; padding: 2px 6px; border-radius: 4px;">${topProblem.count} ครั้ง</span>
          </div>
          ` : ''}
          
          <!-- Top Category -->
          ${sortedCategories.length > 0 ? `
          <div style="display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: white; border-radius: 6px;">
            <span style="font-size: 10px; color: #6b7280;">📌 ประเภทหลัก:</span>
            <span style="font-size: 11px; font-weight: 600; color: #2563eb;">${sortedCategories[0][0]}</span>
            <span style="font-size: 9px; background: #eff6ff; color: #2563eb; padding: 2px 6px; border-radius: 4px;">${Math.round((sortedCategories[0][1].count / total) * 100)}%</span>
          </div>
          ` : ''}
          
          <!-- Status Summary -->
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <div style="flex: 1; text-align: center; padding: 4px; background: ${inProgress > 0 ? '#fef3c7' : '#f1f5f9'}; border-radius: 4px;">
              <span style="font-size: 9px; color: ${inProgress > 0 ? '#92400e' : '#6b7280'};">
                ${inProgress > 0 ? '⏳ รอดำเนินการ ' + inProgress + ' เรื่อง' : '✅ ไม่มีค้าง'}
              </span>
            </div>
          </div>
        </div>
      </div>
    ` : '';
    
    return `
      <div style="min-width: 300px; max-width: 400px;">
        <div style="background: linear-gradient(135deg, ${polygon.color}, ${polygon.color}dd); color: white; padding: 12px 14px; border-radius: 12px 12px 0 0; margin: -1px -1px 0 -1px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 700;">🏘️ ${polygon.name}</h3>
        </div>
        <div style="padding: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 12px;">
            <div style="text-align: center; padding: 8px 4px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 8px;">
              <div style="font-size: 18px; font-weight: 700; color: #3b82f6;">${total}</div>
              <div style="font-size: 9px; color: #64748b;">ทั้งหมด</div>
            </div>
            <div style="text-align: center; padding: 8px 4px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 8px;">
              <div style="font-size: 18px; font-weight: 700; color: #d97706;">${inProgress}</div>
              <div style="font-size: 9px; color: #64748b;">ดำเนินการ</div>
            </div>
            <div style="text-align: center; padding: 8px 4px; background: linear-gradient(135deg, #dcfce7, #bbf7d0); border-radius: 8px;">
              <div style="font-size: 18px; font-weight: 700; color: #059669;">${completed}</div>
              <div style="font-size: 9px; color: #64748b;">เสร็จสิ้น</div>
            </div>
          </div>
          ${total > 0 ? `
            <div style="max-height: 300px; overflow-y: auto; padding-right: 4px;">
              <p style="font-size: 10px; font-weight: 600; color: #94a3b8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">📋 ปัญหาที่พบในชุมชน</p>
              ${categoryHtml}
              ${analyticsHtml}
            </div>
          ` : '<p style="font-size: 12px; color: #94a3b8; text-align: center; padding: 12px;">✨ ไม่มีเรื่องร้องเรียนในชุมชนนี้</p>'}
        </div>
      </div>
    `;
  };

  useEffect(() => {
    if (!geojsonLoading && geojsonData && complaints.length >= 0 && menu && problemOptions) {
      const communityPolygons = createCommunityPolygonsFromGeoJSON(geojsonData, {
        fillOpacity: 0.15,
        weight: 2,
        customPopupContent: (polygon) => {
          // Filter complaints that belong to this community
          const communityComplaints = complaints.filter(c => 
            c.community === polygon.name || 
            c.community === polygon.boundaryor
          );
          return generateCommunityPopupContent(polygon, communityComplaints, menu, problemOptions);
        }
      });
      setPolygons(communityPolygons);
    } else if (!geojsonLoading && !geojsonData && complaints.length > 0) {
      const problemAreaPolygons = createProblemAreaPolygons(complaints, 3);
      setPolygons(problemAreaPolygons);
    }
  }, [geojsonLoading, geojsonData, complaints, menu, problemOptions]);

  const loadGeoJSONData = async () => {
    try {
      setGeojsonLoading(true);
      const data = await loadGeoJSONFromFile('/takhli.geojson');
      setGeojsonData(data);
    } catch (error) {
      console.error('Error loading GeoJSON data:', error);
    } finally {
      setGeojsonLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const complaintsRes = await fetch(`/api/complaints?role=admin`);
      const complaintsData = await complaintsRes.json();
      
      const satisfactionRes = await fetch('/api/satisfaction/stats');
      const satisfactionData = await satisfactionRes.json();
      
      const assignmentsUrl = `/api/assignments/with-users?dateRange=${dateRange}&fiscalYear=${fiscalYearFilter || ''}`;
      const assignmentsRes = await fetch(assignmentsUrl);
      const assignmentsData = await assignmentsRes.json();
      
      const namesMap = {};
      if (assignmentsData.success && assignmentsData.assignments) {
        assignmentsData.assignments.forEach(assignment => {
          if (assignment.userId && assignment.user) {
            namesMap[assignment.userId] = assignment.user.name || `พนักงาน ${assignment.userId.slice(-6)}`;
          }
        });
        setAssignments(assignmentsData.assignments);
        const usersMap = {};
        assignmentsData.assignments.forEach(a => {
          if (a.userId && a.user) usersMap[a.userId] = a.user;
        });
        setAssignedUsersMap(usersMap);
      }
      setOfficerNames(namesMap);
      
      const filteredComplaints = filterComplaintsByDateRange(
        complaintsData,
        dateRange,
        fiscalYearFilter,
        selectedMonth,
        filterMode === "fourmonth" ? fiscalFourMonthSlot : null
      );
      
      // Filter assignments by the same date range
      const allAssignments = assignmentsData.assignments || assignmentsData || [];
      const filteredAssignments = filterAssignmentsByDateRange(
        allAssignments,
        dateRange,
        fiscalYearFilter,
        selectedMonth,
        filterMode === "fourmonth" ? fiscalFourMonthSlot : null
      );
      
      const calculatedStats = calculateStats(filteredComplaints, satisfactionData, filteredAssignments);
      
      setComplaints(filteredComplaints);
      setStats(calculatedStats);
      
      const topReportersData = calculateTopReporters(filteredComplaints);
      setTopReporters(topReportersData);
      
      const pieChartDataResult = calculatePieChartData(filteredComplaints);
      setPieChartData(pieChartDataResult);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterComplaintsByDateRange = (complaints, range, fiscalYear = null, month = null, fourMonthSlot = null) => {
    const now = new Date();
    const filtered = complaints.filter(complaint => {
      const complaintDate = new Date(complaint.timestamp || complaint.createdAt);
      
      // Filter by specific month if selected
      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        const monthStart = new Date(year, monthNum - 1, 1);
        const monthEnd = new Date(year, monthNum, 0, 23, 59, 59); // Last day of month
        if (complaintDate < monthStart || complaintDate > monthEnd) {
          return false;
        }
        return true; // If month is selected, only filter by month
      }

      // ช่วงละ 4 เดือน (ปีงบ + ช่วงที่ 1–3)
      if (fourMonthSlot != null && fiscalYear) {
        const bounds = getFiscalFourMonthBounds(fiscalYear, fourMonthSlot);
        if (!bounds) return false;
        if (complaintDate < bounds.start || complaintDate > bounds.end) {
          return false;
        }
        return true;
      }
      
      // Filter by fiscal year if selected
      if (fiscalYear) {
        const fyYear = parseInt(fiscalYear);
        const gregorianYear = fyYear - 543;
        const fiscalStart = new Date(gregorianYear - 1, 9, 1); // October of previous year
        const fiscalEnd = new Date(gregorianYear, 8, 30, 23, 59, 59); // September 30
        if (complaintDate < fiscalStart || complaintDate > fiscalEnd) {
          return false;
        }
        // If fiscal year selected with dateRange, continue to check dateRange
        if (range === "all") return true;
      }
      
      // Filter by date range
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

  // Filter assignments by date range (similar to complaints)
  const filterAssignmentsByDateRange = (assignments, range, fiscalYear = null, month = null, fourMonthSlot = null) => {
    if (!assignments || !Array.isArray(assignments)) return [];
    
    const now = new Date();
    const filtered = assignments.filter(assignment => {
      // Use completedAt for completed assignments, or assignedAt for pending ones
      const assignmentDate = new Date(assignment.completedAt || assignment.assignedAt || assignment.createdAt);
      
      // Filter by specific month if selected
      if (month) {
        const [year, monthNum] = month.split('-').map(Number);
        const monthStart = new Date(year, monthNum - 1, 1);
        const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);
        if (assignmentDate < monthStart || assignmentDate > monthEnd) {
          return false;
        }
        return true;
      }

      if (fourMonthSlot != null && fiscalYear) {
        const bounds = getFiscalFourMonthBounds(fiscalYear, fourMonthSlot);
        if (!bounds) return false;
        if (assignmentDate < bounds.start || assignmentDate > bounds.end) {
          return false;
        }
        return true;
      }
      
      // Filter by fiscal year if selected
      if (fiscalYear) {
        const fyYear = parseInt(fiscalYear);
        const gregorianYear = fyYear - 543;
        const fiscalStart = new Date(gregorianYear - 1, 9, 1);
        const fiscalEnd = new Date(gregorianYear, 8, 30, 23, 59, 59);
        if (assignmentDate < fiscalStart || assignmentDate > fiscalEnd) {
          return false;
        }
        if (range === "all") return true;
      }
      
      // Filter by date range
      switch (range) {
        case "7d":
          return (now - assignmentDate) <= 7 * 24 * 60 * 60 * 1000;
        case "30d":
          return (now - assignmentDate) <= 30 * 24 * 60 * 60 * 1000;
        case "90d":
          return (now - assignmentDate) <= 90 * 24 * 60 * 60 * 1000;
        case "all":
        default:
          return true;
      }
    });
    return filtered;
  };

  const filterComplaintsByCategoryAndTime = (category, timeCategory) => {
    const filtered = complaints.filter(complaint => {
      if (complaint.category !== category) return false;
      
      if (complaint.status === "completed" || complaint.status === "ดำเนินการเสร็จสิ้น") {
        const createdAt = new Date(complaint.timestamp || complaint.createdAt);
        const completedAt = new Date(complaint.completedAt || complaint.updatedAt);
        const processingTimeHours = (completedAt - createdAt) / (1000 * 60 * 60);
        
        let complaintTimeCategory;
        if (processingTimeHours <= 24) complaintTimeCategory = '≤ 24 ชม.';
        else if (processingTimeHours <= 48) complaintTimeCategory = '1-2 วัน';
        else if (processingTimeHours <= 72) complaintTimeCategory = '2-3 วัน';
        else if (processingTimeHours <= 168) complaintTimeCategory = '3-7 วัน';
        else if (processingTimeHours <= 360) complaintTimeCategory = '7-15 วัน';
        else complaintTimeCategory = '> 15 วัน';
        
        return complaintTimeCategory === timeCategory;
      }
      return false;
    });
    return filtered;
  };

  const handleShowComplaints = (category, timeCategory) => {
    const filteredComplaints = filterComplaintsByCategoryAndTime(category, timeCategory);
    setSelectedComplaints(filteredComplaints);
    setModalTitle(`${category} - ${timeCategory} (${filteredComplaints.length} เรื่อง)`);
    setShowComplaintsModal(true);
  };

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

  const calculateTopReporters = (complaints) => {
    const phoneCounts = {};
    complaints.forEach(complaint => {
      if (complaint.phone && complaint.fullName) {
        const phone = complaint.phone.trim();
        const name = complaint.fullName.trim();
        if (phone && name) {
          if (!phoneCounts[phone]) {
            phoneCounts[phone] = { phone, name, count: 0, complaints: [] };
          }
          phoneCounts[phone].count++;
          phoneCounts[phone].complaints.push(complaint);
        }
      }
    });
    return Object.values(phoneCounts).sort((a, b) => b.count - a.count).slice(0, 5);
  };

  const calculatePieChartData = (complaints) => {
    const uniqueReporters = new Set();
    const categoryCounts = {};
    
    complaints.forEach(complaint => {
      if (complaint.phone && complaint.fullName) {
        const phone = complaint.phone.trim();
        const name = complaint.fullName.trim();
        if (phone && name) {
          uniqueReporters.add(`${phone}_${name}`);
          if (complaint.category) {
            categoryCounts[complaint.category] = (categoryCounts[complaint.category] || 0) + 1;
          }
        }
      }
    });
    
    const colors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981',
      '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#f97316'
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
      pieData
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
          stats.inProgress++;
      }

      const complaintDate = new Date(complaint.timestamp || complaint.createdAt);
      const daysSince = (new Date() - complaintDate) / (1000 * 60 * 60 * 24);
      if (daysSince > 7 && complaint.status !== 'completed' && complaint.status !== 'ดำเนินการเสร็จสิ้น') {
        stats.overdue++;
      }

      const category = complaint.category || 'ไม่ระบุ';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      const community = complaint.community || 'ไม่ระบุ';
      stats.byCommunity[community] = (stats.byCommunity[community] || 0) + 1;

      if (complaint.status === 'completed' || complaint.status === 'ดำเนินการเสร็จสิ้น') {
        const startDate = new Date(complaint.timestamp || complaint.createdAt);
        const endDate = new Date(complaint.updatedAt || complaint.timestamp || complaint.createdAt);
        const processingTimeHours = Math.floor((endDate - startDate) / (1000 * 60 * 60));
        
        let timeCategory;
        if (processingTimeHours <= 24) timeCategory = '≤ 24 ชม.';
        else if (processingTimeHours <= 48) timeCategory = '1-2 วัน';
        else if (processingTimeHours <= 72) timeCategory = '2-3 วัน';
        else if (processingTimeHours <= 168) timeCategory = '3-7 วัน';
        else if (processingTimeHours <= 360) timeCategory = '7-15 วัน';
        else timeCategory = '> 15 วัน';

        stats.byProcessingTime[timeCategory] = (stats.byProcessingTime[timeCategory] || 0) + 1;

        if (!stats.byCategoryAndTime[category]) {
          stats.byCategoryAndTime[category] = {};
        }
        stats.byCategoryAndTime[category][timeCategory] = (stats.byCategoryAndTime[category][timeCategory] || 0) + 1;
      }
    });

    assignmentsData.forEach(assignment => {
      if (assignment.userId && assignment.completedAt) {
        const officerId = assignment.userId.toString();
        if (!stats.byOfficer[officerId]) {
          stats.byOfficer[officerId] = {
            totalAssigned: 0, totalCompleted: 0, totalProcessingTime: 0,
            averageProcessingTime: 0, fastCompletions: 0, mediumCompletions: 0, slowCompletions: 0
          };
        }
        stats.byOfficer[officerId].totalAssigned++;
        stats.byOfficer[officerId].totalCompleted++;
        
        const startDate = new Date(assignment.assignedAt);
        const endDate = new Date(assignment.completedAt);
        const processingTimeHours = Math.floor((endDate - startDate) / (1000 * 60 * 60));
        const validProcessingTime = Math.max(0, processingTimeHours);
        stats.byOfficer[officerId].totalProcessingTime += validProcessingTime;
        
        if (processingTimeHours <= 24) stats.byOfficer[officerId].fastCompletions++;
        else if (processingTimeHours <= 168) stats.byOfficer[officerId].mediumCompletions++;
        else stats.byOfficer[officerId].slowCompletions++;
      } else if (assignment.userId) {
        const officerId = assignment.userId.toString();
        if (!stats.byOfficer[officerId]) {
          stats.byOfficer[officerId] = {
            totalAssigned: 0, totalCompleted: 0, totalProcessingTime: 0,
            averageProcessingTime: 0, fastCompletions: 0, mediumCompletions: 0, slowCompletions: 0
          };
        }
        stats.byOfficer[officerId].totalAssigned++;
      }
    });

    Object.keys(stats.byOfficer).forEach(officerId => {
      const officer = stats.byOfficer[officerId];
      if (officer.totalCompleted > 0) {
        officer.averageProcessingTime = Math.round(officer.totalProcessingTime / officer.totalCompleted);
        const completionRate = Math.min(100, (officer.totalCompleted / officer.totalAssigned) * 100);
        let speedScore = officer.averageProcessingTime <= 0 ? 100 :
          officer.averageProcessingTime <= 24 ? 100 :
          Math.max(0, Math.min(100, 100 - ((officer.averageProcessingTime - 24) / 24) * 20));
        let volumeBonus = officer.totalAssigned >= 20 ? 20 :
          officer.totalAssigned >= 10 ? 15 : officer.totalAssigned >= 5 ? 10 : 0;
        officer.performanceScore = Math.min(100, Math.round((completionRate * 0.4) + (speedScore * 0.4) + (volumeBonus * 0.2)));
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
        return 'badge-in-progress';
      case 'completed':
      case 'ดำเนินการเสร็จสิ้น':
        return 'badge-completed';
      default:
        return 'badge-in-progress';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_progress':
      case 'อยู่ระหว่างดำเนินการ':
        return 'ดำเนินการ';
      case 'completed':
      case 'ดำเนินการเสร็จสิ้น':
        return 'เสร็จสิ้น';
      default:
        return 'ดำเนินการ';
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter(complaint => {
      const categoryMatch = selectedCategory === "ทั้งหมด" || complaint.category === selectedCategory;
      const statusMatch = selectedStatus === "ทั้งหมด" || 
        (selectedStatus === "in_progress" && (complaint.status === "in_progress" || complaint.status === "อยู่ระหว่างดำเนินการ")) ||
        (selectedStatus === "completed" && (complaint.status === "completed" || complaint.status === "ดำเนินการเสร็จสิ้น"));
      return categoryMatch && statusMatch;
    });
  }, [complaints, selectedCategory, selectedStatus]);

  const completionRate = useMemo(() => {
    return stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0;
  }, [stats]);

  const satisfactionPercent = useMemo(() => {
    return ((stats.satisfaction || 0) / 5) * 100;
  }, [stats.satisfaction]);

  const getDashboardExportFilename = useCallback(() => {
    const date = new Date().toISOString().split('T')[0];
    if (filterMode === "fiscal" && fiscalYearFilter) {
      return `complaints_fy${fiscalYearFilter}_${date}.csv`;
    }
    if (filterMode === "fourmonth" && fiscalYearFilter) {
      return `complaints_fy${fiscalYearFilter}_q${fiscalFourMonthSlot}_${date}.csv`;
    }
    if (filterMode === "month" && selectedMonth) {
      return `complaints_${selectedMonth}_${date}.csv`;
    }
    if (filterMode === "quick" && dateRange !== "all") {
      return `complaints_${dateRange}_${date}.csv`;
    }
    return `complaints_${date}.csv`;
  }, [filterMode, fiscalYearFilter, fiscalFourMonthSlot, selectedMonth, dateRange]);

  if (!isLoaded || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1800px] mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
            <div className="grid grid-cols-4 gap-6">
              {[1,2,3,4].map(i => <div key={i} className="h-36 bg-slate-200 rounded-2xl"></div>)}
            </div>
            <div className="h-[500px] bg-slate-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Modal Component
  const ComplaintsModal = () => {
    if (!showComplaintsModal) return null;
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-slate-50 to-white">
            <h3 className="text-xl font-bold text-slate-800">{modalTitle}</h3>
            <button onClick={() => setShowComplaintsModal(false)} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 dashboard-scroll">
            {selectedComplaints.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">ไม่พบเรื่องร้องเรียนที่ตรงกับเงื่อนไข</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedComplaints.map((complaint, index) => {
                  const createdAt = new Date(complaint.timestamp || complaint.createdAt);
                  const completedAt = new Date(complaint.completedAt || complaint.updatedAt);
                  const processingTimeHours = (completedAt - createdAt) / (1000 * 60 * 60);
                  const titleText = complaint.title?.trim() || complaint.detail?.trim() || complaint.problems?.[0] || 'ไม่มีหัวข้อ';
                  
                  return (
                    <div key={complaint._id} className="border border-slate-200 rounded-xl p-5 hover:bg-slate-50 cursor-pointer transition-all hover:shadow-lg hover:border-blue-200 group" onClick={() => openDetailModal(complaint)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-bold">#{index + 1}</span>
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{complaint.community || 'ไม่ระบุชุมชน'}</span>
                          </div>
                          <h4 className="font-semibold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">{titleText}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400 text-xs">วันที่แจ้ง</span>
                              <p className="font-medium text-slate-700">{createdAt.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">วันที่เสร็จ</span>
                              <p className="font-medium text-slate-700">{completedAt.toLocaleDateString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">ระยะเวลา</span>
                              <p className="font-medium text-slate-700">{processingTimeHours <= 24 ? `${Math.round(processingTimeHours)} ชม.` : `${Math.round(processingTimeHours / 24)} วัน`}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">ชุมชน</span>
                              <p className="font-medium text-slate-700">{complaint.community || 'ไม่ระบุ'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="badge-completed flex items-center gap-1.5">
                          <CheckCircleIcon className="w-4 h-4" />
                          เสร็จสิ้น
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-4 border-t bg-slate-50">
            <span className="text-sm text-slate-500">แสดง {selectedComplaints.length} เรื่อง</span>
            <button onClick={() => setShowComplaintsModal(false)} className="px-6 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium">ปิด</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <LayoutAdmin title="แดชบอร์ด">
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="max-w-[1800px] mx-auto p-4 lg:p-6 space-y-6">
        
        {/* Header Section */}
        <div className="dashboard-header">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <ChartBarIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold">แดชบอร์ดผู้ดูแลระบบ</h1>
                  <p className="text-blue-200 text-sm">ภาพรวมและสถิติการดำเนินงาน</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/admin/manage-complaints')} className="px-5 py-2.5 bg-white/10 backdrop-blur border border-white/20 text-white rounded-xl hover:bg-white/20 transition-all font-medium flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5" />
                จัดการเรื่องร้องเรียน
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Filters - Compact Dropdown Version */}
        <div className="dashboard-section p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Mode Tabs */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setFilterMode("fiscal");
                  setSelectedMonth(null);
                  setDateRange("all");
                  if (!fiscalYearFilter) {
                    setFiscalYearFilter(getFiscalYearInfo.currentFiscalYear.toString());
                  }
                }}
                className={`px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  filterMode === "fiscal" 
                    ? 'bg-white text-emerald-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                📊 ปีงบประมาณ
              </button>
              <button
                onClick={() => {
                  setFilterMode("fourmonth");
                  setSelectedMonth(null);
                  setDateRange("all");
                  if (!fiscalYearFilter) {
                    setFiscalYearFilter(getFiscalYearInfo.currentFiscalYear.toString());
                  }
                }}
                className={`px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  filterMode === "fourmonth"
                    ? 'bg-white text-amber-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                📐 ช่วง 4 เดือน
              </button>
              <button
                onClick={() => {
                  setFilterMode("month");
                  setFiscalYearFilter(null);
                  setDateRange("all");
                  if (!selectedMonth) {
                    setSelectedMonth(getCurrentMonthValue);
                  }
                }}
                className={`px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  filterMode === "month" 
                    ? 'bg-white text-violet-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                📅 รายเดือน
              </button>
              <button
                onClick={() => {
                  setFilterMode("quick");
                  setFiscalYearFilter(null);
                  setSelectedMonth(null);
                }}
                className={`px-2.5 sm:px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  filterMode === "quick" 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                ⚡ ช่วงเวลา
              </button>
            </div>

            {/* Fiscal Year Dropdown */}
            {filterMode === "fiscal" && (
              <div className="flex items-center gap-2">
                <select
                  value={fiscalYearFilter || ""}
                  onChange={(e) => {
                    setFiscalYearFilter(e.target.value);
                    setSelectedMonth(null);
                    setDateRange("all");
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl text-emerald-700 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer hover:border-emerald-300 transition-all"
                >
                  {getFiscalYearInfo.availableFiscalYears.map((fy) => (
                    <option key={fy.year} value={fy.year.toString()}>
                      ปีงบ {fy.year} {fy.isCurrent ? '(ปัจจุบัน)' : fy.isNext ? '(ถัดไป)' : ''}
                    </option>
                  ))}
                </select>
                {fiscalYearFilter && (
                  <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                    1 ต.ค. {parseInt(fiscalYearFilter) - 1} - 30 ก.ย. {fiscalYearFilter}
                  </span>
                )}
              </div>
            )}

            {filterMode === "fourmonth" && (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={fiscalYearFilter || ""}
                  onChange={(e) => {
                    setFiscalYearFilter(e.target.value);
                    setSelectedMonth(null);
                    setDateRange("all");
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl text-amber-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer hover:border-amber-300 transition-all"
                >
                  {getFiscalYearInfo.availableFiscalYears.map((fy) => (
                    <option key={fy.year} value={fy.year.toString()}>
                      ปีงบ {fy.year} {fy.isCurrent ? '(ปัจจุบัน)' : fy.isNext ? '(ถัดไป)' : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={fiscalFourMonthSlot}
                  onChange={(e) => setFiscalFourMonthSlot(Number(e.target.value))}
                  className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl text-amber-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer hover:border-amber-300 transition-all min-w-[220px]"
                >
                  <option value={1}>ช่วงที่ 1 — ต.ค. – ม.ค. (4 เดือน)</option>
                  <option value={2}>ช่วงที่ 2 — ก.พ. – พ.ค. (4 เดือน)</option>
                  <option value={3}>ช่วงที่ 3 — มิ.ย. – ก.ย. (4 เดือน)</option>
                </select>
                {fiscalYearFilter && (() => {
                  const b = getFiscalFourMonthBounds(fiscalYearFilter, fiscalFourMonthSlot);
                  if (!b) return null;
                  return (
                    <span className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded-lg">
                      {b.start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {b.end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  );
                })()}
              </div>
            )}

            {/* Month Dropdown */}
            {filterMode === "month" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth || ""}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setFiscalYearFilter(null);
                    setDateRange("all");
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-violet-50 to-purple-50 border-2 border-violet-200 rounded-xl text-violet-700 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer hover:border-violet-300 transition-all"
                >
                  {getAvailableMonths.map((monthData) => (
                    <option key={monthData.value} value={monthData.value}>
                      {monthData.fullLabel} {monthData.isCurrent ? '(เดือนนี้)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Date Range Buttons */}
            {filterMode === "quick" && (
              <div className="flex items-center gap-2">
                {[
                  { value: "7d", label: "7 วัน" },
                  { value: "30d", label: "30 วัน" },
                  { value: "90d", label: "90 วัน" },
                  { value: "all", label: "ทั้งหมด" }
                ].map((range) => (
                  <button
                    key={range.value}
                    onClick={() => { 
                      setDateRange(range.value); 
                      setFiscalYearFilter(null); 
                      setSelectedMonth(null); 
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      dateRange === range.value && filterMode === "quick"
                        ? 'bg-blue-500 text-white shadow-md' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            )}

            {/* Export + filter summary */}
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              <ExportComplaints
                complaints={complaints}
                assignments={assignments}
                allOnly
                getFilename={getDashboardExportFilename}
                disabled={loading}
                buttonClassName="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              />
              <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${
                filterMode === "fiscal" ? 'bg-emerald-100 text-emerald-700' :
                filterMode === "fourmonth" ? 'bg-amber-100 text-amber-900' :
                filterMode === "month" ? 'bg-violet-100 text-violet-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                <span className="font-medium">
                  {filterMode === "fiscal" && fiscalYearFilter && `ปีงบ ${fiscalYearFilter}`}
                  {filterMode === "fourmonth" && fiscalYearFilter && (
                    <>ปีงบ {fiscalYearFilter} · ช่วง {fiscalFourMonthSlot}/3 (4 เดือน)</>
                  )}
                  {filterMode === "month" && selectedMonth && getAvailableMonths.find(m => m.value === selectedMonth)?.label}
                  {filterMode === "quick" && (
                    dateRange === "7d" ? "7 วันล่าสุด" : 
                    dateRange === "30d" ? "30 วันล่าสุด" : 
                    dateRange === "90d" ? "90 วันล่าสุด" : 
                    "ทั้งหมด"
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
          {/* Total */}
          <div className="stat-card stat-gradient-blue rounded-2xl p-5 text-white">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <DocumentTextIcon className="w-6 h-6" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 opacity-60" />
            </div>
            <p className="text-blue-100 text-sm mb-1">เรื่องทั้งหมด</p>
            <p className="text-4xl font-bold tracking-tight counter-number">{stats.total}</p>
          </div>

          {/* In Progress */}
          <div className="stat-card stat-gradient-cyan rounded-2xl p-5 text-white">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <ClockIcon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-cyan-100 text-sm mb-1">กำลังดำเนินการ</p>
            <p className="text-4xl font-bold tracking-tight counter-number">{stats.inProgress}</p>
          </div>

          {/* Completed */}
          <div className="stat-card stat-gradient-green rounded-2xl p-5 text-white">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6" />
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{completionRate}%</span>
            </div>
            <p className="text-emerald-100 text-sm mb-1">เสร็จสิ้น</p>
            <p className="text-4xl font-bold tracking-tight counter-number">{stats.completed}</p>
          </div>

          {/* Overdue */}
          <div className={`stat-card stat-gradient-red rounded-2xl p-5 text-white ${stats.overdue > 0 ? 'pulse-alert' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-red-100 text-sm mb-1">เกินกำหนด</p>
            <p className="text-4xl font-bold tracking-tight counter-number">{stats.overdue}</p>
          </div>

          {/* Satisfaction */}
          <div className="stat-card stat-gradient-amber rounded-2xl p-5 text-white col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <StarIcon className="w-6 h-6" />
              </div>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(star => (
                  <StarIcon key={star} className={`w-4 h-4 ${star <= Math.round(stats.satisfaction) ? 'fill-current' : 'opacity-40'}`} />
                ))}
              </div>
            </div>
            <p className="text-amber-100 text-sm mb-1">ความพึงพอใจ</p>
            <p className="text-4xl font-bold tracking-tight counter-number">{satisfactionPercent.toFixed(1)}<span className="text-lg font-normal opacity-60">%</span></p>
          </div>
        </div>

        {/* Map Section with Integrated Filters */}
        <div className="dashboard-section p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <MapPinIcon className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">แผนที่แสดงตำแหน่งปัญหา</h3>
                <p className="text-sm text-slate-500">
                  แสดง {filteredComplaints.filter(c => c.location?.lat && c.location?.lng).length} ตำแหน่ง จาก {filteredComplaints.length} รายการ
                  {!geojsonLoading && geojsonData?.features && (
                    <span className="text-emerald-600 ml-2">• {geojsonData.features.length} ชุมชน</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {geojsonLoading && (
                <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  โหลด...
                </div>
              )}
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <FunnelIcon className="w-4 h-4 text-slate-400" />
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)} 
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-w-[140px]"
                >
                  <option value="ทั้งหมด">ประเภท: ทั้งหมด</option>
                  {Object.keys(stats.byCategory).map((category) => (
                    <option key={category} value={category}>{category} ({stats.byCategory[category]})</option>
                  ))}
                </select>
              </div>
              {/* Status Filter */}
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)} 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-w-[140px]"
              >
                <option value="ทั้งหมด">สถานะ: ทั้งหมด</option>
                <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
                <option value="completed">ดำเนินการเสร็จสิ้น</option>
              </select>
            </div>
          </div>
          <div className="map-container-modern">
            <MapWithNoSSR complaints={filteredComplaints} polygons={polygons} assignments={assignments} />
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Category Statistics */}
          <div className="dashboard-section p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-slate-800">สถิติตามประเภทปัญหา</h3>
            </div>
            <div className="space-y-4 max-h-[400px] overflow-y-auto dashboard-scroll pr-2">
              {Object.entries(stats.byCategory).sort(([,a], [,b]) => b - a).map(([category, count]) => {
                const categoryIcon = menu.find(m => m.Prob_name === category)?.Prob_pic;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={category} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {categoryIcon && <img src={categoryIcon} alt={category} className="w-6 h-6 object-contain" />}
                        <span className="text-sm font-medium text-slate-700">{category}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-800">{count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 progress-bar" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Community Statistics */}
          <div className="dashboard-section p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <BuildingOffice2Icon className="w-5 h-5 text-teal-600" />
                </div>
                <h3 className="font-semibold text-slate-800">สถิติตามชุมชน</h3>
              </div>
              <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">22 ชุมชน</span>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto dashboard-scroll pr-2">
              {(() => {
                const allCommunities = ["สามล", "รจนา", "หัวเขาตาคลี", "สว่างวงษ์", "ตาคลีพัฒนา", "ตีคลี", "ทิพย์พิมาน", "ตาคลีใหญ่", "บ้านใหม่โพนทอง", "วิลาวัลย์", "โพธิ์งาม", "พุทธนิมิต", "ยศวิมล", "ศรีเทพ", "สังข์ทอง", "ศรีสวัสดิ์", "เขาใบไม้", "จันทร์เทวี", "รวมใจ", "ตลาดโพนทอง", "มาลัย", "สารภี"];
                const allCommunityStats = allCommunities.map(c => ({ name: c, count: stats.byCommunity[c] || 0 })).sort((a, b) => b.count - a.count);
                const maxCount = Math.max(...allCommunityStats.map(c => c.count), 1);
                
                return allCommunityStats.map(({ name, count }, index) => {
                  const percentage = (count / maxCount) * 100;
                  const getColor = (c) => c === 0 ? 'from-slate-200 to-slate-300' : c <= 2 ? 'from-yellow-400 to-amber-500' : c <= 5 ? 'from-orange-400 to-orange-500' : c <= 10 ? 'from-emerald-400 to-emerald-500' : 'from-rose-400 to-rose-500';
                  return (
                    <div key={name} className="group">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-5">{index + 1}.</span>
                          <span className={`text-sm font-medium ${count === 0 ? 'text-slate-400' : 'text-slate-700'}`}>{name}</span>
                          {count === 0 && <span className="text-xs text-slate-400">(ไม่มีการแจ้ง)</span>}
                        </div>
                        <span className="text-sm font-bold text-slate-800">{count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${getColor(count)} rounded-full transition-all duration-500 progress-bar`} style={{ width: `${Math.max(percentage, count === 0 ? 0 : 5)}%` }}></div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Processing Time Statistics */}
        <div className="dashboard-section p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <ClockIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">สถิติการจัดการปัญหาตามระยะเวลา</h3>
                <p className="text-sm text-slate-500">แสดง {stats.completed} รายการที่เสร็จสิ้น</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {['≤ 24 ชม.', '1-2 วัน', '2-3 วัน', '3-7 วัน', '7-15 วัน', '> 15 วัน'].map((timeRange, index) => {
              const count = stats.byProcessingTime[timeRange] || 0;
              const percentage = stats.completed > 0 ? (count / stats.completed) * 100 : 0;
              const colors = ['from-emerald-400 to-emerald-500', 'from-blue-400 to-blue-500', 'from-indigo-400 to-indigo-500', 'from-amber-400 to-amber-500', 'from-orange-400 to-orange-500', 'from-rose-400 to-rose-500'];
              const bgColors = ['bg-emerald-50', 'bg-blue-50', 'bg-indigo-50', 'bg-amber-50', 'bg-orange-50', 'bg-rose-50'];
              const textColors = ['text-emerald-700', 'text-blue-700', 'text-indigo-700', 'text-amber-700', 'text-orange-700', 'text-rose-700'];
              return (
                <div key={timeRange} className={`${bgColors[index]} rounded-xl p-4 text-center hover-lift`}>
                  <div className={`text-3xl font-bold ${textColors[index]} mb-1`}>{count}</div>
                  <div className="text-sm font-medium text-slate-600 mb-2">{timeRange}</div>
                  <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${colors[index]} rounded-full`} style={{ width: `${Math.max(percentage, 5)}%` }}></div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category and Time Matrix */}
        <div className="dashboard-section p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="font-semibold text-slate-800">สถิติการจัดการปัญหาตามประเภทและระยะเวลา</h3>
          </div>
          <div className="space-y-4 max-h-[500px] overflow-y-auto dashboard-scroll">
            {Object.entries(stats.byCategoryAndTime).sort(([,a], [,b]) => Object.values(b).reduce((s, c) => s + c, 0) - Object.values(a).reduce((s, c) => s + c, 0)).map(([category, timeStats]) => {
              const total = Object.values(timeStats).reduce((s, c) => s + c, 0);
              return (
                <div key={category} className="border border-slate-200 rounded-xl p-4 hover:border-violet-200 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {menu.find(m => m.Prob_name === category)?.Prob_pic && (
                        <img src={menu.find(m => m.Prob_name === category)?.Prob_pic} alt={category} className="w-6 h-6 object-contain" />
                      )}
                      <h4 className="font-semibold text-slate-800">{category}</h4>
                    </div>
                    <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{total} รายการ</span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {['≤ 24 ชม.', '1-2 วัน', '2-3 วัน', '3-7 วัน', '7-15 วัน', '> 15 วัน'].map((t, i) => {
                      const count = timeStats[t] || 0;
                      const colors = ['bg-emerald-100 text-emerald-700 border-emerald-200', 'bg-blue-100 text-blue-700 border-blue-200', 'bg-indigo-100 text-indigo-700 border-indigo-200', 'bg-amber-100 text-amber-700 border-amber-200', 'bg-orange-100 text-orange-700 border-orange-200', 'bg-rose-100 text-rose-700 border-rose-200'];
                      return (
                        <div key={t} onClick={() => count > 0 && handleShowComplaints(category, t)} className={`px-3 py-2 rounded-lg border text-center cursor-pointer transition-all hover:shadow-md ${colors[i]}`}>
                          <div className="text-lg font-bold">{count}</div>
                          <div className="text-xs opacity-75">{t}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Officers */}
        <div className="dashboard-section p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">พนักงานที่จัดการเรื่องได้ดีที่สุด</h3>
                <p className="text-sm text-slate-500">อันดับ 1-5 ตามคะแนนประสิทธิภาพ</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(stats.byOfficer).sort(([,a], [,b]) => {
              if (a.totalAssigned < 3 && b.totalAssigned >= 3) return 1;
              if (b.totalAssigned < 3 && a.totalAssigned >= 3) return -1;
              return b.performanceScore - a.performanceScore || b.totalAssigned - a.totalAssigned;
            }).slice(0, 5).map(([officerId, data], index) => {
              const completionRate = data.totalAssigned > 0 ? (data.totalCompleted / data.totalAssigned) * 100 : 0;
              const rankBadges = ['rank-badge-gold', 'rank-badge-silver', 'rank-badge-bronze'];
              const rankIcons = ['🥇', '🥈', '🥉'];
              return (
                <div key={officerId} className="border border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-amber-200 transition-all group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`rank-badge ${rankBadges[index] || 'bg-slate-100 text-slate-600'}`}>
                      {index < 3 ? rankIcons[index] : `#${index + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-800 truncate">{officerNames[officerId] || `พนักงาน #${officerId.slice(-6)}`}</h4>
                      <p className="text-sm text-slate-500">คะแนน: {data.performanceScore}/100</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{data.totalCompleted}</div>
                      <div className="text-xs text-slate-500">เสร็จสิ้น</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mb-3">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="font-bold text-slate-700">{data.totalAssigned}</div>
                      <div className="text-xs text-slate-500">รับงาน</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <div className="font-bold text-emerald-600">{completionRate.toFixed(0)}%</div>
                      <div className="text-xs text-slate-500">สำเร็จ</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <div className="font-bold text-blue-600">{data.averageProcessingTime <= 0 ? 'ทันที' : data.averageProcessingTime > 24 ? `${Math.round(data.averageProcessingTime / 24)} วัน` : `${data.averageProcessingTime} ชม.`}</div>
                      <div className="text-xs text-slate-500">เวลาเฉลี่ย</div>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full progress-bar ${data.performanceScore >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : data.performanceScore >= 60 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-rose-400 to-rose-500'}`} style={{ width: `${data.performanceScore}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          {Object.keys(stats.byOfficer).length === 0 && (
            <div className="text-center py-12">
              <UsersIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">ยังไม่มีข้อมูลพนักงานที่ได้รับมอบหมายงาน</p>
            </div>
          )}
        </div>

        {/* Pie Chart & Top Reporters */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Modern Donut Chart */}
          <div className="dashboard-section p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200">
                  <ChartBarIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">การแจ้งปัญหาตามประเภท</h3>
                  <p className="text-xs text-slate-500">สัดส่วนการแจ้งปัญหาแต่ละประเภท</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-50 to-purple-50 rounded-full border border-violet-100">
                <UsersIcon className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-medium text-violet-700">{pieChartData.totalUniqueReporters} ผู้แจ้ง</span>
              </div>
            </div>
            {pieChartData.pieData?.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Modern Radial Chart with Glow Effect */}
                <div className="relative flex-shrink-0">
                  {/* Outer Glow Ring */}
                  <div className="absolute inset-0 rounded-full opacity-30 blur-xl" 
                    style={{
                      background: `conic-gradient(${pieChartData.pieData.map((item, i) => {
                        const startPct = pieChartData.pieData.slice(0, i).reduce((sum, d) => sum + (d.value / pieChartData.totalComplaints) * 100, 0);
                        const endPct = startPct + (item.value / pieChartData.totalComplaints) * 100;
                        return `${item.color} ${startPct}% ${endPct}%`;
                      }).join(', ')})`
                    }}
                  ></div>
                  
                  {/* Main Chart Container */}
                  <div className="relative w-52 h-52">
                    {/* SVG Donut Chart */}
                    <svg className="w-full h-full transform -rotate-90 drop-shadow-lg" viewBox="0 0 100 100">
                      {/* Background track */}
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="16" />
                      
                      {/* Data segments */}
                      {(() => {
                        let cumulative = 0;
                        const radius = 40;
                        const circumference = 2 * Math.PI * radius;
                        return pieChartData.pieData.map((item, i) => {
                          const pct = (item.value / pieChartData.totalComplaints) * 100;
                          const strokeDasharray = `${(pct / 100) * circumference * 0.98} ${circumference}`;
                          const strokeDashoffset = -(cumulative / 100) * circumference;
                          cumulative += pct;
                          return (
                            <circle
                              key={i}
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="none"
                              stroke={`url(#gradient-${i})`}
                              strokeWidth="16"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              className="transition-all duration-500 hover:stroke-[18] cursor-pointer"
                              style={{ 
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
                                transformOrigin: 'center'
                              }}
                            />
                          );
                        });
                      })()}
                      
                      {/* Gradient definitions */}
                      <defs>
                        {pieChartData.pieData.map((item, i) => {
                          const gradientColors = [
                            ['#3B82F6', '#1D4ED8'],
                            ['#8B5CF6', '#6D28D9'],
                            ['#EC4899', '#DB2777'],
                            ['#06B6D4', '#0891B2'],
                            ['#10B981', '#059669'],
                            ['#F59E0B', '#D97706']
                          ];
                          const [start, end] = gradientColors[i % gradientColors.length];
                          return (
                            <linearGradient key={i} id={`gradient-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor={start} />
                              <stop offset="100%" stopColor={end} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                    </svg>
                    
                    {/* Center Content with Glass Effect */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center bg-white/90 backdrop-blur-sm rounded-full w-24 h-24 flex flex-col items-center justify-center shadow-xl border border-white/50">
                        <div className="text-3xl font-black bg-gradient-to-br from-slate-700 to-slate-900 bg-clip-text text-transparent">
                          {pieChartData.totalComplaints}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">เรื่อง</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Legend Cards */}
                <div className="flex-1 w-full">
                  <div className="grid grid-cols-1 gap-2">
                    {pieChartData.pieData.slice(0, 6).map((item, i) => {
                      const bgColors = [
                        'hover:bg-blue-50 hover:border-blue-200',
                        'hover:bg-violet-50 hover:border-violet-200',
                        'hover:bg-pink-50 hover:border-pink-200',
                        'hover:bg-cyan-50 hover:border-cyan-200',
                        'hover:bg-emerald-50 hover:border-emerald-200',
                        'hover:bg-amber-50 hover:border-amber-200'
                      ];
                      return (
                        <div 
                          key={i} 
                          className={`group flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white transition-all duration-300 cursor-pointer ${bgColors[i % bgColors.length]}`}
                        >
                          {/* Color indicator with ring */}
                          <div className="relative">
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md transition-transform group-hover:scale-110"
                              style={{ 
                                background: `linear-gradient(135deg, ${item.color}, ${item.color}dd)`,
                                boxShadow: `0 4px 12px ${item.color}40`
                              }}
                            >
                              {item.value}
                            </div>
                          </div>
                          
                          {/* Category name */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-700 truncate group-hover:text-slate-900">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                                <div 
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${item.percentage}%`,
                                    background: `linear-gradient(90deg, ${item.color}, ${item.color}aa)`
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Percentage badge */}
                          <div 
                            className="px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                            style={{ 
                              backgroundColor: `${item.color}15`,
                              color: item.color
                            }}
                          >
                            {item.percentage}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <ChartBarIcon className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">ไม่มีข้อมูลสำหรับแสดง</p>
              </div>
            )}
          </div>

          {/* Top Reporters */}
          <div className="dashboard-section p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center">
                <UsersIcon className="w-5 h-5 text-cyan-600" />
              </div>
              <h3 className="font-semibold text-slate-800">ผู้แจ้งบ่อยที่สุด</h3>
            </div>
            {topReporters.length === 0 ? (
              <div className="text-center py-12">
                <UsersIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">ไม่มีข้อมูลผู้แจ้ง</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topReporters.map((reporter, index) => {
                  const rankBadges = ['rank-badge-gold', 'rank-badge-silver', 'rank-badge-bronze'];
                  const rankIcons = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={reporter.phone} className="border border-slate-200 rounded-xl p-4 hover:border-cyan-200 hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`rank-badge ${rankBadges[index] || 'bg-slate-100 text-slate-600'}`}>
                          {index < 3 ? rankIcons[index] : `#${index + 1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-800 truncate">{reporter.name}</h4>
                          <p className="text-sm text-slate-500">{reporter.phone}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-cyan-600">{reporter.count}</div>
                          <div className="text-xs text-slate-500">ครั้ง</div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {(() => {
                          const cats = {};
                          reporter.complaints.forEach(c => { if (c.category) cats[c.category] = (cats[c.category] || 0) + 1; });
                          return Object.entries(cats).sort(([,a], [,b]) => b - a).slice(0, 3).map(([cat, cnt]) => (
                            <span key={cat} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full">{cat} ({cnt})</span>
                          ));
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Complaints Cards */}
        <div className="dashboard-section p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <DocumentTextIcon className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">รายการปัญหาล่าสุด</h3>
                <p className="text-sm text-slate-500">แสดง {Math.min(RECENT_PAGE_SIZE, filteredComplaints.length)} จาก {filteredComplaints.length} รายการ</p>
              </div>
            </div>
            <button 
              onClick={() => router.push('/admin/manage-complaints')} 
              className="px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              ดูทั้งหมด
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
          
          {filteredComplaints.length === 0 ? (
            <div className="p-12 text-center">
              <DocumentTextIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">ไม่มีข้อมูลในกรอบเวลาที่เลือก</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredComplaints
                  .slice()
                  .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
                  .slice((recentPage - 1) * RECENT_PAGE_SIZE, recentPage * RECENT_PAGE_SIZE)
                  .map((complaint) => {
                    const categoryIcon = menu.find(m => m.Prob_name === complaint.category);
                    const daysSince = Math.floor((new Date() - new Date(complaint.timestamp || complaint.createdAt)) / (1000 * 60 * 60 * 24));
                    const timeAgo = daysSince === 0 ? 'วันนี้' : daysSince === 1 ? 'เมื่อวาน' : `${daysSince} วันที่แล้ว`;
                    
                    return (
                      <div 
                        key={complaint._id}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-blue-200 transition-all group"
                      >
                        {/* Card Header with Image */}
                        {Array.isArray(complaint.images) && complaint.images.length > 0 ? (
                          <div 
                            className="h-40 bg-slate-100 cursor-pointer relative overflow-hidden"
                            onClick={() => openDetailModal(complaint)}
                          >
                            <img
                              src={complaint.images[0]}
                              alt="ภาพปัญหา"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ) : (
                          <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            <DocumentTextIcon className="w-12 h-12 text-slate-300" />
                          </div>
                        )}
                        
                        <div className="p-4">
                          {/* Status and Category */}
                          <div className="flex items-center justify-between mb-3">
                            <span className={`badge-status ${getStatusColor(complaint.status)}`}>
                              {getStatusText(complaint.status)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {categoryIcon?.Prob_pic && (
                                <img src={categoryIcon.Prob_pic} alt="" className="w-5 h-5 object-contain" />
                              )}
                              <span className="text-xs text-slate-500">{complaint.category || 'ไม่ระบุ'}</span>
                            </div>
                          </div>
                          
                          {/* Detail */}
                          <h4 
                            className="font-medium text-slate-800 mb-2 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors min-h-[48px]"
                            onClick={() => openDetailModal(complaint)}
                          >
                            {complaint.detail || 'ไม่มีรายละเอียด'}
                          </h4>
                          
                          {/* Meta */}
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                            <span>{timeAgo}</span>
                            <span className="text-slate-500 truncate max-w-[120px]">{complaint.community || 'ไม่ระบุชุมชน'}</span>
                          </div>
                          
                          {/* Action Button */}
                          <button 
                            onClick={() => openDetailModal(complaint)}
                            className="w-full px-4 py-2.5 bg-slate-50 text-slate-600 text-sm font-medium rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                          >
                            <EyeIcon className="w-4 h-4" />
                            ดูรายละเอียด
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
              
              {/* Pagination */}
              {filteredComplaints.length > RECENT_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-slate-100">
                  <button 
                    onClick={() => setRecentPage(p => Math.max(1, p - 1))} 
                    disabled={recentPage === 1} 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${recentPage === 1 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                  >
                    ก่อนหน้า
                  </button>
                  <span className="text-sm text-slate-500 px-4">
                    หน้า {recentPage} / {Math.ceil(filteredComplaints.length / RECENT_PAGE_SIZE)}
                  </span>
                  <button 
                    onClick={() => setRecentPage(p => (p * RECENT_PAGE_SIZE < filteredComplaints.length ? p + 1 : p))} 
                    disabled={recentPage * RECENT_PAGE_SIZE >= filteredComplaints.length} 
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${recentPage * RECENT_PAGE_SIZE >= filteredComplaints.length ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}`}
                  >
                    ถัดไป
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Modals */}
      <ComplaintsModal />
      {showDetailModal && selectedComplaintDetail && (
        <ComplaintDetailModal
          complaint={selectedComplaintDetail}
          isOpen={showDetailModal}
          onClose={closeDetailModal}
          assignments={assignments}
          menu={menu}
          assignedUsers={assignedUsersMap}
          onPrivacySaved={(updated) => {
            if (updated?._id) {
              setSelectedComplaintDetail((prev) =>
                prev && String(prev._id) === String(updated._id) ? { ...prev, ...updated } : prev
              );
              setComplaints((list) =>
                list.map((c) =>
                  String(c._id) === String(updated._id) ? { ...c, ...updated } : c
                )
              );
            }
            void fetchDashboardData();
          }}
        />
      )}
    </div>
    </LayoutAdmin>
  );
}

