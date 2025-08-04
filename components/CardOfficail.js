import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, MessageCircleHeart, User, Calendar, Clock, Shield, Zap } from "lucide-react";
import SatisfactionForm from "./SatisfactionForm";


export default function CardOfficail(props) {
  // console.log("CardOfficail received props:", props);
    const [assignments, setAssignments] = useState([]);
    const [assignedDate, setAssignedDate] = useState(null);
    const [completedDate, setCompletedDate] = useState(null);
    const [showRating, setShowRating] = useState(false);
    const [complaintStatus, setComplaintStatus] = useState(null);
    const [assignedUser, setAssignedUser] = useState(null);

    // ฟังก์ชันคำนวณเวลาการประมวลผล
    const calculateProcessingTime = (assignedDate, completedDate) => {
      if (!assignedDate || !completedDate) return null;
      
      const assigned = new Date(assignedDate);
      const completed = new Date(completedDate);
      const diffTime = completed - assigned;
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log("⏱️ Processing time calculation:", {
        assigned: assigned.toLocaleString('th-TH'),
        completed: completed.toLocaleString('th-TH'),
        diffHours,
        diffDays
      });
      
      if (diffHours <= 24) {
        return { text: "ภายใน 24 ชม", color: "text-green-600", bgColor: "bg-green-100", borderColor: "border-green-300" };
      } else if (diffDays <= 2) {
        return { text: "ภายใน 2 วัน", color: "text-blue-600", bgColor: "bg-blue-100", borderColor: "border-blue-300" };
      } else if (diffDays <= 7) {
        return { text: "ภายใน 7 วัน", color: "text-yellow-600", bgColor: "bg-yellow-100", borderColor: "border-yellow-300" };
      } else if (diffDays <= 15) {
        return { text: "ภายใน 15 วัน", color: "text-orange-600", bgColor: "bg-orange-100", borderColor: "border-orange-300" };
      } else {
        return { text: "เกิน 15 วัน", color: "text-red-600", bgColor: "bg-red-100", borderColor: "border-red-300" };
      }
    };

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await fetch("/api/assignments");
        const data = await res.json();
        // console.log("Fetched assignments:", data);
        setAssignments(data);
        if (props.probId) {
          const responsibleAssignments = data.filter(
            assignment => assignment.complaintId === props.probId
          );
          // console.log("Filtered assignments by complaintId:", responsibleAssignments); //debug:
          if (responsibleAssignments.length > 0) {
            setAssignedDate(responsibleAssignments[0].assignedAt);
            setCompletedDate(responsibleAssignments[0].completedAt);
            // ดึงข้อมูล user จาก assignment ที่ตรงกับ complaintId
            if (responsibleAssignments[0].userId) {
              try {
                console.log("🔍 Fetching user with ID:", responsibleAssignments[0].userId);
                const userRes = await fetch(`/api/users/get-by-id?userId=${responsibleAssignments[0].userId}`);
                const userData = await userRes.json();
                console.log("👤 User data response:", userData);
                if (userData.success && userData.user) {
                  setAssignedUser(userData.user);
                }
              } catch (error) {
                console.error("Failed to fetch assigned user:", error);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching assignments:", error);
      }
    };

    const fetchComplaintStatus = async () => {
      try {
        if (props.probId) {
          const res = await fetch(`/api/complaints?complaintId=${props.probId}`);
          const data = await res.json();
          console.log("📋 Complaint data:", data);
          if (data && data.length > 0) {
            const status = data[0].status;
            console.log("📋 Complaint status:", status);
            setComplaintStatus(status);
          }
        }
      } catch (error) {
        console.error("Error fetching complaint status:", error);
      }
    };

    fetchAssignments();
    fetchComplaintStatus();
  }, [props.probId]);

  // Conditionally render nothing if no assignedDate is found
  if (!assignedDate) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-white shadow-md rounded-md p-4">
      <div className="flex flex-col space-y-4">
        {/* เจ้าหน้าที่รับผิดชอบ Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h2 className="text-lg font-semibold mb-3 text-blue-800 flex items-center gap-2">
            <User className="w-5 h-5" />
            เจ้าหน้าที่รับผิดชอบ
          </h2>
          {calculateProcessingTime(assignedDate, completedDate) && (
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${calculateProcessingTime(assignedDate, completedDate).bgColor} ${calculateProcessingTime(assignedDate, completedDate).borderColor} border ${calculateProcessingTime(assignedDate, completedDate).color} mb-2`}>
              <Zap className="w-3 h-3" />
              {calculateProcessingTime(assignedDate, completedDate).text}
            </div>
          )}
          {assignedUser ? (
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {(assignedUser.profileUrl || assignedUser.profileImage) ? (
                  <Image
                    src={assignedUser.profileUrl || assignedUser.profileImage}
                    alt="Profile"
                    width={60}
                    height={60}
                    className="w-15 h-15 rounded-full object-cover border-2 border-blue-300"
                    onError={(e) => {
                      console.log("🖼️ Image failed to load, using fallback");
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                    unoptimized={true}
                  />
                ) : null}
                <div className={`w-15 h-15 rounded-full border-2 border-blue-300 bg-blue-100 flex items-center justify-center ${(assignedUser.profileUrl || assignedUser.profileImage) ? 'hidden' : 'flex'}`}>
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-lg font-medium text-gray-900">{assignedUser.name}</div>
                <div className="text-sm text-gray-600">{assignedUser.position}</div>
                <div className="text-sm text-gray-600">{assignedUser.department}</div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>รับเรื่อง: {new Date(assignedDate).toLocaleDateString('th-TH')}</span>
                  </div>
                  {completedDate && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>เสร็จสิ้น: {new Date(completedDate).toLocaleDateString('th-TH')}</span>
                    </div>
                  )}
                </div>
                {calculateProcessingTime(assignedDate, completedDate) && (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-medium">เวลาการประมวลผล: </span>
                    {(() => {
                      const assigned = new Date(assignedDate);
                      const completed = new Date(completedDate);
                      const diffTime = completed - assigned;
                      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffHours < 24) {
                        return `${diffHours} ชั่วโมง`;
                      } else {
                        return `${diffDays} วัน`;
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              {assignments[0]?.userId ? "กำลังโหลดข้อมูลเจ้าหน้าที่..." : "ไม่พบข้อมูลเจ้าหน้าที่ที่รับผิดชอบ"}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-between items-center gap-2">
          <button className="btn btn-outline btn-error btn-sm btn-disabled text-red-400">
            <AlertCircle className="w-4 h-4" /> รายงาน
          </button>
          {complaintStatus === "ดำเนินการเสร็จสิ้น" && (
            <button
              className="btn btn-info btn-sm text-white"
              onClick={() => setShowRating(!showRating)}
            >
              <MessageCircleHeart className="w-6 h-6 text-white" /> ประเมินความพึงพอใจ
            </button>
          )}
        </div>

        {/* Satisfaction Form */}
        {showRating && complaintStatus === "ดำเนินการเสร็จสิ้น" && (
          <div className="mt-4 w-full">
            <SatisfactionForm
              complaintId={props.probId}
              status={complaintStatus}
              onSubmit={(data) => {
                console.log("ส่งความคิดเห็น:", data);
                setShowRating(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
