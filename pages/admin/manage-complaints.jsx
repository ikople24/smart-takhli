import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import Head from "next/head";
import useComplaintStore from "@/stores/useComplaintStore";
import { useMenuStore } from "@/stores/useMenuStore";
import UpdateAssignmentModal from "@/components/UpdateAssignmentModal";
import EditUserModal from "@/components/EditUserModal";
import ComplaintStatsNew from "@/components/ComplaintStatsNew";
import OverdueComplaintsAlertNew from "@/components/OverdueComplaintsAlertNew";
import ComplaintDetailModal from "@/components/ComplaintDetailModal";
import ExportComplaints from "@/components/ExportComplaints";

const LocationPickerModal = dynamic(() => import("@/components/LocationPickerModal"), {
  ssr: false,
});

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
  
  // Core states
  const [loading, setLoading] = useState(true);
  const [existingUser, setExistingUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState({});
  
  // Check if user is superadmin
  const isSuperAdmin = existingUser?.role === 'superadmin';
  
  // Modal states
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [complaintToDelete, setComplaintToDelete] = useState(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // View mode
  const [viewMode, setViewMode] = useState("table"); // table | card
  
  // Debounced search
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Fetch assignments with user data
  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetch("/api/assignments");
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
  const assignedComplaintIds = useMemo(() => 
    new Set(assignments.map(a => a.complaintId)), 
    [assignments]
  );

  const stats = useMemo(() => ({
    total: complaints.length,
    pending: complaints.filter(c => !assignedComplaintIds.has(c._id)).length,
    inProgress: complaints.filter(c => c.status === "อยู่ระหว่างดำเนินการ").length,
    completed: complaints.filter(c => c.status === "ดำเนินการเสร็จสิ้น").length
  }), [complaints, assignedComplaintIds]);

  const uniqueCategories = useMemo(() => 
    [...new Set(complaints.map(c => c.category))].filter(Boolean),
    [complaints]
  );

  // Filtered and sorted complaints
  const filteredComplaints = useMemo(() => {
    return complaints
      .filter((complaint) => {
        const matchesSearch = !debouncedSearch || 
          complaint.detail?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          complaint.category?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          complaint.fullName?.toLowerCase().includes(debouncedSearch.toLowerCase());
        
        let matchesStatus = false;
        if (statusFilter === "all") {
          matchesStatus = true;
        } else if (statusFilter === "รอการมอบหมาย") {
          matchesStatus = !assignedComplaintIds.has(complaint._id);
        } else {
          matchesStatus = complaint.status === statusFilter;
        }
        
        const matchesCategory = categoryFilter === "all" || complaint.category === categoryFilter;
        
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "updatedAt":
            comparison = new Date(b.updatedAt) - new Date(a.updatedAt);
            break;
          case "createdAt":
            comparison = new Date(b.createdAt) - new Date(a.createdAt);
            break;
          case "category":
            comparison = (a.category || "").localeCompare(b.category || "");
            break;
          case "status":
            comparison = (a.status || "").localeCompare(b.status || "");
            break;
          default:
            comparison = 0;
        }
        return sortOrder === "desc" ? comparison : -comparison;
      });
  }, [complaints, debouncedSearch, statusFilter, categoryFilter, sortBy, sortOrder, assignedComplaintIds]);

  // Pagination
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const paginatedComplaints = filteredComplaints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter]);

  // Handlers
  const handleAssign = async (complaintId) => {
    try {
      const res = await fetch("/api/assignments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId, userId: existingUser?._id }),
      });
      if (!res.ok) throw new Error("Failed to assign");
      await fetchAssignments();
      alert("รับงานสำเร็จ");
    } catch (error) {
      console.error("Error assigning:", error);
      alert("เกิดข้อผิดพลาดในการรับงาน");
    }
  };

  const handleCloseComplaint = async (complaintId) => {
    const assignment = assignments.find((a) => a.complaintId === complaintId);
    if (!assignment?.completedAt) {
      alert("กรุณาระบุวันที่ดำเนินการเสร็จสิ้นในแบบฟอร์มอัปเดตก่อน");
      return;
    }
    try {
      const res = await fetch(`/api/submittedreports/update-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId, status: "ดำเนินการเสร็จสิ้น" }),
      });
      if (!res.ok) throw new Error("Failed to close");
      alert("ปิดเรื่องเรียบร้อย");
      fetchComplaints();
    } catch (error) {
      console.error("Error closing:", error);
      alert("เกิดข้อผิดพลาดในการปิดเรื่อง");
    }
  };

  const handleOpenUpdateForm = (assignment) => {
    const complaint = complaints.find((c) => c._id === assignment.complaintId);
    setSelectedAssignment({ ...assignment, category: complaint?.category });
    setShowUpdateModal(true);
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

  return (
    <>
      <Head>
        <title>จัดการเรื่องร้องเรียน - Admin</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
                รวม {complaints.length.toLocaleString()} เรื่อง • 
                <span className="text-blue-600 ml-1">
                  {stats.inProgress} กำลังดำเนินการ
                </span>
                {!isSuperAdmin && (
                  <span className="text-gray-400 ml-2">
                    • การลบต้องใช้สิทธิ์ Super Admin
                  </span>
                )}
              </p>
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="btn btn-sm btn-ghost gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Export
              </button>
              
              {/* View toggle */}
              <div className="hidden sm:flex items-center bg-white rounded-lg border p-1">
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
          <ComplaintStatsNew 
            stats={stats} 
            isLoading={loading} 
            onStatClick={handleStatClick}
          />

          {/* Alerts and Export Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2">
              <OverdueComplaintsAlertNew 
                complaints={complaints} 
                assignments={assignments} 
                onComplaintClick={(complaint) => {
                  setSelectedComplaint(complaint);
                  setShowDetailModal(true);
                }}
              />
            </div>
            
            {showExportOptions && (
              <div className="lg:col-span-1">
                <ExportComplaints complaints={complaints} assignments={assignments} />
              </div>
            )}
          </div>

          {/* Filter Section */}
          <div className="bg-white rounded-xl border shadow-sm mb-6 overflow-hidden">
            {/* Quick Status Tabs */}
            <div className="flex border-b overflow-x-auto">
              {[
                { value: "all", label: "ทั้งหมด", count: stats.total },
                { value: "รอการมอบหมาย", label: "รอมอบหมาย", count: stats.pending },
                { value: "อยู่ระหว่างดำเนินการ", label: "กำลังดำเนินการ", count: stats.inProgress },
                { value: "ดำเนินการเสร็จสิ้น", label: "เสร็จสิ้น", count: stats.completed }
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                    ${statusFilter === tab.value 
                      ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {tab.label}
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    statusFilter === tab.value 
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
                    placeholder="ค้นหาจากหัวข้อ, หมวดหมู่, ชื่อผู้แจ้ง..."
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
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm 
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                    text-gray-700 min-w-[180px]"
                >
                  <option value="updatedAt-desc">ล่าสุด → เก่า</option>
                  <option value="updatedAt-asc">เก่า → ล่าสุด</option>
                  <option value="createdAt-desc">สร้างล่าสุด</option>
                  <option value="category-asc">หมวดหมู่ ก-ฮ</option>
                </select>
              </div>
            </div>
          </div>

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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
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
                            {getStatusBadge(complaint.status, isAssigned)}
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
                            <div className="flex flex-col gap-1.5 items-center">
                              {!isClosed ? (
                                isAssigned ? (
                                  <>
                                    <button
                                      className="w-full px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg
                                        hover:bg-blue-100 transition-colors"
                                      onClick={() => handleOpenUpdateForm(assignment)}
                                    >
                                      อัพเดท
                                    </button>
                                    <button
                                      className="w-full px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-lg
                                        hover:bg-emerald-100 transition-colors"
                                      onClick={() => handleCloseComplaint(complaint._id)}
                                    >
                                      ปิดเรื่อง
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg
                                      hover:bg-blue-700 transition-colors shadow-sm"
                                    onClick={() => handleAssign(complaint._id)}
                                  >
                                    รับเรื่อง
                                  </button>
                                )
                              ) : (
                                <button
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
                      <div className="flex gap-2">
                        {!isClosed ? (
                          isAssigned ? (
                            <>
                              <button
                                className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-lg
                                  hover:bg-blue-100 transition-colors"
                                onClick={() => handleOpenUpdateForm(assignment)}
                              >
                                อัพเดท
                              </button>
                              <button
                                className="flex-1 px-3 py-2 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-lg
                                  hover:bg-emerald-100 transition-colors"
                                onClick={() => handleCloseComplaint(complaint._id)}
                              >
                                ปิดเรื่อง
                              </button>
                            </>
                          ) : (
                            <button
                              className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                                hover:bg-blue-700 transition-colors"
                              onClick={() => handleAssign(complaint._id)}
                            >
                              รับเรื่อง
                            </button>
                          )
                        ) : (
                          <button
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

      {/* Modals */}
      {showUpdateModal && selectedAssignment && (
        <UpdateAssignmentModal
          assignment={selectedAssignment}
          onClose={() => setShowUpdateModal(false)}
        />
      )}
      
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
            const complaint = complaints.find((c) => c._id === assignment.complaintId);
            setSelectedAssignment({ ...assignment, category: complaint?.category });
            setShowUpdateModal(true);
          }}
        />
      )}
    </>
  );
}
