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
    fetchProblemOptions();
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
    const fetchAssignment = async () => {
      try {
        const res = await fetch(
          `/api/assignments/by-complaint?complaintId=${complaintMongoId}`
        );
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          console.log("Fetched assignment data:", json.data[0]);
          setAssignment(json.data[0]);
        }
      } catch (error) {
        console.error("Error fetching assignment:", error);
      }
    };
    fetchAssignment();
  }, [complaintMongoId]);

  return (
    <div className="bg-white shadow-md rounded-2xl p-4 border border-green-300 space-y-2">
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
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          วันที่สำเร็จ: {new Date(updatedAt).toLocaleString("th-TH")}
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
      <figure className="diff aspect-video w-full">
        {beforeImage && (
          <div className="diff-item-1">
            <img
              src={beforeImage}
              alt="ก่อนดำเนินการ"
              className="object-cover w-full h-full rounded-lg"
            />
          </div>
        )}
        {assignment?.solutionImages?.[0] && (
          <div className="diff-item-2">
            <img
              src={assignment.solutionImages[0]}
              alt="หลังดำเนินการ"
              className="object-cover w-full h-full rounded-lg"
            />
          </div>
        )}
        <div className="diff-resizer"></div>
      </figure>
      
    </div>
  );
};

export default CompletedCard;
