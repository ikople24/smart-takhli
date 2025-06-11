import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import Head from "next/head";
import useComplaintStore from "@/stores/useComplaintStore";
import { useMenuStore } from "@/stores/useMenuStore";
import UpdateAssignmentModal from "@/components/UpdateAssignmentModal"; // สร้าง component นี้แยกต่างหาก
import EditUserModal from "@/components/EditUserModal";

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

  useEffect(() => {
    fetchComplaints();
    fetchMenu(); // fetch menu with icons
    // Fetch assignments
    const fetchAssignments = async () => {
      try {
        const response = await fetch("/api/assignments");
        const data = await response.json();
        setAssignments(data);
      } catch (error) {
        console.error("Error fetching assignments:", error);
      }
    };
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

  const handleAssign = async (complaintId) => {
    try {
      const res = await fetch("/api/assignments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complaintId: complaintId,
          userId: existingUser?._id, // ใช้จาก MongoDB ไม่ใช่ Clerk
        }),
      });

      if (!res.ok) throw new Error("Failed to assign complaint");
      const result = await res.json();
      console.log("Assignment created:", result);
      setAssignmentCreated(true);
      alert("รับงานสำเร็จ");
    } catch (error) {
      console.error("❌ Error assigning complaint:", error);
      alert("เกิดข้อผิดพลาดในการรับงาน");
    }
  };

  const handleCloseComplaint = async (complaintId) => {
    try {
      const res = await fetch(`/api/submittedreports/update-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId, status: "ดำเนินการเสร็จสิ้น" }),
      });
      if (!res.ok) throw new Error("Failed to close complaint");
      alert("ปิดเรื่องเรียบร้อยแล้ว");
      fetchComplaints(); // รีเฟรชข้อมูลใหม่
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
 

  return (
    <>
      <Head>
        <title>จัดการเรื่องร้องเรียน - Admin</title>
      </Head>
      <div className="p-6 max-w-full mx-auto">
        <h1 className="text-2xl font-bold mb-4">จัดการเรื่องร้องเรียน</h1>
        {complaints.length === 0 ? (
          <p>ไม่มีข้อมูลเรื่องร้องเรียน</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th>หมวดหมู่</th>
                  <th>ภาพปัญหา</th>
                  <th>หัวข้อ</th>
                  <th>อัปเดตล่าสุด</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => {
                  const isAssigned = assignments.some(
                    (a) => a.complaintId === complaint._id
                  );
                  const isClosed = complaint.status === "ดำเนินการเสร็จสิ้น";
                  return (
                    <tr key={complaint._id}>
                      <td className="text-center text-sm">
                        <div className="flex flex-col items-center justify-center">
                          {menu.find((m) => m.Prob_name === complaint.category)?.Prob_pic && (
                            <img
                              src={
                                menu.find((m) => m.Prob_name === complaint.category)?.Prob_pic
                              }
                              alt={complaint.category}
                              className="w-10 h-10 object-contain mb-1"
                            />
                          )}
                          <span className="truncate max-w-[6rem] text-sm leading-tight text-center">
                            {complaint.category}
                          </span>
                        </div>
                      </td>
                      <td className="text-center text-sm">
                        {Array.isArray(complaint.images) && complaint.images.length > 0 && (
                          <img
                            src={complaint.images[0]}
                            alt="ภาพปัญหา"
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                      </td>
                      <td className="text-sm max-w-xs overflow-hidden whitespace-nowrap text-ellipsis">
                        <div className="font-medium">
                          {complaint.detail}
                        </div>
                      </td>
                      <td className="text-sm">
                        {new Date(complaint.updatedAt).toLocaleDateString(
                          "th-TH"
                        )}
                      </td>
                      <td className="flex gap-2">
                        {!isClosed ? (
                          isAssigned ? (
                            <>
                              <button
                                className="btn btn-info btn-sm"
                                onClick={() =>
                                  handleOpenUpdateForm(
                                    assignments.find((a) => a.complaintId === complaint._id)
                                  )
                                }
                              >
                                อัพเดท
                              </button>
                              <button
                                className="btn btn-warning btn-sm"
                                onClick={() => {
                                  setSelectedAssignment(complaint);
                                  setShowEditUserModal(true);
                                }}
                              >
                                แก้ไขผู้แจ้ง
                              </button>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleCloseComplaint(complaint._id)}
                              >
                                ปิดเรื่อง
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAssign(complaint._id)}
                              disabled={loading}
                            >
                              รับเรื่อง
                            </button>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs italic">เรื่องร้องเรียนนี้ถูกปิดแล้ว</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
    </>
  );
}
