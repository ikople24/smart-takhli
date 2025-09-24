import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import Head from "next/head";
import useComplaintStore from "@/stores/useComplaintStore";
import { useMenuStore } from "@/stores/useMenuStore";
import UpdateAssignmentModal from "@/components/UpdateAssignmentModal";
import EditUserModal from "@/components/EditUserModal";
import ComplaintStats from "@/components/ComplaintStats";
import OverdueComplaintsAlert from "@/components/OverdueComplaintsAlert";
import ComplaintDetailModal from "@/components/ComplaintDetailModal";
import ExportComplaints from "@/components/ExportComplaints";

const LocationPickerModal = dynamic(() => import("@/components/LocationPickerModal"), {
  ssr: false,
});

export default function ManageComplaintsPage() {
  const { complaints, fetchComplaints } = useComplaintStore();
  const { menu, fetchMenu } = useMenuStore();
  const { user } = useUser();
  const { getToken, userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] = useState(null);
  const [assignmentCreated, setAssignmentCreated] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [assignedUsers, setAssignedUsers] = useState({});
  
  // New state for enhanced filtering and search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [complaintToDelete, setComplaintToDelete] = useState(null);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const fetchAssignments = async () => {
    try {
      const response = await fetch("/api/assignments");
      const data = await response.json();
      setAssignments(data);
      
      // Fetch assigned users info
      const usersData = {};
      for (const assignment of data) {
        if (assignment.userId) {
          try {
            const userResponse = await fetch(`/api/users/get-by-id?userId=${assignment.userId}`);
            const userData = await userResponse.json();
            if (userData.success && userData.user) {
              usersData[assignment.userId] = userData.user;
            }
          } catch (error) {
            console.error("Error fetching user:", error);
          }
        }
      }
      setAssignedUsers(usersData);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchMenu();
    fetchAssignments();
  }, [fetchComplaints, fetchMenu]);

  useEffect(() => {
    const checkUser = async () => {
      if (!userId) return;

      try {
        const token = await getToken();
        const clerkId = userId;
        const res = await fetch("/api/users/get-by-clerkId", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  // Enhanced filtering and search logic
  const filteredComplaints = complaints
    .filter((complaint) => {
      const matchesSearch = complaint.detail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           complaint.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           complaint.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || complaint.status === statusFilter;
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

  // Pagination
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);
  const paginatedComplaints = filteredComplaints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique categories for filter
  const uniqueCategories = [...new Set(complaints.map(c => c.category))].filter(Boolean);

  const handleAssign = async (complaintId) => {
    try {
      const res = await fetch("/api/assignments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintId: complaintId,
          userId: existingUser?._id,
        }),
      });

      if (!res.ok) throw new Error("Failed to assign complaint");
      const result = await res.json();
      console.log("Assignment created:", result);
      setAssignmentCreated(true);
      alert("รับงานสำเร็จ");
      fetchAssignments();
    } catch (error) {
      console.error("❌ Error assigning complaint:", error);
      alert("เกิดข้อผิดพลาดในการรับงาน");
    }
  };

  const handleCloseComplaint = async (complaintId) => {
    const assignment = assignments.find((a) => a.complaintId === complaintId);
    if (!assignment?.completedAt) {
      alert("ไม่สามารถปิดเรื่องได้: กรุณาระบุวันที่ดำเนินการเสร็จสิ้นในแบบฟอร์มอัปเดต");
      return;
    }
    try {
      const res = await fetch(`/api/submittedreports/update-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId, status: "ดำเนินการเสร็จสิ้น" }),
      });
      if (!res.ok) throw new Error("Failed to close complaint");
      alert("ปิดเรื่องเรียบร้อยแล้ว");
      fetchComplaints();
    } catch (error) {
      console.error("❌ Error closing complaint:", error);
      alert("เกิดข้อผิดพลาดในการปิดเรื่อง");
    }
  };

  const handleOpenUpdateForm = (assignment) => {
    const complaint = complaints.find((c) => c._id === assignment.complaintId);
    const assignmentWithCategory = { ...assignment, category: complaint?.category };
    setSelectedAssignment(assignmentWithCategory);
    setShowUpdateModal(true);
  };

  const handleDeleteComplaint = (complaint) => {
    setComplaintToDelete(complaint);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!complaintToDelete) return;
    
    try {
      const res = await fetch(`/api/submittedreports/${complaintToDelete._id}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`ลบไม่สำเร็จ: ${errorText}`);
      }
      
      alert("ลบเรื่องสำเร็จ");
      fetchComplaints();
      setShowDeleteConfirm(false);
      setComplaintToDelete(null);
    } catch (err) {
      console.error("❌ ลบไม่สำเร็จ:", err);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  const handleOverdueComplaintClick = (complaint) => {
    setSelectedComplaint(complaint);
    setShowDetailModal(true);
  };

  const handleOpenUpdateFromDetail = (assignment) => {
    const complaint = complaints.find((c) => c._id === assignment.complaintId);
    const assignmentWithCategory = { ...assignment, category: complaint?.category };
    setSelectedAssignment(assignmentWithCategory);
    setShowUpdateModal(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      "อยู่ระหว่างดำเนินการ": { color: "badge-warning", text: "กำลังดำเนินการ" },
      "ดำเนินการเสร็จสิ้น": { color: "badge-success", text: "เสร็จสิ้น" },
      "รอการมอบหมาย": { color: "badge-info", text: "รอการมอบหมาย" }
    };
    
    const config = statusConfig[status] || { color: "badge-neutral", text: status };
    return <span className={`badge ${config.color}`}>{config.text}</span>;
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
      
      <div className="p-6 max-w-full mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">จัดการเรื่องร้องเรียน</h1>
          <div className="text-sm text-gray-600">
            รวม {complaints.length} เรื่อง • 
            <span className="text-blue-600 ml-1">
              {complaints.filter(c => c.status === "อยู่ระหว่างดำเนินการ").length} กำลังดำเนินการ
            </span>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <ComplaintStats complaints={complaints} assignments={assignments} />

        {/* Overdue Complaints Alert and Export Section - Side by side on wide screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Overdue Complaints Alert */}
          <div>
            <OverdueComplaintsAlert 
              complaints={complaints} 
              assignments={assignments} 
              onComplaintClick={handleOverdueComplaintClick}
            />
          </div>

          {/* Export Section */}
          <div>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowExportOptions(!showExportOptions)}
                className="btn btn-sm btn-outline btn-ghost"
              >
                {showExportOptions ? 'ซ่อน' : 'แสดง'} Export ตัวเลือก
              </button>
            </div>
            
            {showExportOptions && (
              <ExportComplaints complaints={complaints} assignments={assignments} />
            )}
          </div>
        </div>

        {/* Enhanced Filter and Search Section */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ค้นหา</label>
              <input
                type="text"
                placeholder="ค้นหาจากหัวข้อ, หมวดหมู่, ชื่อผู้แจ้ง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">สถานะ</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select select-bordered w-full"
              >
                <option value="all">ทั้งหมด</option>
                <option value="รอการมอบหมาย">รอการมอบหมาย</option>
                <option value="อยู่ระหว่างดำเนินการ">กำลังดำเนินการ</option>
                <option value="ดำเนินการเสร็จสิ้น">เสร็จสิ้น</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="select select-bordered w-full"
              >
                <option value="all">ทั้งหมด</option>
                {uniqueCategories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">เรียงลำดับ</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="select select-bordered w-full"
              >
                <option value="updatedAt-desc">อัปเดตล่าสุด (ใหม่-เก่า)</option>
                <option value="updatedAt-asc">อัปเดตล่าสุด (เก่า-ใหม่)</option>
                <option value="createdAt-desc">วันที่สร้าง (ใหม่-เก่า)</option>
                <option value="createdAt-asc">วันที่สร้าง (เก่า-ใหม่)</option>
                <option value="category-asc">หมวดหมู่ (ก-ฮ)</option>
                <option value="status-asc">สถานะ (ก-ฮ)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4 text-sm text-gray-600">
          แสดง {paginatedComplaints.length} จาก {filteredComplaints.length} เรื่อง
          {searchTerm && ` สำหรับ "${searchTerm}"`}
        </div>

        {filteredComplaints.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">ไม่พบข้อมูล</h3>
            <p className="text-gray-500">ลองเปลี่ยนเงื่อนไขการค้นหาหรือตัวกรอง</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center">ลำดับ</th>
                    <th className="text-center">สถานะ</th>
                    <th className="text-center">หมวดหมู่</th>
                    <th className="text-center">ภาพปัญหา</th>
                    <th>หัวข้อ</th>
                    <th className="text-center">เจ้าหน้าที่</th>
                    <th className="text-center">อัปเดตล่าสุด</th>
                    <th className="text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedComplaints.map((complaint, index) => {
                    const isAssigned = assignments.some(
                      (a) => a.complaintId === complaint._id
                    );
                    const isClosed = complaint.status === "ดำเนินการเสร็จสิ้น";
                    const assignment = assignments.find((a) => a.complaintId === complaint._id);
                    
                    return (
                      <tr key={complaint._id} className="hover:bg-gray-50">
                        <td className="text-center text-sm font-medium">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td className="text-center">
                          {getStatusBadge(complaint.status)}
                        </td>
                        <td className="text-center text-sm">
                          <div className="flex flex-col items-center justify-center">
                            {menu.find((m) => m.Prob_name === complaint.category)?.Prob_pic && (
                              <img
                                src={menu.find((m) => m.Prob_name === complaint.category)?.Prob_pic}
                                alt={complaint.category}
                                className="w-8 h-8 object-contain mb-1"
                              />
                            )}
                            <span className="truncate max-w-[6rem] text-xs leading-tight text-center">
                              {complaint.category}
                            </span>
                          </div>
                        </td>
                        <td className="text-center text-sm">
                          {Array.isArray(complaint.images) && complaint.images.length > 0 && (
                            <img
                              src={complaint.images[0]}
                              alt="ภาพปัญหา"
                              className="w-12 h-12 object-cover rounded cursor-pointer hover:scale-110 transition-transform"
                              onClick={() => window.open(complaint.images[0], '_blank')}
                            />
                          )}
                        </td>
                        <td className="text-sm max-w-xs">
                          <div className="font-medium truncate cursor-pointer hover:text-blue-600" 
                               title={complaint.detail}
                               onClick={() => {
                                 setSelectedComplaint(complaint);
                                 setShowDetailModal(true);
                               }}>
                            {complaint.detail}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {getDaysSinceUpdate(complaint.updatedAt)}
                          </div>
                        </td>
                        <td className="text-center text-sm">
                          {isAssigned ? (
                            <div className="text-xs">
                              {assignedUsers[assignment?.userId] ? (
                                <>
                                  <div className="font-medium text-blue-600">
                                    {assignedUsers[assignment.userId].name}
                                  </div>
                                  {assignedUsers[assignment.userId].position && (
                                    <div className="text-gray-500">
                                      {assignedUsers[assignment.userId].position}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-gray-500">กำลังโหลด...</div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">-</div>
                          )}
                        </td>
                        <td className="text-center text-sm">
                          <div className="text-xs">
                            <div>{new Date(complaint.updatedAt).toLocaleDateString("th-TH")}</div>
                            <div className="text-gray-500">
                              {new Date(complaint.updatedAt).toLocaleTimeString("th-TH", {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="flex flex-col gap-1">
                            {!isClosed ? (
                              isAssigned ? (
                                <>
                                  <button
                                    className="btn btn-info btn-xs"
                                    onClick={() => handleOpenUpdateForm(assignment)}
                                    title="อัปเดตความคืบหน้า"
                                  >
                                    อัพเดท
                                  </button>
                                  <button
                                    className="btn btn-warning btn-xs"
                                    onClick={() => {
                                      setSelectedAssignment(complaint);
                                      setShowEditUserModal(true);
                                    }}
                                    title="แก้ไขข้อมูลผู้แจ้ง"
                                  >
                                    แก้ไขผู้แจ้ง
                                  </button>
                                  <button
                                    className="btn btn-success btn-xs"
                                    onClick={() => handleCloseComplaint(complaint._id)}
                                    title="ปิดเรื่อง"
                                  >
                                    ปิดเรื่อง
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn btn-primary btn-xs"
                                  onClick={() => handleAssign(complaint._id)}
                                  disabled={loading}
                                  title="รับเรื่อง"
                                >
                                  รับเรื่อง
                                </button>
                              )
                            ) : (
                              <button
                                className="btn btn-error btn-xs"
                                onClick={() => handleDeleteComplaint(complaint)}
                                title="ลบเรื่อง"
                              >
                                ลบเรื่อง
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
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <div className="join">
              <button
                className="join-item btn btn-sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                «
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`join-item btn btn-sm ${currentPage === page ? 'btn-active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="join-item btn btn-sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                »
              </button>
            </div>
          </div>
        )}
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
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">ยืนยันการลบ</h3>
            <p className="py-4">
              คุณแน่ใจหรือไม่ว่าต้องการลบเรื่องร้องเรียนนี้?
              <br />
              <span className="font-medium text-red-600">
                "{complaintToDelete?.detail}"
              </span>
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setComplaintToDelete(null);
                }}
              >
                ยกเลิก
              </button>
              <button
                className="btn btn-error"
                onClick={confirmDelete}
              >
                ลบ
              </button>
            </div>
          </div>
        </dialog>
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
          onOpenUpdateModal={handleOpenUpdateFromDetail}
        />
      )}
    </>
  );
}
