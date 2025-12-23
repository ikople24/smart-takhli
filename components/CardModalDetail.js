import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useEffect, useState } from "react";
import { 
  X, 
  FileText, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  MapPin, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import Image from "next/image";
import CardOfficail from "./CardOfficail";
import CardAssignment from "./CardAssignment";
import SatisfactionChart from "./SatisfactionChart";

// Modern Step Timeline Component
const StepTimeline = ({ status, assignment }) => {
  const steps = [
    { 
      id: 1, 
      label: "รับเรื่องร้องเรียน", 
      icon: FileText,
      description: "ระบบได้รับเรื่องร้องเรียนของท่านแล้ว"
    },
    { 
      id: 2, 
      label: "มอบหมายเจ้าหน้าที่", 
      icon: UserCheck,
      description: "กำลังมอบหมายเจ้าหน้าที่รับผิดชอบ"
    },
    { 
      id: 3, 
      label: "ดำเนินการแก้ไข", 
      icon: Clock,
      description: "เจ้าหน้าที่กำลังดำเนินการแก้ไขปัญหา"
    },
    { 
      id: 4, 
      label: "ดำเนินการเสร็จสิ้น", 
      icon: CheckCircle2,
      description: "ดำเนินการแก้ไขปัญหาเรียบร้อยแล้ว"
    },
  ];

  // Determine current step based on status
  let currentStep = 1;
  const isAllCompleted = status === "ดำเนินการเสร็จสิ้น";
  
  if (status === "อยู่ระหว่างดำเนินการ") {
    currentStep = assignment?.assignedAt ? 3 : 2;
  } else if (isAllCompleted) {
    currentStep = 5; // เกินจำนวน step เพื่อให้ทุก step เป็นสีเขียว (completed)
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Sparkles size={16} className="text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-700">สถานะการดำเนินการ</h3>
      </div>
      
      <div className="relative pl-6">
        {/* Timeline Line */}
        <div className={`absolute left-[11px] top-2 bottom-2 w-0.5 ${isAllCompleted ? 'bg-green-300' : 'bg-gradient-to-b from-blue-200 via-blue-100 to-gray-200'}`} />
        
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCurrent = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isLastStep = index === steps.length - 1;
          const isLastStepCompleted = isLastStep && isAllCompleted;
          
          return (
            <div key={step.id} className={`relative flex gap-4 pb-6 ${isLastStep ? 'pb-0' : ''}`}>
              {/* Step Icon */}
              <div
                className={`
                  relative z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500
                  ${isLastStepCompleted
                    ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/40 ring-4 ring-green-100"
                    : isCurrent 
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/40 ring-4 ring-blue-100" 
                      : isCompleted 
                        ? "bg-green-500 text-white" 
                        : "bg-gray-200 text-gray-400"
                  }
                `}
              >
                {isCompleted || isLastStepCompleted ? (
                  <CheckCircle2 size={14} strokeWidth={3} />
                ) : (
                  <Icon size={12} strokeWidth={2.5} />
                )}
              </div>
              
              {/* Step Content */}
              <div className={`flex-1 ${(isCurrent || isLastStepCompleted) ? 'transform scale-[1.02]' : ''}`}>
                <div className={`
                  p-3 rounded-xl transition-all duration-300
                  ${isLastStepCompleted
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 shadow-sm'
                    : isCurrent 
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 shadow-sm' 
                      : isCompleted
                        ? 'bg-green-50 border border-green-100'
                        : 'bg-gray-50 border border-gray-100'
                  }
                `}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${
                      isLastStepCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                    {isLastStepCompleted && (
                      <span className="flex items-center gap-1 text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} />
                        เสร็จสิ้นแล้ว
                      </span>
                    )}
                    {isCurrent && !isLastStepCompleted && (
                      <span className="flex items-center gap-1 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                        <span className="w-1.5 h-1.5 bg-white rounded-full" />
                        กำลังดำเนินการ
                      </span>
                    )}
                    {isCompleted && !isLastStepCompleted && (
                      <CheckCircle2 size={14} className="text-green-500" />
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${
                    isLastStepCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function CardModalDetail({ modalData, onClose }) {
  const { menu } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();
  const [categoryIcon, setCategoryIcon] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [assignment, setAssignment] = useState(null);

  useEffect(() => {
    fetchProblemOptions();
  }, [fetchProblemOptions]);

  useEffect(() => {
    if (modalData?.category && menu?.length) {
      const matched = menu.find((m) => m.Prob_name === modalData.category);
      if (matched) {
        setCategoryIcon(matched.Prob_pic);
      }
    }
  }, [modalData, menu]);

  useEffect(() => {
    setPreviewImg(null);
    setCurrentSlide(0);
  }, [modalData]);

  // Fetch assignment for this complaint
  useEffect(() => {
    async function fetchAssignment() {
      if (modalData?._id) {
        try {
          const res = await fetch(`/api/assignments/by-complaint?complaintId=${modalData._id}`);
          const data = await res.json();
          setAssignment(data.data?.[0] || null);
        } catch (error) {
          console.error("Failed to fetch assignment:", error);
        }
      }
    }
    fetchAssignment();
  }, [modalData?._id]);

  if (!modalData) return null;

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + modalData.images.length) % modalData.images.length);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % modalData.images.length);
  };

  return (
    <>
      <Transition appear show={!!modalData} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-end md:items-center justify-center p-0 md:p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-full md:translate-y-4 md:scale-95"
                enterTo="opacity-100 translate-y-0 md:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 md:scale-100"
                leaveTo="opacity-0 translate-y-full md:translate-y-4 md:scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-t-3xl md:rounded-2xl bg-white shadow-2xl transition-all max-h-[95vh] md:max-h-[90vh] flex flex-col">
                  {/* Header Image Section */}
                  {modalData.images?.[0] && (
                    <div className="relative w-full h-56 flex-shrink-0">
                      {/* Close Button */}
                      <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all"
                      >
                        <X size={20} />
                      </button>

                      {/* Image Carousel */}
                      <div className="relative w-full h-full overflow-hidden">
                        {modalData.images.map((img, idx) => (
                          <div
                            key={idx}
                            className={`absolute inset-0 transition-all duration-500 ease-out ${
                              currentSlide === idx 
                                ? 'opacity-100 scale-100' 
                                : 'opacity-0 scale-105'
                            }`}
                          >
                            <Image
                              src={img}
                              alt={`slide-${idx}`}
                              fill
                              sizes="(max-width: 768px) 100vw, 500px"
                              className="object-cover"
                            />
                          </div>
                        ))}
                        
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        
                        {/* Navigation Arrows */}
                        {modalData.images.length > 1 && (
                          <>
                            <button
                              onClick={handlePrev}
                              className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all"
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <button
                              onClick={handleNext}
                              className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all"
                            >
                              <ChevronRight size={18} />
                            </button>
                            
                            {/* Dots Indicator */}
                            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
                              {modalData.images.map((_, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => setCurrentSlide(idx)}
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    currentSlide === idx 
                                      ? 'w-6 bg-white' 
                                      : 'w-1.5 bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        )}

                        {/* Zoom Button */}
                        <button
                          onClick={() => setPreviewImg(modalData.images[currentSlide])}
                          className="absolute bottom-20 right-3 z-10 w-8 h-8 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all"
                        >
                          <ZoomIn size={16} />
                        </button>
                      </div>

                      {/* Bottom Info Overlay */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                        <div className="flex items-end justify-between">
                          <div className="flex items-center gap-3">
                            {categoryIcon && (
                              <div className="w-12 h-12 bg-white rounded-xl p-1.5 shadow-lg">
                                <Image
                                  src={categoryIcon}
                                  alt="category icon"
                                  width={40}
                                  height={40}
                                  className="object-contain w-full h-full"
                                />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1 text-white/80 text-xs mb-0.5">
                                <MapPin size={12} className="text-yellow-400" />
                                <span>{modalData.community}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-white/70 text-xs flex items-center gap-1">
                                  <Calendar size={12} />
                                  {new Date(modalData.createdAt || modalData.updatedAt).toLocaleDateString("th-TH", {
                                    year: "2-digit",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className={`
                            px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm
                            ${modalData.status === "ดำเนินการเสร็จสิ้น" 
                              ? "bg-green-500/80 text-white" 
                              : "bg-yellow-500/80 text-white"
                            }
                          `}>
                            {modalData.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Complaint ID */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">เลขที่คำร้อง</span>
                        <span className="text-sm font-mono font-semibold text-gray-800 bg-white px-3 py-1 rounded-lg border">
                          {modalData.complaintId}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-5">
                      {/* Step Timeline */}
                      <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl p-4 border border-slate-100">
                        <StepTimeline status={modalData.status} assignment={assignment} />
                      </div>

                      {/* Problems Section */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <AlertTriangle size={14} className="text-amber-500" />
                          ปัญหาที่พบ
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {modalData.problems?.map((p, idx) => {
                            const cleanLabel = typeof p === "string" ? p.trim() : "";
                            // ทำให้การจับคู่ยืดหยุ่นมากขึ้น - เปรียบเทียบแบบ case-insensitive และ partial match
                            const cleanLabelLower = cleanLabel.toLowerCase();
                            const matched = problemOptions.find((opt) => {
                              const optLabel = (opt.label || "").trim().toLowerCase();
                              return optLabel === cleanLabelLower || 
                                     optLabel.includes(cleanLabelLower) || 
                                     cleanLabelLower.includes(optLabel);
                            });
                            return (
                              <div
                                key={idx}
                                className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-3 py-1.5 rounded-xl text-sm text-blue-700"
                              >
                                {matched?.iconUrl ? (
                                  <Image
                                    src={matched.iconUrl}
                                    alt={cleanLabel}
                                    width={16}
                                    height={16}
                                    className="object-contain"
                                  />
                                ) : (
                                  <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-[10px] text-blue-600">•</span>
                                )}
                                <span className="font-medium">{cleanLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detail Section */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <FileText size={14} className="text-blue-500" />
                          รายละเอียด
                        </h4>
                        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-4 text-sm text-gray-700 rounded-xl border border-amber-100 leading-relaxed">
                          {modalData.detail}
                        </div>
                      </div>

                      {/* Officer & Assignment Cards */}
                      <CardOfficail probId={modalData?._id} />
                      <CardAssignment probId={modalData?._id} />
                      <SatisfactionChart complaintId={modalData._id} />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                      onClick={() => {
                        setPreviewImg(null);
                        setCurrentSlide(0);
                        onClose();
                      }}
                      className="w-full py-3 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
                    >
                      ปิด
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Image Preview Modal */}
      <Transition appear show={!!previewImg} as={Fragment}>
        <Dialog as="div" className="relative z-[9999]" onClose={() => setPreviewImg(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-90"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-90"
              >
                <Dialog.Panel className="relative">
                  {previewImg && (
                    <Image
                      src={previewImg}
                      alt="Preview"
                      width={800}
                      height={600}
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-contain rounded-2xl shadow-2xl max-h-[85vh]"
                    />
                  )}
                  <button
                    onClick={() => setPreviewImg(null)}
                    className="absolute -top-3 -right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-all"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
