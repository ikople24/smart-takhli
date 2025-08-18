import React, { useEffect, useState } from "react";
import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { useAdminOptionsStore } from "@/stores/useAdminOptionsStore";

export default function CardAssignment({ probId }) {
  const [assignment, setAssignment] = useState(null);
  const adminOptions = useAdminOptionsStore((state) => state.adminOptions);
  const fetchAdminOptions = useAdminOptionsStore.getState().fetchAdminOptions;
  
  useEffect(() => {
    fetchAdminOptions(); // ดึงข้อมูลทันทีเมื่อโหลด component
  }, [fetchAdminOptions]);

  // debug: console.log("🧠 all adminOptions from store:", adminOptions);
  const matchedOptions =
    Array.isArray(assignment?.solution) && assignment.solution.length > 0
      ? adminOptions.filter((opt) =>
          assignment.solution.includes(opt.label)
        )
      : adminOptions.filter(
          (opt) =>
            typeof opt.label === "string" &&
            typeof assignment?.solution === "string" &&
            opt.label.trim() === assignment.solution.trim()
        );
  // debug: console.log(
  //   "🔍 matchedOptions:",
  //   matchedOptions,
  //   "assignment.solution:",
  //   assignment?.solution
  // );
  if (!matchedOptions || matchedOptions.length === 0) {
    // debug: console.warn(
    //   "⚠️ No match found for solution:",
    //   assignment?.solution,
    //   "in options:",
    //   adminOptions.map((o) => o.label)
    // );
  }
  const [currentIndex, setCurrentIndex] = useState(0); // currentIndex is used for image display

  const handlePrev = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? assignment.solutionImages.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === assignment.solutionImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  useEffect(() => {
    async function fetchAssignment() {
      try {
        const res = await fetch(
          `/api/assignments/by-complaint?complaintId=${probId}`
        );
        const data = await res.json();
        console.log("📦 assignment data:", data);
        setAssignment(data.data?.[0]);
      } catch (error) {
        console.error("Failed to fetch assignment:", error);
      }
    }

    if (probId) {
      fetchAssignment();
    }
  }, [probId]);



  if (
    !assignment ||
    (
      (!assignment.solution ||
        (Array.isArray(assignment.solution) &&
          assignment.solution.every((s) => !s || (typeof s === "string" && s.trim() === ""))) ||
        (typeof assignment.solution === "string" && assignment.solution.trim() === "")) &&
      (!assignment.note || (typeof assignment.note === "string" && assignment.note.trim() === ""))
    )
  ) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-md p-[6px]">
      <div className="flex flex-col justify-between space-y-4">

        {/* วิธีดำเนินการ Section */}
        {Array.isArray(assignment?.solutionImages) && assignment.solutionImages.length > 0 && (
          <div>
            <h2 className="text-md font-semibold mb-4">การดำเนินการ</h2>
            <div className="relative">
              <Image
                src={assignment?.solutionImages?.[currentIndex] ?? ""}
                alt={`Main Image ${currentIndex + 1}`}
                width={800}
                height={400}
                className="w-full h-64 object-cover rounded-t-md transition-all duration-500"
              />
              {assignment?.solutionImages?.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="absolute top-1/2 left-3 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
                  >
                    ‹
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute top-1/2 right-3 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* เจ้าหน้าที่ Section */}
        <div className="grid grid-cols-5 gap-4 items-start h-full">
          <div className="col-span-3 pr-6 border-r border-gray-300 h-full">
            <div className="text-md font-semibold mb-4">
              วิธีดำเนินการ (ทั้งหมด)
            </div>
            <div className="space-y-3">
              {matchedOptions.map((opt) => (
                <div key={opt.label} className="flex flex-col-2 justify-between items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src={opt.icon_url || "/check-icon.png"}
                      alt="icon"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                    <span className="text-sm text-gray-800">{opt.label}</span>
                  </div>
                  <BadgeCheck className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-md font-semibold mb-2">บันทึกเจ้าหน้าที่</div>
            <div className="bg-green-200 border border-green-200 rounded-md p-4 text-green-800 text-sm">
              <p>{assignment?.note}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
