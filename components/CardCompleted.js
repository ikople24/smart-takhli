import { CircleCheck } from "lucide-react";
import ReactCompareImage from 'react-compare-image';
import { useMemo } from "react";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { useEffect, useState } from "react";

/* eslint-disable @next/next/no-img-element */

const CompletedCard = ({
  complaintMongoId,
  complaintId,
  title,
  description,
  timestamp,
  beforeImage,
  afterImage,
  problems,
  updatedAt,
}) => {
  const { menu, fetchMenu } = useMenuStore();
  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);
  const { fetchProblemOptions } = useProblemOptionStore();
  const { problemOptions } = useProblemOptionStore();
  const [activeIcons, setActiveIcons] = useState([]);
  const [assignment, setAssignment] = useState(null);

  console.log("CompletedCard props:", {
    complaintMongoId,
    complaintId,
    title,
    description,
    timestamp,
    beforeImage,
    afterImage,
    problems,
  });

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
    console.log("All problemOptions:", problemOptions);
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

useEffect(() => {
  let isMounted = true;
  const fetchAssignment = async () => {
    try {
      const res = await fetch(
        `/api/assignments/by-complaint?complaintId=${complaintMongoId}`
      );
      const json = await res.json();
      if (isMounted && json.success && json.data.length > 0) {
        console.log("Fetched assignment data:", json.data[0]);
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
}, [complaintMongoId]);

  return (
    <div className="bg-white shadow-md rounded-2xl p-4 border border-green-300 space-y-2 max-h-[90vh] overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {menu
            ?.filter((item) => item.Prob_name === title)
            .map((item, index) => (
              <img
                key={index}
                src={item.Prob_pic}
                alt={item.Prob_name}
                className="w-10 h-10 object-contain"
              />
            ))}
          <h2 className="text-lg font-semibold text-gray-800">
            {title}
          </h2>
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          วันที่สำเร็จ: {new Date(assignment?.completedAt || updatedAt).toLocaleDateString("th-TH")}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeIcons.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm"
          >
            {item.iconUrl && (
              <img
                src={item.iconUrl}
                alt={item.label}
                className="w-5 h-5 object-contain"
              />
            )}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      {useMemo(() => {
        if (beforeImage && assignment?.solutionImages?.[0]) {
          return (
            <div
              className="relative my-2 max-w-full h-[180px] sm:h-[220px] mx-auto pointer-events-auto z-10 overflow-hidden rounded-lg border border-green-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-2 left-2 z-20 bg-black bg-opacity-50 text-white px-2 py-0.5 rounded text-xs">
                ก่อนดำเนินการ
              </div>
              <div className="absolute top-2 right-2 z-20 bg-black bg-opacity-50 text-white px-2 py-0.5 rounded text-xs">
                หลังดำเนินการ
              </div>
              <ReactCompareImage
                leftImage={beforeImage}
                rightImage={assignment.solutionImages[0]}
                handle={<div />}  // ซ่อนปุ่มเลื่อน
                sliderLineWidth={2}
                sliderPositionPercentage={0.5}
              />
            </div>
          );
        }
        return null;
      }, [beforeImage, assignment?.solutionImages])}
      <div className="flex justify-end mt-2">
        <div className="inline-flex items-center gap-1 border border-green-500 text-green-600 px-3 py-1 rounded-full text-xs">
          <CircleCheck size={14} className="text-green-500" />
          ดำเนินการเสร็จสิ้น
        </div>
      </div>
    </div>
  );
};

export default CompletedCard;
