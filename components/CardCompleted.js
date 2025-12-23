import { CircleCheck, Clock } from "lucide-react";
import ReactCompareImage from 'react-compare-image';
import { useMemo } from "react";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { useEffect, useState } from "react";

/* eslint-disable @next/next/no-img-element */

const CompletedCard = ({
  complaintMongoId,
  title,
  timestamp,
  beforeImage,
  afterImage,
  problems,
  updatedAt,
  assignment: propAssignment, // รับ assignment จาก prop แทนการ fetch เอง
}) => {
  const { menu, fetchMenu } = useMenuStore();
  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);
  const { fetchProblemOptions } = useProblemOptionStore();
  const { problemOptions } = useProblemOptionStore();
  const [activeIcons, setActiveIcons] = useState([]);
  const [assignment, setAssignment] = useState(propAssignment || null);

  // อัปเดต assignment เมื่อ prop เปลี่ยน
  useEffect(() => {
    if (propAssignment) {
      setAssignment(propAssignment);
    }
  }, [propAssignment]);

  useEffect(() => {
    let isMounted = true;
    fetchProblemOptions().then(() => {
      if (!isMounted) return;
    });
    return () => {
      isMounted = false;
    };
  }, [fetchProblemOptions]);

  useEffect(() => {
    if (Array.isArray(problems)) {
      const mapped = problems.map((problem) => {
        const found = problemOptions?.find(
          (p) => p?.label?.trim() === problem?.trim()
        );
        return {
          label: found?.label ?? problem,
          iconUrl: found?.iconUrl ?? "",
        };
      });
      setActiveIcons(mapped);
    }
  }, [problems, problemOptions]);

  // Fetch assignment เฉพาะเมื่อไม่มี prop assignment (fallback สำหรับ backward compatibility)
  useEffect(() => {
    if (propAssignment) return; // ถ้ามี prop แล้วไม่ต้อง fetch
    
    let isMounted = true;
    const fetchAssignment = async () => {
      try {
        const res = await fetch(
          `/api/assignments/by-complaint?complaintId=${complaintMongoId}`
        );
        const json = await res.json();
        if (isMounted && json.success && json.data.length > 0) {
          setAssignment(json.data[0]);
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
      }
    };
    fetchAssignment();
    return () => {
      isMounted = false;
    };
  }, [complaintMongoId, propAssignment]);

  // Get menu icon for the category
  const menuIcon = menu?.find((item) => item.Prob_name === title)?.Prob_pic;

  // Get completion date
  const completionDate = assignment?.completedAt || updatedAt || timestamp;

  // Calculate processing time
  const processingTime = useMemo(() => {
    if (!timestamp || !completionDate) return null;
    
    // ใช้การคำนวณเดียวกับหน้า status
    const startDate = new Date(timestamp);
    const endDate = new Date(completionDate);
    const diffMs = Math.abs(endDate - startDate); // ใช้ค่าสัมบูรณ์เพื่อป้องกันค่าติดลบ
    const processingTimeHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(processingTimeHours / 24);
    const remainingHours = processingTimeHours % 24;
    
    if (processingTimeHours < 24) {
      return { value: processingTimeHours, unit: 'ชั่วโมง', hours: processingTimeHours, display: `${processingTimeHours} ชม.` };
    } else if (remainingHours > 0) {
      return { value: diffDays, unit: 'วัน', hours: processingTimeHours, display: `${diffDays} วัน ${remainingHours} ชม.` };
    } else {
      return { value: diffDays, unit: 'วัน', hours: processingTimeHours, display: `${diffDays} วัน` };
    }
  }, [timestamp, completionDate]);

  // Get time badge color based on processing time - ใช้การคำนวณเดียวกับตัวกรอง
  const getTimeBadgeColor = (hours) => {
    if (hours <= 24) {
      return 'bg-green-50 text-green-700 border-green-300';
    } else if (hours > 24 && hours <= 48) {
      return 'bg-blue-50 text-blue-700 border-blue-300';
    } else if (hours > 48 && hours <= 72) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-300';
    } else if (hours > 72 && hours <= 168) {
      return 'bg-yellow-50 text-yellow-700 border-yellow-300';
    } else if (hours > 168 && hours <= 360) {
      return 'bg-orange-50 text-orange-700 border-orange-300';
    } else {
      return 'bg-red-50 text-red-700 border-red-300';
    }
  };

  // Get time range label - ใช้การคำนวณเดียวกับตัวกรอง
  const getTimeRangeLabel = (hours) => {
    if (hours <= 24) {
      return 'ภายใน 24 ชม.';
    } else if (hours > 24 && hours <= 48) {
      return '1-2 วัน';
    } else if (hours > 48 && hours <= 72) {
      return '2-3 วัน';
    } else if (hours > 72 && hours <= 168) {
      return '3-7 วัน';
    } else if (hours > 168 && hours <= 360) {
      return '7-15 วัน';
    } else {
      return 'เกิน 15 วัน';
    }
  };

  return (
    <div className="bg-white shadow-lg rounded-xl p-4 border border-green-200 space-y-3 hover:shadow-xl transition-shadow duration-200">
      {/* Header with title and completion date */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {menuIcon && (
            <img
              src={menuIcon}
              alt={title}
              className="w-8 h-8 object-contain"
            />
          )}
          <h2 className="text-lg font-semibold text-gray-800">
            {title}
          </h2>
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          วันที่สำเร็จ: {completionDate ? new Date(completionDate).toLocaleDateString("th-TH") : "ไม่ระบุ"}
        </div>
      </div>

      {/* Processing Time Badge */}
      {processingTime && (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getTimeBadgeColor(processingTime.hours)}`}>
          <Clock size={14} />
          <span>{getTimeRangeLabel(processingTime.hours)}</span>
          <span className="text-xs opacity-75">
            ({processingTime.display})
          </span>
        </div>
      )}

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {activeIcons.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm border border-blue-200"
          >
            {item.iconUrl && (
              <img
                src={item.iconUrl}
                alt={item.label}
                className="w-4 h-4 object-contain"
              />
            )}
            <span className="font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Before/After Images */}
      {useMemo(() => {
        const beforeImg = beforeImage;
        const afterImg = assignment?.solutionImages?.[0] || afterImage;
        
        if (beforeImg && afterImg) {
          return (
            <div className="relative my-3 max-w-full h-[200px] mx-auto pointer-events-auto z-10 overflow-hidden rounded-lg border border-gray-200">
              <div className="absolute top-2 left-2 z-20 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-xs font-medium">
                ก่อนดำเนินการ
              </div>
              <div className="absolute top-2 right-2 z-20 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-xs font-medium">
                หลังดำเนินการ
              </div>
              <ReactCompareImage
                leftImage={beforeImg}
                rightImage={afterImg}
                handle={<div className="w-1 h-8 bg-white rounded-full shadow-lg" />}
                sliderLineWidth={2}
                sliderLineColor="#ffffff"
                sliderPositionPercentage={0.5}
              />
            </div>
          );
        } else if (beforeImg) {
          return (
            <div className="relative my-3 max-w-full h-[200px] mx-auto overflow-hidden rounded-lg border border-gray-200">
              <div className="absolute top-2 left-2 z-20 bg-black bg-opacity-70 text-white px-3 py-1 rounded text-xs font-medium">
                รูปภาพปัญหา
              </div>
              <img
                src={beforeImg}
                alt="Before"
                className="w-full h-full object-cover"
              />
            </div>
          );
        }
        return null;
      }, [beforeImage, assignment?.solutionImages, afterImage])}

      {/* Completion Status */}
      <div className="flex justify-end mt-3">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-300 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
          <CircleCheck size={16} className="text-green-600" />
          ดำเนินการเสร็จสิ้น
        </div>
      </div>
    </div>
  );
};

export default CompletedCard;

