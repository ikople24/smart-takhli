import React, { useEffect, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Wrench, StickyNote, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useAdminOptionsStore } from "@/stores/useAdminOptionsStore";

export default function CardAssignment({ probId }) {
  const [assignment, setAssignment] = useState(null);
  const adminOptions = useAdminOptionsStore((state) => state.adminOptions);
  const fetchAdminOptions = useAdminOptionsStore.getState().fetchAdminOptions;
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    fetchAdminOptions();
  }, [fetchAdminOptions]);

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
    <div className="w-full space-y-4">
      {/* Solution Images Section */}
      {Array.isArray(assignment?.solutionImages) && assignment.solutionImages.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <ImageIcon size={16} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">ภาพการดำเนินการ</h3>
          </div>
          
          <div className="relative rounded-xl overflow-hidden">
            <div className="aspect-video relative">
              <Image
                src={assignment?.solutionImages?.[currentIndex] ?? ""}
                alt={`Solution Image ${currentIndex + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 500px"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              
              {/* Image Counter */}
              <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                {currentIndex + 1} / {assignment.solutionImages.length}
              </div>
            </div>
            
            {assignment?.solutionImages?.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute top-1/2 left-2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg transition-all"
                >
                  <ChevronLeft size={18} className="text-gray-700" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute top-1/2 right-2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg transition-all"
                >
                  <ChevronRight size={18} className="text-gray-700" />
                </button>
                
                {/* Dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {assignment.solutionImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        currentIndex === idx 
                          ? 'w-4 bg-white' 
                          : 'w-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Solutions & Notes Grid */}
      <div className="grid grid-cols-1 gap-4">
        {/* Solutions Section */}
        {matchedOptions.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border border-emerald-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                <Wrench size={16} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">วิธีดำเนินการ</h3>
            </div>
            
            <div className="space-y-2">
              {matchedOptions.map((opt, index) => (
                <div 
                  key={opt.label} 
                  className="flex items-center justify-between bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-emerald-100 hover:border-emerald-200 transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Image
                        src={opt.icon_url || "/check-icon.png"}
                        alt="icon"
                        width={20}
                        height={20}
                        className="object-contain"
                      />
                    </div>
                    <span className="text-sm text-gray-700 font-medium">{opt.label}</span>
                  </div>
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-sm">
                    <BadgeCheck size={14} className="text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {assignment?.note && assignment.note.trim() !== "" && (
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center">
                <StickyNote size={16} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-gray-800">บันทึกเจ้าหน้าที่</h3>
            </div>
            
            <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-amber-100">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {assignment?.note}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
