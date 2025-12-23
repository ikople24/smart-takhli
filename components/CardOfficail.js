import React, { useEffect, useState } from "react";
import Image from "next/image";
import { 
  AlertCircle, 
  MessageCircleHeart, 
  User, 
  Calendar, 
  Shield, 
  Zap,
  CheckCircle2,
  Timer
} from "lucide-react";
import SatisfactionForm from "./SatisfactionForm";

export default function CardOfficail(props) {
  const [assignedDate, setAssignedDate] = useState(null);
  const [completedDate, setCompletedDate] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [complaintStatus, setComplaintStatus] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);
  const [satisfactionCount, setSatisfactionCount] = useState(0);
  const MAX_RATINGS = 4; // จำนวนครั้งสูงสุดที่สามารถประเมินได้

  // ฟังก์ชันซ่อนนามสกุลของเจ้าหน้าที่
  const hideLastName = (fullName) => {
    if (!fullName) return 'ไม่ระบุ';
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length <= 1) {
      return fullName;
    }
    return nameParts.slice(0, -1).join(' ') + ' xxxxxx';
  };

  // ฟังก์ชันคำนวณเวลาการประมวลผล
  const calculateProcessingTime = (assignedDate, completedDate) => {
    if (!assignedDate || !completedDate) return null;
    
    const assigned = new Date(assignedDate);
    const completed = new Date(completedDate);
    const diffTime = Math.abs(completed - assigned); // ใช้ค่าสัมบูรณ์
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffHours <= 24) {
      return { 
        text: "ภายใน 24 ชม", 
        color: "text-emerald-600", 
        bgColor: "bg-emerald-50", 
        borderColor: "border-emerald-200",
        gradientFrom: "from-emerald-500",
        gradientTo: "to-green-600"
      };
    } else if (diffDays <= 2) {
      return { 
        text: "ภายใน 2 วัน", 
        color: "text-blue-600", 
        bgColor: "bg-blue-50", 
        borderColor: "border-blue-200",
        gradientFrom: "from-blue-500",
        gradientTo: "to-indigo-600"
      };
    } else if (diffDays <= 7) {
      return { 
        text: "ภายใน 7 วัน", 
        color: "text-amber-600", 
        bgColor: "bg-amber-50", 
        borderColor: "border-amber-200",
        gradientFrom: "from-amber-500",
        gradientTo: "to-yellow-600"
      };
    } else if (diffDays <= 15) {
      return { 
        text: "ภายใน 15 วัน", 
        color: "text-orange-600", 
        bgColor: "bg-orange-50", 
        borderColor: "border-orange-200",
        gradientFrom: "from-orange-500",
        gradientTo: "to-red-500"
      };
    } else {
      return { 
        text: "เกิน 15 วัน", 
        color: "text-red-600", 
        bgColor: "bg-red-50", 
        borderColor: "border-red-200",
        gradientFrom: "from-red-500",
        gradientTo: "to-rose-600"
      };
    }
  };

  // Calculate actual time difference for display
  const getTimeDiff = (assignedDate, completedDate) => {
    if (!assignedDate || !completedDate) return null;
    const assigned = new Date(assignedDate);
    const completed = new Date(completedDate);
    const diffTime = Math.abs(completed - assigned); // ใช้ค่าสัมบูรณ์เพื่อป้องกันค่าติดลบ
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // แสดงผลในรูปแบบที่อ่านง่าย
    if (diffMinutes < 60) {
      return `${diffMinutes} นาที`;
    } else if (diffHours < 24) {
      const remainingMinutes = diffMinutes % 60;
      if (remainingMinutes > 0) {
        return `${diffHours} ชม. ${remainingMinutes} นาที`;
      }
      return `${diffHours} ชั่วโมง`;
    } else {
      const remainingHours = diffHours % 24;
      if (remainingHours > 0) {
        return `${diffDays} วัน ${remainingHours} ชม.`;
      }
      return `${diffDays} วัน`;
    }
  };

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await fetch("/api/assignments");
        const data = await res.json();
        if (props.probId) {
          const responsibleAssignments = data.filter(
            assignment => assignment.complaintId === props.probId
          );
          if (responsibleAssignments.length > 0) {
            setAssignedDate(responsibleAssignments[0].assignedAt);
            setCompletedDate(responsibleAssignments[0].completedAt);
            if (responsibleAssignments[0].userId) {
              try {
                const userRes = await fetch(`/api/users/get-by-id?userId=${responsibleAssignments[0].userId}`);
                const userData = await userRes.json();
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
          if (data && data.length > 0) {
            setComplaintStatus(data[0].status);
          }
        }
      } catch (error) {
        console.error("Error fetching complaint status:", error);
      }
    };

    const fetchSatisfactionCount = async () => {
      try {
        if (props.probId) {
          const res = await fetch(`/api/satisfaction/count?complaintId=${props.probId}`);
          const data = await res.json();
          if (data.success) {
            setSatisfactionCount(data.count || 0);
          }
        }
      } catch (error) {
        console.error("Error fetching satisfaction count:", error);
      }
    };

    fetchAssignments();
    fetchComplaintStatus();
    fetchSatisfactionCount();
  }, [props.probId]);

  if (!assignedDate) {
    return null;
  }

  const processingTime = calculateProcessingTime(assignedDate, completedDate);

  return (
    <div className="w-full">
      {/* Officer Card */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50 rounded-2xl p-4 border border-blue-100 shadow-sm">
        {/* Header with title and processing time */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">เจ้าหน้าที่รับผิดชอบ</h3>
          </div>
          
          {/* Processing Time Badge - moved to right */}
          {processingTime && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gradient-to-r ${processingTime.gradientFrom} ${processingTime.gradientTo} text-white shadow-sm`}>
              <Zap size={10} />
              {processingTime.text}
            </div>
          )}
        </div>

        {assignedUser ? (
          <div className="flex items-start gap-4">
            {/* Profile Image */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-lg bg-gradient-to-br from-blue-100 to-indigo-100">
                {(assignedUser.profileUrl || assignedUser.profileImage) ? (
                  <Image
                    src={assignedUser.profileUrl || assignedUser.profileImage}
                    alt="Profile"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                    unoptimized={true}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Shield size={24} className="text-blue-500" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <CheckCircle2 size={10} className="text-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-gray-900 truncate">
                {hideLastName(assignedUser.name)}
              </h4>
              <p className="text-xs text-gray-500 truncate">{assignedUser.position}</p>
              <p className="text-xs text-blue-600 font-medium truncate">{assignedUser.department}</p>
              
              {/* Dates */}
              <div className="flex flex-wrap gap-2 mt-3">
                <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-lg border border-gray-100">
                  <Calendar size={12} className="text-blue-500" />
                  <span className="text-gray-600">รับเรื่อง:</span>
                  <span className="font-medium text-gray-800">
                    {new Date(assignedDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </span>
                </div>
                {completedDate && (
                  <div className="flex items-center gap-1 text-xs bg-white px-2 py-1 rounded-lg border border-green-100">
                    <CheckCircle2 size={12} className="text-green-500" />
                    <span className="text-gray-600">เสร็จ:</span>
                    <span className="font-medium text-green-700">
                      {new Date(completedDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Processing Time Detail */}
              {processingTime && getTimeDiff(assignedDate, completedDate) && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <Timer size={12} />
                  <span>ใช้เวลา: <span className="font-semibold text-gray-700">{getTimeDiff(assignedDate, completedDate)}</span></span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 text-gray-400 text-sm">
            <div className="animate-pulse flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-200 rounded-full" />
              กำลังโหลดข้อมูลเจ้าหน้าที่...
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-between items-center gap-2 mt-4">
        <button className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 border border-gray-200 rounded-xl opacity-50 cursor-not-allowed">
          <AlertCircle size={14} />
          รายงาน
        </button>
        
        {complaintStatus === "ดำเนินการเสร็จสิ้น" && satisfactionCount < MAX_RATINGS && (
          <button
            onClick={() => setShowRating(!showRating)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
              showRating 
                ? "bg-gray-100 text-gray-600" 
                : "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30 hover:shadow-xl hover:shadow-pink-500/40 hover:scale-105"
            }`}
          >
            <MessageCircleHeart size={16} />
            {showRating ? "ซ่อน" : "ให้คะแนนความพึงพอใจ"}
          </button>
        )}

        {complaintStatus === "ดำเนินการเสร็จสิ้น" && satisfactionCount >= MAX_RATINGS && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-xs font-medium rounded-xl border border-green-200">
            <CheckCircle2 size={14} />
            ประเมินครบ {MAX_RATINGS} ครั้งแล้ว
          </div>
        )}

        {complaintStatus === "ดำเนินการเสร็จสิ้น" && satisfactionCount > 0 && satisfactionCount < MAX_RATINGS && (
          <span className="text-xs text-gray-500">
            ({satisfactionCount}/{MAX_RATINGS} ครั้ง)
          </span>
        )}
      </div>

      {/* Satisfaction Form */}
      {showRating && complaintStatus === "ดำเนินการเสร็จสิ้น" && satisfactionCount < MAX_RATINGS && (
        <div className="mt-4 animate-fade-in">
          <SatisfactionForm
            complaintId={props.probId}
            status={complaintStatus}
            onSubmit={() => {
              setShowRating(false);
              // Refresh satisfaction count
              setSatisfactionCount(prev => prev + 1);
            }}
          />
        </div>
      )}
    </div>
  );
}
