import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, MessageCircleHeart } from "lucide-react";


export default function CardOfficail(props) {
  // console.log("CardOfficail received props:", props);
    const [assignments, setAssignments] = useState([]);
    const [assignedDate, setAssignedDate] = useState(null);
    const [completedDate, setCompletedDate] = useState(null);
    const [officer, setOfficer] = useState(null);

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
          }
        }
      } catch (error) {
        console.error("Error fetching assignments:", error);
      }
    };

    fetchAssignments();
  }, [props.probId]);
  useEffect(() => {
    const fetchOfficer = async () => {
      try {
        if (!assignments[0]?.userId) return;

        const res = await fetch("/api/users/get-all-user");
        const data = await res.json();
        const users = data.users || data;
        const matchedUserId = assignments[0].userId;

        const officerData = users.find(user => user._id === matchedUserId);
        // console.log("Matched officer:", officerData); //debug:

        if (officerData) {
          setOfficer(officerData);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchOfficer();
  }, [assignments]);

     
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-md shadow p-4">
      <div className="text-md font-semibold mb-2">เจ้าหน้าที่ดูแลเรื่อง</div>
      <div className="grid grid-cols-[30%_70%] gap-4 items-start">
        <div className="flex flex-col items-center gap-2 border-r border-gray-200 pr-4 h-full">
          <Image
            src={officer?.profileUrl || "https://cdn-icons-png.flaticon.com/128/18775/18775921.png"}
            alt="Officer"
            width={56}
            height={56}
            className="rounded-full object-cover"
          />
          <div className="textarea-xs font-semibold text-gray-500 leading-tight text-center">
            {officer
              ? `${officer.name.split(" ").slice(1).join(" ")} (${officer.department})`
              : "ไม่ทราบชื่อเจ้าหน้าที่"}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm text-gray-700">
          <div className="flex justify-between">
            <div className="text-xs text-gray-900">วันที่รับแจ้ง</div>
            <div className="text-xs text-gray-900 font-semibold">
              {assignedDate ? new Date(assignedDate).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) + " น." : "-"}
            </div>
          </div>
          <div className="flex justify-between">
            <div className="text-xs text-gray-900">วันที่ดำเนินการสำเร็จ</div>
            <div className="text-xs text-gray-900 font-semibold">
              {completedDate ? new Date(completedDate).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) + " น." : "-"}
            </div>
          </div>
          <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
            <button className="btn btn-outline btn-error btn-sm btn-disabled text-red-400">
              <AlertCircle className="w-4 h-4" /> รายงาน
            </button>
            <button className="btn btn-info btn-sm text-white">
              <MessageCircleHeart className="w-6 h-6 text-white" /> ประเมินความพึงพอใจ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
