import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Head from "next/head";
import useComplaintStore from "@/stores/useComplaintStore";
import { useMenuStore } from "@/stores/useMenuStore";
import EditUserModal from "@/components/EditUserModal";
import ComplaintStats from "@/components/complaints/ComplaintStats";
import OverdueComplaintsAlert from "@/components/complaints/OverdueComplaintsAlert";
import ComplaintDetailModal from "@/components/complaints/ComplaintDetailModal";
import ExportComplaints from "@/components/complaints/ExportComplaints";
import MobileManageView from "@/components/complaints/manage/MobileManageView";
import ComplaintFilterSheet from "@/components/complaints/manage/ComplaintFilterSheet";
import ComplaintActionsSheet from "@/components/complaints/manage/ComplaintActionsSheet";
import SatisfactionCommentsPanel from "@/components/SatisfactionCommentsPanel";
import Swal from "sweetalert2";
import { availableFiscalYears, currentFiscalYear, fiscalYearLabel, splitByFiscalYear } from "@/lib/complaints/fiscalYear";
import {
  buildAssignmentIndex,
  filterComplaints,
  sortComplaints,
  countActiveFilters,
  staleInfo,
  ageLabel,
  rowState,
  SORT_OPTIONS,
  DEFAULT_SORT,
} from "@/lib/complaints/manageList";

const LocationPickerModal = dynamic(() => import("@/components/LocationPickerModal"), {
  ssr: false,
});

const MOBILE_PAGE = 10; // มือถือ: โหลดเพิ่มทีละ 10

// Debounce hook for search
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

