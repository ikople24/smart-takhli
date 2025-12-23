//pages/complaint/index.jsx
import Head from "next/head";
import { useEffect, useState } from "react";
import useComplaintStore from "@/stores/useComplaintStore";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/autoplay";
import "swiper/css/pagination";
import { Autoplay, Pagination } from "swiper/modules";
import CardModalDetail from "@/components/CardModalDetail";
import { Clock, CheckCircle2, FileText, UserCheck, MapPin, Calendar } from "lucide-react";

// Step indicator component
const StepIndicator = ({ status, assignedDate, completedDate }) => {
  const steps = [
    { id: 1, label: "รับเรื่อง", icon: FileText },
    { id: 2, label: "มอบหมาย", icon: UserCheck },
    { id: 3, label: "ดำเนินการ", icon: Clock },
    { id: 4, label: "เสร็จสิ้น", icon: CheckCircle2 },
  ];

  // Determine current step based on status
  let currentStep = 1;
  if (status === "อยู่ระหว่างดำเนินการ") {
    currentStep = assignedDate ? 3 : 2;
  } else if (status === "ดำเนินการเสร็จสิ้น") {
    currentStep = 4;
  }

  return (
    <div className="flex items-center justify-center w-full px-2 py-3">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.id <= currentStep;
        const isCurrent = step.id === currentStep;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center min-w-[50px]">
              <div
                className={`
                  w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300
                  ${isCurrent 
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-110" 
                    : isActive 
                      ? "bg-green-500 text-white" 
                      : "bg-gray-200 text-gray-400"
                  }
                `}
              >
                <Icon size={12} className="sm:w-[14px] sm:h-[14px]" strokeWidth={2.5} />
              </div>
              <span className={`text-[9px] sm:text-[10px] mt-1 font-medium whitespace-nowrap ${isCurrent ? "text-blue-600" : isActive ? "text-green-600" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 rounded-full transition-all duration-300 ${step.id < currentStep ? "bg-green-400" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function ComplaintListPage() {
  const { complaints, fetchComplaints } = useComplaintStore();
  const { menu, fetchMenu } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState(null);
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    const loadData = async () => {
      console.log("📤 เรียก API /api/complaints...");
      await fetchComplaints("อยู่ระหว่างดำเนินการ");
      await fetchProblemOptions();
      console.log("✅ ดึง complaints เสร็จ");
      setLoading(false);
    };
    loadData();
    fetchMenu();
  }, [fetchComplaints, fetchMenu, fetchProblemOptions]);

  // Fetch assignments for all complaints
  useEffect(() => {
    const fetchAllAssignments = async () => {
      try {
        const res = await fetch("/api/assignments");
        const data = await res.json();
        const assignmentMap = {};
        data.forEach((a) => {
          if (a.complaintId) {
            assignmentMap[a.complaintId] = a;
          }
        });
        setAssignments(assignmentMap);
      } catch (error) {
        console.error("Failed to fetch assignments:", error);
      }
    };
    fetchAllAssignments();
  }, []);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  return (
    <>
      <Head>
        <title>Smart-Takhli | รายการร้องเรียน</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-100 pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex flex-col items-center justify-center text-center">
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                มีเรื่องอยู่ระหว่างดำเนินการ
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                  {complaints.length} รายการ
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileText size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-500">ไม่มีรายการร้องเรียน</p>
            </div>
          ) : (
            complaints
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((item) => {
                const assignment = assignments[item._id];
                const categoryIcon = menu.find((m) => m.Prob_name === item.category)?.Prob_pic;
                
                return (
                  <div
                    key={item._id}
                    onClick={() => setModalData(item)}
                    className="group cursor-pointer"
                  >
                    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1">
                      {/* Image Section */}
                      <div className="relative h-48 overflow-hidden">
                        {item.images?.length >= 1 ? (
                          item.images.length === 1 ? (
                            <img
                              src={item.images[0]}
                              alt="ภาพร้องเรียน"
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <Swiper
                              modules={[Autoplay, Pagination]}
                              autoplay={{
                                delay: 4000,
                                disableOnInteraction: false,
                                pauseOnMouseEnter: true,
                              }}
                              pagination={{
                                clickable: true,
                                bulletClass: "swiper-pagination-bullet !bg-white/60 !w-2 !h-2",
                                bulletActiveClass: "swiper-pagination-bullet-active !bg-white !w-4",
                              }}
                              loop={true}
                              spaceBetween={0}
                              slidesPerView={1}
                              className="w-full h-full"
                            >
                              {item.images.map((imgUrl, index) => (
                                <SwiperSlide key={index}>
                                  <img
                                    src={imgUrl}
                                    alt={`ภาพที่ ${index + 1}`}
                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                  />
                                </SwiperSlide>
                              ))}
                            </Swiper>
                          )
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                            {categoryIcon ? (
                              <img src={categoryIcon} alt={item.category} className="w-16 h-16 object-contain opacity-50" />
                            ) : (
                              <FileText size={48} className="text-slate-500" />
                            )}
                          </div>
                        )}
                        
                        {/* Gradient Overlay - ทำให้เข้มขึ้นเพื่อให้ข้อความเห็นชัด */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                        
                        {/* Date Badge - แสดงเสมอถ้ามีวันที่ */}
                        {item.createdAt && (
                          <div className="absolute top-3 right-3 z-10">
                            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-md">
                              <Calendar size={12} className="text-blue-600" />
                              <span className="text-xs font-semibold text-gray-700">
                                {formatDate(item.createdAt)}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Category & Location - แสดงเสมอ */}
                        <div className="absolute bottom-3 left-3 right-3 z-10">
                          <div className="flex items-center gap-2 sm:gap-3">
                            {/* Icon Box - ลด padding เพิ่มขนาดรูป */}
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-xl p-1 shadow-lg flex-shrink-0">
                              {categoryIcon ? (
                                <img
                                  src={categoryIcon}
                                  alt={item.category}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                                  <FileText size={20} className="sm:w-[22px] sm:h-[22px] text-blue-500" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-white font-bold text-base drop-shadow-lg truncate">
                                {item.category || "ไม่ระบุหมวดหมู่"}
                              </h3>
                              <div className="flex items-center gap-1">
                                <MapPin size={12} className="text-yellow-400 flex-shrink-0" />
                                <span className="text-white/90 text-xs drop-shadow truncate">
                                  {item.community || "ไม่ระบุพื้นที่"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Content Section */}
                      <div className="p-4">
                        {/* Problems Tags */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {item.problems?.slice(0, 3).map((prob, i) => {
                            // ทำให้การจับคู่ยืดหยุ่นมากขึ้น - trim และเปรียบเทียบแบบ case-insensitive
                            const probTrimmed = (prob || "").trim().toLowerCase();
                            const found = problemOptions.find((opt) => {
                              const labelTrimmed = (opt.label || "").trim().toLowerCase();
                              return labelTrimmed === probTrimmed || 
                                     labelTrimmed.includes(probTrimmed) || 
                                     probTrimmed.includes(labelTrimmed);
                            });
                            
                            return (
                              <div
                                key={i}
                                className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg"
                              >
                                {found?.iconUrl ? (
                                  <img
                                    src={found.iconUrl}
                                    alt={prob}
                                    className="w-3.5 h-3.5 object-contain"
                                  />
                                ) : (
                                  <span className="w-3.5 h-3.5 bg-blue-200 rounded-full flex items-center justify-center text-[8px] text-blue-600">•</span>
                                )}
                                <span className="text-xs text-blue-700 font-medium">{prob}</span>
                              </div>
                            );
                          })}
                          {item.problems?.length > 3 && (
                            <span className="text-xs text-gray-400 self-center">
                              +{item.problems.length - 3} อื่นๆ
                            </span>
                          )}
                        </div>

                        {/* Detail Preview */}
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {item.detail}
                        </p>

                        {/* Step Indicator */}
                        <div className="bg-gray-50 rounded-xl -mx-1 mt-2">
                          <StepIndicator 
                            status={item.status}
                            assignedDate={assignment?.assignedAt}
                            completedDate={assignment?.completedAt}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Modal */}
        <CardModalDetail
          modalData={modalData}
          onClose={() => setModalData(null)}
        />
      </div>
    </>
  );
}