export default function ManageComplaintsPage() {
  const { complaints, fetchComplaints } = useComplaintStore();
  const { menu, fetchMenu } = useMenuStore();
  const { user } = useUser();
  const { getToken, userId } = useAuth();
  const router = useRouter();
  
  // Core states
  const [loading, setLoading] = useState(true);
  const [existingUser, setExistingUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState({});
  
  // Check if user is superadmin
  const isSuperAdmin = existingUser?.role === 'superadmin';
  
  // Modal states
  const [selectedAssignment, setSelectedAssignment] = useState(null); // ใช้กับ EditUserModal
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [complaintToDelete, setComplaintToDelete] = useState(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // + "carryover" = เรื่องค้างข้ามปีงบ
  const [fiscalYear, setFiscalYear] = useState(() => currentFiscalYear()); // number (พ.ศ.) | "all"
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortValue, setSortValue] = useState(DEFAULT_SORT);
  const [mineOnly, setMineOnly] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // View mode
  const [viewMode, setViewMode] = useState("table"); // table | card

  // มือถือ
  const [mobileVisible, setMobileVisible] = useState(MOBILE_PAGE);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [actionsForId, setActionsForId] = useState(null); // เก็บ _id — ข้อมูลเรื่องอ่านสดจาก complaints หลัง refetch
  
  // Debounced search
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Fetch assignments with user data
  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetch("/api/complaints/assignments");
      const data = await response.json();
      setAssignments(data);
      
      const uniqueUserIds = [...new Set(
        data.filter(assignment => assignment.userId).map(assignment => assignment.userId)
      )];
      
      if (uniqueUserIds.length > 0) {
        const usersResponse = await fetch("/api/users/get-by-ids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds: uniqueUserIds }),
        });
        const usersData = await usersResponse.json();
        if (usersData.success) {
          setAssignedUsers(usersData.users);
        }
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchComplaints(),
        fetchMenu(),
        fetchAssignments()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchComplaints, fetchMenu, fetchAssignments]);

  // Check user
  useEffect(() => {
    const checkUser = async () => {
      if (!userId) return;
      try {
        const token = await getToken();
        const res = await fetch("/api/users/get-by-clerkId", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && data.user) {
          setExistingUser(data.user);
        }
      } catch (error) {
        console.error("Error checking user:", error);
      }
    };
    checkUser();
  }, [userId, getToken]);

  // Computed values
  const assignmentIndex = useMemo(() => buildAssignmentIndex(assignments), [assignments]);
  const assignedComplaintIds = useMemo(() => new Set(assignmentIndex.keys()), [assignmentIndex]);

  // ตัดตามปีงบประมาณ (วันที่แจ้ง) — เรื่องปีก่อนที่ยังไม่เสร็จแยกเป็น "ค้างข้ามปี"
  const fiscalYearOptions = useMemo(() => availableFiscalYears(complaints), [complaints]);
  const { inYear: yearComplaints, carryOver, carryOverByYear } = useMemo(
    () => splitByFiscalYear(complaints, fiscalYear),
    [complaints, fiscalYear]
  );

  // ปีงบไม่มีเรื่องค้างแล้ว แต่ยังอยู่แท็บค้างข้ามปี → กลับแท็บทั้งหมด
  useEffect(() => {
    if (statusFilter === "carryover" && carryOver.length === 0) setStatusFilter("all");
  }, [statusFilter, carryOver.length]);

  const stats = useMemo(() => ({
    total: yearComplaints.length,
    pending: yearComplaints.filter(c => !assignedComplaintIds.has(c._id)).length,
    inProgress: yearComplaints.filter(c => c.status === "อยู่ระหว่างดำเนินการ").length,
    completed: yearComplaints.filter(c => c.status === "ดำเนินการเสร็จสิ้น").length
  }), [yearComplaints, assignedComplaintIds]);

  const uniqueCategories = useMemo(() => 
    [...new Set([...yearComplaints, ...carryOver].map(c => c.category))].filter(Boolean),
    [yearComplaints, carryOver]
  );

  // Filtered and sorted complaints
  const filteredComplaints = useMemo(() => {
    const source = statusFilter === "carryover" ? carryOver : yearComplaints;
    const filtered = filterComplaints(source, {
      search: debouncedSearch,
      status: statusFilter,
      category: categoryFilter,
      mineOnly,
      staleOnly,
      userId: existingUser?._id ?? null,
      assignmentByComplaintId: assignmentIndex,
    });
    return sortComplaints(filtered, sortValue);
  }, [yearComplaints, carryOver, debouncedSearch, statusFilter, categoryFilter, mineOnly, staleOnly, existingUser?._id, assignmentIndex, sortValue]);

  // Pagination
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const paginatedComplaints = filteredComplaints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter, fiscalYear, mineOnly, staleOnly, sortValue]);

  // Handlers
  const handleAssign = async (complaintId) => {
    try {
      const res = await fetch("/api/complaints/assignments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId, userId: existingUser?._id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "เกิดข้อผิดพลาดในการรับงาน");
      }
      await fetchAssignments();
      alert("รับงานสำเร็จ");
    } catch (error) {
      console.error("Error assigning:", error);
      alert(error.message || "เกิดข้อผิดพลาดในการรับงาน");
    }
  };

  const postComplaintPrivacy = async (complaintId, payload) => {
    const token = await getToken();
    const res = await fetch("/api/complaints/privacy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ complaintId, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "อัปเดตไม่สำเร็จ");
    }
    return data;
  };

  const toggleConfidential = async (complaint) => {
    const next = !complaint.isConfidential;
    if (next) {
      const c = await Swal.fire({
        icon: "warning",
        title: "ตั้งเป็นเรื่องลับ?",
        html: "เรื่องนี้จะ<strong>ไม่แสดง</strong>บนหน้า ร้องเรียน และ สถานะ สำหรับประชาชน<br/>แอดมินยังเห็นและจัดการได้ตามปกติ",
        showCancelButton: true,
        confirmButtonText: "ยืนยัน",
        cancelButtonText: "ยกเลิก",
        reverseButtons: true,
        focusCancel: true,
      });
      if (!c.isConfirmed) return;
    }
    try {
      await postComplaintPrivacy(complaint._id, { isConfidential: next });
      await fetchComplaints();
      await Swal.fire({
        icon: "success",
        title: next ? "ตั้งเป็นเรื่องลับแล้ว" : "ยกเลิกเรื่องลับแล้ว",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกได้",
        text: err?.message || "ลองใหม่อีกครั้ง",
      });
    }
  };

  const togglePdpa = async (complaint) => {
    const next = !complaint.pdpaSensitive;
    if (next) {
      const c = await Swal.fire({
        icon: "question",
        title: "เปิดโหมด PDPA?",
        html: "ประชาชนที่ไม่ใช่แอดมินจะเห็น<strong>ภาพเบลอ</strong> (ไม่ใช่ URL ต้นฉบับ)<br/>ส่วนข้อความ: ให้เปิดรายละเอียดเรื่องแล้ว<strong>ลากเลือกคำที่ต้องการซ่อน</strong> และบันทึกการซ่อนคำ (ไม่ใช้การเซ็นเซอร์อัตโนมัติ)<br/><strong>แอดมิน</strong>ยังเห็นภาพชัดและข้อความต้นฉบับในระบบหลังบ้าน",
        showCancelButton: true,
        confirmButtonText: "เปิด PDPA",
        cancelButtonText: "ยกเลิก",
        reverseButtons: true,
        focusCancel: true,
      });
      if (!c.isConfirmed) return;
    }
    try {
      await postComplaintPrivacy(complaint._id, { pdpaSensitive: next });
      await fetchComplaints();
      await Swal.fire({
        icon: "success",
        title: next ? "เปิด PDPA แล้ว" : "ปิด PDPA แล้ว",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "ไม่สามารถบันทึกได้",
        text: err?.message || "ลองใหม่อีกครั้ง",
      });
    }
  };

  const getProcessingTimeCategory = (startDate, endDate) => {
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate instanceof Date ? endDate : new Date(endDate);
    const processingTimeHours = Math.floor((end - start) / (1000 * 60 * 60));

    if (processingTimeHours <= 24) return "≤ 24 ชม.";
    if (processingTimeHours <= 48) return "1-2 วัน";
    if (processingTimeHours <= 72) return "2-3 วัน";
    if (processingTimeHours <= 168) return "3-7 วัน";
    if (processingTimeHours <= 360) return "7-15 วัน";
    return "> 15 วัน";
  };

  const handleCloseComplaint = async (complaintId) => {
    const complaint = complaints.find((c) => c._id === complaintId);
    const assignment = assignments.find((a) => a.complaintId === complaintId);

    const closeTime = new Date();
    const startTimeRaw = complaint?.timestamp || complaint?.createdAt;
    const startTime = startTimeRaw ? new Date(startTimeRaw) : null;
    const assignedTime = assignment?.assignedAt ? new Date(assignment.assignedAt) : null;

    if (!complaint || !startTime || Number.isNaN(startTime.getTime())) {
      await Swal.fire({
        icon: "error",
        title: "ไม่พบข้อมูลเวลาเริ่มเรื่อง",
        text: "ไม่สามารถปิดเรื่องได้เนื่องจากไม่พบ createdAt/timestamp ที่ถูกต้อง",
        confirmButtonText: "ปิด",
      });
      return;
    }

    // Guard: close time must not be before report time or assignment time
    const isBeforeReport = closeTime < startTime;
    const isBeforeAssigned = assignedTime && !Number.isNaN(assignedTime.getTime()) && closeTime < assignedTime;
    if (isBeforeReport || isBeforeAssigned) {
      await Swal.fire({
        icon: "warning",
        title: "เวลาปิดเรื่องไม่ถูกต้อง",
        html: `
          <div style="text-align:left">
            <div>เวลาปิดเรื่องต้อง <b>ไม่น้อยกว่า</b> เวลาที่แจ้งเรื่อง${assignedTime ? " หรือเวลาที่ได้รับมอบหมาย" : ""}</div>
            <div style="margin-top:8px;color:#666">แนะนำ: ตรวจสอบวันเวลาในเครื่อง (Date/Time) แล้วลองใหม่อีกครั้ง</div>
          </div>
        `,
        confirmButtonText: "รับทราบ",
      });
      return;
    }

    const timeCategory = getProcessingTimeCategory(startTime, closeTime);

    const confirm = await Swal.fire({
      icon: "question",
      title: "ยืนยันปิดเรื่อง?",
      html: `
        <div style="text-align:left">
          <div><b>ระบบจะบันทึกเวลาปิด</b> โดยใช้ <b>updatedAt</b> ของเรื่อง (เวลาปัจจุบัน)</div>
          <div style="margin-top:10px"><b>KPI ที่จะได้:</b> ${timeCategory}</div>
          <div style="margin-top:10px;color:#666">
            หมายเหตุ: หากปิดตอนนี้ ระบบจะคำนวณระยะเวลาจาก “เวลารับเรื่อง” → “เวลาปิดเรื่อง”
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "ปิดเรื่อง",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
      focusCancel: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/submittedreports/update-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId, status: "ดำเนินการเสร็จสิ้น" }),
      });
      if (!res.ok) throw new Error("Failed to close");
      await Swal.fire({
        icon: "success",
        title: "ปิดเรื่องเรียบร้อย",
        text: `บันทึก KPI: ${timeCategory}`,
        timer: 1600,
        showConfirmButton: false,
      });
      fetchComplaints();
    } catch (error) {
      console.error("Error closing:", error);
      await Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาดในการปิดเรื่อง",
        text: error?.message || "กรุณาลองใหม่อีกครั้ง",
        confirmButtonText: "ปิด",
      });
    }
  };

  // อัปเดตความคืบหน้าย้ายไปหน้างานเจ้าหน้าที่ (หน้าจอ 3) — ทางเขียนเดียว มี timeline/เช็คปิดเรื่อง/audit ครบ
  // (UpdateAssignmentModal + PUT assignments/update เดิมปลดระวางแล้ว 2026-09-02)
  const handleOpenUpdateForm = (assignment) => {
    router.push(`/admin/my-tasks/${assignment._id}`);
  };

  const handleDeleteComplaint = (complaint) => {
    setComplaintToDelete(complaint);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!complaintToDelete) return;
    try {
      const res = await fetch(`/api/submittedreports/${complaintToDelete._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      alert("ลบเรื่องสำเร็จ");
      fetchComplaints();
      setShowDeleteConfirm(false);
      setComplaintToDelete(null);
    } catch (err) {
      console.error("Error deleting:", err);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  const handleStatClick = (filter) => {
    if (filter === 'all') {
      setStatusFilter('all');
    } else {
      setStatusFilter(filter);
    }
  };

  const getStatusBadge = (status, isAssigned) => {
    if (!isAssigned && status !== "ดำเนินการเสร็จสิ้น") {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
          รอมอบหมาย
        </span>
      );
    }
    
    const statusConfig = {
      "อยู่ระหว่างดำเนินการ": { 
        bg: "bg-blue-100", 
        text: "text-blue-700", 
        border: "border-blue-200",
        dot: "bg-blue-500",
        label: "กำลังดำเนินการ" 
      },
      "ดำเนินการเสร็จสิ้น": { 
        bg: "bg-emerald-100", 
        text: "text-emerald-700", 
        border: "border-emerald-200",
        dot: "bg-emerald-500",
        label: "เสร็จสิ้น" 
      }
    };
    
    const config = statusConfig[status] || { 
      bg: "bg-gray-100", 
      text: "text-gray-600", 
      border: "border-gray-200",
      dot: "bg-gray-400",
      label: status 
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} mr-1.5`}></span>
        {config.label}
      </span>
    );
  };

  const getDaysSinceUpdate = (updatedAt) => {
    const days = Math.floor((new Date() - new Date(updatedAt)) / (1000 * 60 * 60 * 24));
    if (days === 0) return "วันนี้";
    if (days === 1) return "เมื่อวาน";
    return `${days} วันที่แล้ว`;
  };

  useEffect(() => {
    setMobileVisible(MOBILE_PAGE);
  }, [debouncedSearch, statusFilter, categoryFilter, fiscalYear, mineOnly, staleOnly, sortValue]);

  const statusTabs = useMemo(() => [
    { value: "all", label: "ทั้งหมด", count: stats.total, tone: "blue" },
    { value: "รอการมอบหมาย", label: "รอมอบหมาย", count: stats.pending, tone: "red" },
    { value: "อยู่ระหว่างดำเนินการ", label: "กำลังดำเนินการ", count: stats.inProgress, tone: "blue" },
    { value: "ดำเนินการเสร็จสิ้น", label: "เสร็จสิ้น", count: stats.completed, tone: "green" },
    ...(carryOver.length > 0 ? [{ value: "carryover", label: "ค้างข้ามปี", count: carryOver.length, tone: "orange" }] : []),
  ], [stats, carryOver.length]);

  // นับเรื่องค้างนานภายใต้ตัวกรองอื่นทั้งหมด (ยกเว้น staleOnly) — เพื่อให้แถบแสดงตัวเลขจริง และปิดโหมดได้
  const staleCount = useMemo(() => {
    const source = statusFilter === "carryover" ? carryOver : yearComplaints;
    return filterComplaints(source, {
      search: debouncedSearch,
      status: statusFilter,
      category: categoryFilter,
      mineOnly,
      staleOnly: false,
      userId: existingUser?._id ?? null,
      assignmentByComplaintId: assignmentIndex,
    }).filter((c) => staleInfo(c, assignedComplaintIds.has(c._id)).isStale).length;
  }, [statusFilter, carryOver, yearComplaints, debouncedSearch, categoryFilter, mineOnly, existingUser?._id, assignmentIndex, assignedComplaintIds]);

  const mobileItems = useMemo(() =>
    filteredComplaints.slice(0, mobileVisible).map((complaint) => {
      const assignment = assignmentIndex.get(String(complaint._id));
      const isAssigned = !!assignment;
      return {
        complaint,
        state: rowState(complaint, isAssigned),
        officer: assignment ? assignedUsers[assignment.userId] || null : null,
        ageText: ageLabel(complaint, isAssigned),
        isStale: staleInfo(complaint, isAssigned).isStale,
      };
    }),
  [filteredComplaints, mobileVisible, assignmentIndex, assignedUsers]);

  const filterValue = useMemo(
    () => ({ fiscalYear, category: categoryFilter, sort: sortValue, mineOnly, staleOnly }),
    [fiscalYear, categoryFilter, sortValue, mineOnly, staleOnly]
  );
  const activeFilterCount = countActiveFilters({ ...filterValue, defaultFiscalYear: currentFiscalYear() });

  // จำนวนผลลัพธ์ของ draft ในชีตตัวกรอง (ปีงบใน draft อาจต่างจากปัจจุบัน → split ใหม่)
  const countForDraft = useCallback((draft) => {
    const { inYear, carryOver: draftCarry } = splitByFiscalYear(complaints, draft.fiscalYear);
    // ปีงบใน draft ไม่มีเรื่องค้างข้ามปี → แท็บจะถูกรีเซ็ตเป็น "all" (ตาม effect ด้านบน) จึงนับแบบนั้น
    const effectiveStatus = statusFilter === "carryover" && draftCarry.length === 0 ? "all" : statusFilter;
    const source = effectiveStatus === "carryover" ? draftCarry : inYear;
    return filterComplaints(source, {
      search: debouncedSearch,
      status: effectiveStatus,
      category: draft.category,
      mineOnly: draft.mineOnly,
      staleOnly: draft.staleOnly,
      userId: existingUser?._id ?? null,
      assignmentByComplaintId: assignmentIndex,
    }).length;
  }, [complaints, statusFilter, debouncedSearch, existingUser?._id, assignmentIndex]);

  const applyFilters = (draft) => {
    setFiscalYear(draft.fiscalYear === "all" ? "all" : Number(draft.fiscalYear));
    setCategoryFilter(draft.category);
    setSortValue(draft.sort);
    setMineOnly(draft.mineOnly);
    setStaleOnly(draft.staleOnly);
  };

  const actionsComplaint = useMemo(
    () => (actionsForId ? complaints.find((c) => String(c._id) === String(actionsForId)) || null : null),
    [actionsForId, complaints]
  );

  const openDetail = (complaint) => {
    setSelectedComplaint(complaint);
    setShowDetailModal(true);
  };
  const openUpdateFor = (complaint) => {
    const assignment = assignmentIndex.get(String(complaint._id));
    if (assignment) handleOpenUpdateForm(assignment);
  };
  const cardHandlers = {
    onOpenDetail: openDetail,
    onAssign: (c) => handleAssign(c._id),
    onUpdate: openUpdateFor,
    onCloseComplaint: (c) => handleCloseComplaint(c._id),
    onMore: (c) => setActionsForId(c._id),
  };

  return (
    <>
      <Head>
        <title>จัดการเรื่องร้องเรียน - Admin</title>
      </Head>
      
      <div className="-m-6 md:m-0 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="p-3 md:p-4 lg:p-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 md:gap-4 md:mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
                  จัดการเรื่องร้องเรียน
                </h1>
                {existingUser?.role && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    isSuperAdmin 
                      ? "bg-purple-100 text-purple-700 border border-purple-200" 
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}>
                    {isSuperAdmin ? "👑 Super Admin" : "🛡️ Admin"}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {fiscalYear === "all"
                  ? "ทุกปีงบประมาณ"
                  : `ปีงบประมาณ ${fiscalYear} (${fiscalYearLabel(fiscalYear)})`} • รวม {stats.total.toLocaleString()} เรื่อง • 
                <span className="text-blue-600 ml-1">
                  {stats.inProgress} กำลังดำเนินการ
                </span>
                {carryOver.length > 0 && (
                  <span className="text-orange-600 ml-1">• ค้างข้ามปี {carryOver.length}</span>
                )}
                {!isSuperAdmin && (
                  <span className="text-gray-400 ml-2">
                    • การลบต้องใช้สิทธิ์ Super Admin
                  </span>
                )}
              </p>
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <label className="hidden md:flex items-center gap-2 text-sm text-gray-600">
                <span className="hidden sm:inline">ปีงบประมาณ</span>
                <select
                  value={String(fiscalYear)}
                  onChange={(e) => setFiscalYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  aria-label="เลือกปีงบประมาณ"
                >
                  {fiscalYearOptions.map((fy) => (
                    <option key={fy} value={fy}>ปีงบ {fy}</option>
                  ))}
                  <option value="all">ทุกปี</option>
                </select>
              </label>
              <ExportComplaints complaints={yearComplaints} assignments={assignments} />
              
              {/* View toggle */}
              <div className="hidden md:flex items-center bg-white rounded-lg border p-1">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded ${viewMode === "table" ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("card")}
                  className={`p-1.5 rounded ${viewMode === "card" ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="hidden md:block">
            <ComplaintStats
              stats={stats} 
              isLoading={loading} 
              onStatClick={handleStatClick}
            />
          </div>

          {/* แถบเรื่องค้างข้ามปีงบ */}
          {carryOver.length > 0 && (
            <div className="hidden md:block">
              <button
                type="button"
                onClick={() => setStatusFilter("carryover")}
                className={`w-full mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-xl border text-left transition-colors
                  ${statusFilter === "carryover"
                    ? "bg-orange-100 border-orange-300"
                    : "bg-orange-50 border-orange-200 hover:bg-orange-100"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-200/70 text-orange-700 font-bold">
                    {carryOver.length}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">
                      เรื่องค้างข้ามปีงบประมาณ — แจ้งก่อนปีงบ {fiscalYear} และยังไม่เสร็จ
                    </p>
                    <p className="text-xs text-orange-700/80">
                      {Object.entries(carryOverByYear)
                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                        .map(([fy, n]) => `ปีงบ ${fy}: ${n} เรื่อง`)
                        .join(" · ")}
                      {" "}— ไม่นับรวมในสถิติปีงบ {fiscalYear}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-orange-700 whitespace-nowrap">
                  {statusFilter === "carryover" ? "กำลังแสดงในตาราง" : "ดูรายการ →"}
                </span>
              </button>
            </div>
          )}

          {/* Overdue alerts + satisfaction comments */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 items-start">
            <div className="lg:col-span-2">
              <OverdueComplaintsAlert
                complaints={complaints} 
                assignments={assignments}
                isExpanded={overdueExpanded}
                onExpandedChange={setOverdueExpanded}
                onComplaintClick={(complaint) => {
                  setSelectedComplaint(complaint);
                  setShowDetailModal(true);
                }}
              />
            </div>
            <div className="lg:col-span-1">
              <SatisfactionCommentsPanel
                complaints={complaints}
                contentExpanded={overdueExpanded}
              />
            </div>
          </div>

          <MobileManageView
            tabs={statusTabs}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilterCount={activeFilterCount}
            onOpenFilters={() => setFilterSheetOpen(true)}
            staleCount={staleCount}
            staleOnly={staleOnly}
            onToggleStale={() => setStaleOnly((v) => !v)}
            items={mobileItems}
            totalCount={filteredComplaints.length}
            hasMore={mobileVisible < filteredComplaints.length}
            onLoadMore={() => setMobileVisible((n) => n + MOBILE_PAGE)}
            loading={loading}
            cardHandlers={cardHandlers}
          />

          {/* Filter Section */}
          <div className="hidden md:block bg-white rounded-xl border shadow-sm mb-6 overflow-hidden">
            {/* Quick Status Tabs */}
            <div className="flex border-b overflow-x-auto">
              {[
                { value: "all", label: "ทั้งหมด", count: stats.total },
                { value: "รอการมอบหมาย", label: "รอมอบหมาย", count: stats.pending },
                { value: "อยู่ระหว่างดำเนินการ", label: "กำลังดำเนินการ", count: stats.inProgress },
                { value: "ดำเนินการเสร็จสิ้น", label: "เสร็จสิ้น", count: stats.completed },
                ...(carryOver.length > 0
                  ? [{ value: "carryover", label: "ค้างข้ามปี", count: carryOver.length, tone: "orange" }]
                  : [])
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                    ${statusFilter === tab.value 
                      ? tab.tone === "orange"
                        ? "text-orange-700 border-b-2 border-orange-500 bg-orange-50/60"
                        : "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" 
                      : tab.tone === "orange"
                        ? "text-orange-600 hover:bg-orange-50"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {tab.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    tab.tone === "orange"
                      ? "bg-orange-100 text-orange-700"
                      : statusFilter === tab.value 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            
            {/* Filters Row */}
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="ค้นหาเลขคำร้อง (เช่น TKC-700036), รายละเอียด, หมวด, ชุมชน..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm 
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                      placeholder:text-gray-400 transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm 
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                    text-gray-700 min-w-[140px]"
                >
                  <option value="all">ทุกหมวดหมู่</option>
                  {uniqueCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                {/* Sort */}
                <select
                  value={sortValue}
                  onChange={(e) => setSortValue(e.target.value)}
                  aria-label="เรียงตาม"
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm 
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                    text-gray-700 min-w-[180px]"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={mineOnly}
                    onChange={(e) => setMineOnly(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  เฉพาะของฉัน
                </label>
                <label className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={staleOnly}
                    onChange={(e) => setStaleOnly(e.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  เฉพาะค้างนาน
                </label>
              </div>
            </div>
          </div>

          <div className="hidden md:block">
            {/* Results Summary */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                แสดง <span className="font-medium text-gray-700">{paginatedComplaints.length}</span> จาก{" "}
                <span className="font-medium text-gray-700">{filteredComplaints.length}</span> เรื่อง
                {searchTerm && <span className="text-blue-600"> สำหรับ "{searchTerm}"</span>}
              </p>
            </div>

            {/* Content */}
            {loading ? (
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="divide-y">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="p-4 animate-pulse">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                        <div className="h-8 w-20 bg-gray-200 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">ไม่พบข้อมูล</h3>
                <p className="text-gray-500">ลองเปลี่ยนเงื่อนไขการค้นหาหรือตัวกรอง</p>
              </div>
            ) : viewMode === "table" ? (
              /* Table View */
              <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">เลขคำร้อง / สถานะ</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">หมวดหมู่</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">ภาพ</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">รายละเอียด</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">เจ้าหน้าที่</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">อัปเดต</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedComplaints.map((complaint, index) => {
                        const isAssigned = assignedComplaintIds.has(complaint._id);
                        const isClosed = complaint.status === "ดำเนินการเสร็จสิ้น";
                        const assignment = assignments.find((a) => a.complaintId === complaint._id);
                        const categoryIcon = menu.find((m) => m.Prob_name === complaint.category);
                      
                        return (
                          <tr 
                            key={complaint._id} 
                            className="hover:bg-blue-50/30 transition-colors group"
                          >
                            <td className="px-4 py-3 text-center text-sm text-gray-500 font-medium">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-mono text-xs font-semibold text-gray-700 whitespace-nowrap mb-1 select-all">
                                {complaint.complaintId || "—"}
                              </p>
                              {getStatusBadge(complaint.status, isAssigned)}
                              {(complaint.isConfidential || complaint.pdpaSensitive) && (
                                <div className="mt-1 flex gap-1">
                                  {complaint.isConfidential && <span className="rounded bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-800">เรื่องลับ</span>}
                                  {complaint.pdpaSensitive && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900">PDPA</span>}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1">
                                {categoryIcon?.Prob_pic && (
                                  <img
                                    src={categoryIcon.Prob_pic}
                                    alt={complaint.category}
                                    className="w-8 h-8 object-contain"
                                  />
                                )}
                                <span className="text-xs text-gray-500 truncate max-w-[80px]">
                                  {complaint.category}
                                </span>
                                {Array.isArray(complaint.problems) && complaint.problems.length > 0 && (
                                  <span className="text-[10px] text-gray-400 text-center line-clamp-2 max-w-[110px]">
                                    {complaint.problems.join(", ")}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {Array.isArray(complaint.images) && complaint.images.length > 0 && (
                                <img
                                  src={complaint.images[0]}
                                  alt="ภาพปัญหา"
                                  className="w-12 h-12 object-cover rounded-lg cursor-pointer 
                                    hover:scale-110 transition-transform shadow-sm"
                                  onClick={() => window.open(complaint.images[0], '_blank')}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div 
                                className="cursor-pointer group/title"
                                onClick={() => {
                                  setSelectedComplaint(complaint);
                                  setShowDetailModal(true);
                                }}
                              >
                                <p className="text-sm font-medium text-gray-800 group-hover/title:text-blue-600 
                                  transition-colors line-clamp-2 max-w-xs">
                                  {complaint.detail}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {getDaysSinceUpdate(complaint.updatedAt)}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isAssigned && assignedUsers[assignment?.userId] ? (
                                <div className="text-xs">
                                  <p className="font-medium text-blue-600">
                                    {assignedUsers[assignment.userId].name}
                                  </p>
                                  {assignedUsers[assignment.userId].position && (
                                    <p className="text-gray-400">
                                      {assignedUsers[assignment.userId].position}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="text-xs text-gray-500">
                                <p>{new Date(complaint.updatedAt).toLocaleDateString("th-TH")}</p>
                                <p className="text-gray-400">
                                  {new Date(complaint.updatedAt).toLocaleTimeString("th-TH", {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1.5 items-center w-full max-w-[140px] mx-auto">
                                {!isClosed ? (
                                  isAssigned ? (
                                    <>
                                      <button
                                        type="button"
                                        className="w-full px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg
                                          hover:bg-blue-100 transition-colors"
                                        onClick={() => handleOpenUpdateForm(assignment)}
                                      >
                                        อัพเดท
                                      </button>
                                      <button
                                        type="button"
                                        className="w-full px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg
                                          hover:bg-emerald-100 transition-colors"
                                        onClick={() => handleCloseComplaint(complaint._id)}
                                      >
                                        ปิดเรื่อง
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg
                                        hover:bg-blue-700 transition-colors shadow-sm"
                                      onClick={() => handleAssign(complaint._id)}
                                    >
                                      รับเรื่อง
                                    </button>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                                      ${isSuperAdmin 
                                        ? "bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer" 
                                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                      }`}
                                    onClick={() => isSuperAdmin && handleDeleteComplaint(complaint)}
                                    disabled={!isSuperAdmin}
                                    title={!isSuperAdmin ? "เฉพาะ Super Admin เท่านั้นที่สามารถลบได้" : "ลบเรื่อง"}
                                  >
                                    {isSuperAdmin ? "ลบ" : "🔒 ลบ"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setActionsForId(complaint._id)}
                                  className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                                  aria-label={`คำสั่งเพิ่มเติม ${complaint.complaintId || ""}`.trim()}
                                >
                                  ⋯ เพิ่มเติม
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedComplaints.map((complaint) => {
                  const isAssigned = assignedComplaintIds.has(complaint._id);
                  const isClosed = complaint.status === "ดำเนินการเสร็จสิ้น";
                  const assignment = assignments.find((a) => a.complaintId === complaint._id);
                  const categoryIcon = menu.find((m) => m.Prob_name === complaint.category);
                
                  return (
                    <div 
                      key={complaint._id}
                      className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                    >
                      {/* Card Header with Image */}
                      {Array.isArray(complaint.images) && complaint.images.length > 0 && (
                        <div 
                          className="h-40 bg-gray-100 cursor-pointer relative group"
                          onClick={() => window.open(complaint.images[0], '_blank')}
                        >
                          <img
                            src={complaint.images[0]}
                            alt="ภาพปัญหา"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    
                      <div className="p-4">
                        {complaint.complaintId && (
                          <p className="font-mono text-xs font-semibold text-gray-700 mb-2 select-all">
                            {complaint.complaintId}
                          </p>
                        )}
                        {(complaint.isConfidential || complaint.pdpaSensitive) && (
                          <div className="mb-2 flex gap-1">
                            {complaint.isConfidential && <span className="rounded bg-rose-100 px-1.5 text-[10px] font-semibold text-rose-800">เรื่องลับ</span>}
                            {complaint.pdpaSensitive && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900">PDPA</span>}
                          </div>
                        )}
                        {/* Status and Category */}
                        <div className="flex items-center justify-between mb-3">
                          {getStatusBadge(complaint.status, isAssigned)}
                          <div className="flex items-center gap-1.5">
                            {categoryIcon?.Prob_pic && (
                              <img src={categoryIcon.Prob_pic} alt="" className="w-5 h-5" />
                            )}
                            <span className="text-xs text-gray-500">{complaint.category}</span>
                          </div>
                        </div>
                      
                        {/* Detail */}
                        <h3 
                          className="font-medium text-gray-800 mb-2 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => {
                            setSelectedComplaint(complaint);
                            setShowDetailModal(true);
                          }}
                        >
                          {complaint.detail}
                        </h3>
                      
                        {/* Meta */}
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                          <span>{getDaysSinceUpdate(complaint.updatedAt)}</span>
                          {isAssigned && assignedUsers[assignment?.userId] && (
                            <span className="text-blue-500">
                              {assignedUsers[assignment.userId].name}
                            </span>
                          )}
                        </div>
                      
                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                          {!isClosed ? (
                            isAssigned ? (
                              <>
                                <button
                                  type="button"
                                  className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg
                                    hover:bg-blue-100 transition-colors"
                                  onClick={() => handleOpenUpdateForm(assignment)}
                                >
                                  อัพเดท
                                </button>
                                <button
                                  type="button"
                                  className="flex-1 px-3 py-2 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-lg
                                    hover:bg-emerald-100 transition-colors"
                                  onClick={() => handleCloseComplaint(complaint._id)}
                                >
                                  ปิดเรื่อง
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                                  hover:bg-blue-700 transition-colors"
                                onClick={() => handleAssign(complaint._id)}
                              >
                                รับเรื่อง
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                ${isSuperAdmin 
                                  ? "bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer" 
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                              onClick={() => isSuperAdmin && handleDeleteComplaint(complaint)}
                              disabled={!isSuperAdmin}
                              title={!isSuperAdmin ? "เฉพาะ Super Admin เท่านั้นที่สามารถลบได้" : "ลบเรื่อง"}
                            >
                              {isSuperAdmin ? "ลบเรื่อง" : "🔒 ลบเรื่อง"}
                            </button>
                          )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setActionsForId(complaint._id)}
                              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                              aria-label={`คำสั่งเพิ่มเติม ${complaint.complaintId || ""}`.trim()}
                            >
                              ⋯ เพิ่มเติม
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-6">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              
                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                  
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors
                          ${currentPage === page 
                            ? "bg-blue-600 text-white" 
                            : "text-gray-600 hover:bg-gray-100"
                          }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
              
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEditUserModal && (
        <EditUserModal
          isOpen={showEditUserModal}
          onClose={() => setShowEditUserModal(false)}
          complaint={selectedAssignment}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-center text-gray-800 mb-2">ยืนยันการลบ</h3>
            <p className="text-center text-gray-500 mb-6">
              คุณแน่ใจหรือไม่ว่าต้องการลบเรื่องร้องเรียน
              <br />
              <span className="font-medium text-red-600">"{complaintToDelete?.detail}"</span>
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium
                  hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setComplaintToDelete(null);
                }}
              >
                ยกเลิก
              </button>
              <button
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium
                  hover:bg-red-700 transition-colors"
                onClick={confirmDelete}
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      <ComplaintFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        value={filterValue}
        defaultFiscalYear={currentFiscalYear()}
        fiscalYearOptions={fiscalYearOptions}
        categories={uniqueCategories}
        countFor={countForDraft}
        onApply={applyFilters}
      />

      <ComplaintActionsSheet
        complaint={actionsComplaint}
        state={actionsComplaint ? rowState(actionsComplaint, assignedComplaintIds.has(actionsComplaint._id)) : "pending"}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setActionsForId(null)}
        onAssign={(c) => handleAssign(c._id)}
        onUpdate={openUpdateFor}
        onCloseComplaint={(c) => handleCloseComplaint(c._id)}
        onOpenDetail={openDetail}
        onToggleConfidential={toggleConfidential}
        onTogglePdpa={togglePdpa}
        onDelete={handleDeleteComplaint}
      />

      {/* Complaint Detail Modal */}
      {showDetailModal && selectedComplaint && (
        <ComplaintDetailModal
          complaint={selectedComplaint}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedComplaint(null);
          }}
          assignments={assignments}
          menu={menu}
          assignedUsers={assignedUsers}
          onOpenUpdateModal={(assignment) => {
            router.push(`/admin/my-tasks/${assignment._id}`);
          }}
          onPrivacySaved={(updated) => {
            if (updated?._id) {
              setSelectedComplaint((prev) =>
                prev && String(prev._id) === String(updated._id) ? { ...prev, ...updated } : prev
              );
            }
            fetchComplaints();
          }}
        />
      )}
    </>
  );
}
