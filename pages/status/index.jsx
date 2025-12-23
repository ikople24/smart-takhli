//page/status/index.jsx
import Head from "next/head";
import CardModalDetail from "@/components/CardModalDetail";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { Clock, CheckCircle2, FileText, MapPin, Calendar, Zap, Trophy } from "lucide-react";
import ReactCompareImage from 'react-compare-image';

const StatusPage = () => {
  const { menu, fetchMenu } = useMenuStore();
  const { problemOptions, fetchProblemOptions } = useProblemOptionStore();
  
  // State สำหรับ complaints และ pagination
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all');
  const itemsPerPage = 10;
  const [modalData, setModalData] = useState(null);
  const [assignments, setAssignments] = useState({});

  // คำนวณปีงบประมาณปัจจุบัน
  const getCurrentFiscalYear = useCallback(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return currentMonth >= 9 ? currentYear + 1 + 543 : currentYear + 543;
  }, []);

  const fiscalYear = getCurrentFiscalYear();

  // Fetch complaints with pagination (server-side)
  const fetchComplaints = useCallback(async (page = 1, append = false) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        status: "ดำเนินการเสร็จสิ้น",
        page: page.toString(),
        limit: itemsPerPage.toString(),
        sortField: "createdAt",
        sortOrder: "desc",
        currentFiscalYear: "true",
        withCount: "true"
      });

      const res = await fetch(`/api/complaints?${params}`);
      const json = await res.json();

      if (json.success) {
        if (append) {
          setComplaints(prev => [...prev, ...json.data]);
        } else {
          setComplaints(json.data);
        }
        setTotalPages(json.pagination.totalPages);
        setTotalItems(json.pagination.total);
        setCurrentPage(page);

        // Fetch assignments สำหรับ complaints ที่ดึงมา
        if (json.data.length > 0) {
          fetchAssignmentsForComplaints(json.data.map(c => c._id));
        }
      }
    } catch (error) {
      console.error("Error fetching complaints:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [itemsPerPage]);

  // Fetch assignments แบบ batch
  const fetchAssignmentsForComplaints = async (complaintIds) => {
    try {
      const res = await fetch("/api/assignments/by-complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintIds }),
      });
      const json = await res.json();
      
      if (json.success) {
        setAssignments(prev => ({ ...prev, ...json.data }));
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchComplaints(1);
    fetchMenu();
    fetchProblemOptions();
  }, [fetchComplaints, fetchMenu, fetchProblemOptions]);

  // กรองข้อมูลตามเวลาดำเนินการ (client-side filter)
  const filteredComplaints = useMemo(() => {
    if (selectedTimeFilter === 'all') {
      return complaints;
    }
    
    return complaints.filter(complaint => {
      const startDate = new Date(complaint.createdAt);
      const assignment = assignments[complaint._id];
      const completionDate = new Date(
        assignment?.completedAt || complaint.completedAt || complaint.updatedAt || complaint.createdAt
      );
      
      const processingTimeHours = Math.floor(Math.abs(completionDate - startDate) / (1000 * 60 * 60));
      
      switch (selectedTimeFilter) {
        case '24h':
          return processingTimeHours <= 24;
        case '2d':
          return processingTimeHours > 24 && processingTimeHours <= 48;
        case '3d':
          return processingTimeHours > 48 && processingTimeHours <= 72;
        case '7d':
          return processingTimeHours > 72 && processingTimeHours <= 168;
        case '15d':
          return processingTimeHours > 168 && processingTimeHours <= 360;
        case 'over15d':
          return processingTimeHours > 360;
        default:
          return true;
      }
    });
  }, [complaints, selectedTimeFilter, assignments]);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && !isLoadingMore) {
      fetchComplaints(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  // Get time badge styling based on processing hours
  const getTimeBadgeStyle = (hours) => {
    if (hours <= 24) return { bg: "bg-emerald-500", text: "ภายใน 24 ชม.", icon: "⚡" };
    if (hours <= 48) return { bg: "bg-green-500", text: "1-2 วัน", icon: "✨" };
    if (hours <= 72) return { bg: "bg-blue-500", text: "2-3 วัน", icon: "🎯" };
    if (hours <= 168) return { bg: "bg-indigo-500", text: "3-7 วัน", icon: "📋" };
    if (hours <= 360) return { bg: "bg-amber-500", text: "7-15 วัน", icon: "⏳" };
    return { bg: "bg-orange-500", text: "เกิน 15 วัน", icon: "📅" };
  };

  // Calculate processing time for a complaint
  const getProcessingTime = (complaint) => {
    const startDate = new Date(complaint.createdAt);
    const assignment = assignments[complaint._id];
    const completionDate = new Date(
      assignment?.completedAt || complaint.completedAt || complaint.updatedAt || complaint.createdAt
    );
    const diffMs = Math.abs(completionDate - startDate);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    return {
      hours,
      days,
      remainingHours,
      display: hours < 24 ? `${hours} ชม.` : (remainingHours > 0 ? `${days} วัน ${remainingHours} ชม.` : `${days} วัน`)
    };
  };

  // Time filter options
  const timeFilters = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: '24h', label: 'ภายใน 24 ชม.' },
    { id: '2d', label: '1-2 วัน' },
    { id: '3d', label: '2-3 วัน' },
    { id: '7d', label: '3-7 วัน' },
    { id: '15d', label: '7-15 วัน' },
    { id: 'over15d', label: 'เกิน 15 วัน' },
  ];

  return (
    <>
      <Head>
        <title>Smart-Takhli | ดำเนินการเสร็จสิ้น</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-green-50/30 to-slate-100 pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                  <CheckCircle2 size={18} className="text-white" />
                </div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  ดำเนินการเสร็จสิ้น
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                  {selectedTimeFilter === 'all' ? totalItems : filteredComplaints.length} รายการ
                </div>
                <div className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-xs font-medium border border-amber-200">
                  📅 ปีงบฯ {fiscalYear}
                </div>
                {isLoadingMore && (
                  <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Time Filter Pills */}
        <div className="sticky top-[68px] z-30 bg-white/60 backdrop-blur-lg border-b border-gray-100">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex flex-wrap justify-center gap-2">
              {timeFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedTimeFilter(filter.id)}
                  className={`
                    flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200
                    ${selectedTimeFilter === filter.id
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md shadow-green-500/30"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-green-300 hover:bg-green-50"
                    }
                  `}
                >
                  {filter.id !== 'all' && <Zap size={12} />}
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mb-4">
                <Trophy size={32} className="text-green-400" />
              </div>
              <p className="text-gray-500 font-medium">
                {selectedTimeFilter === 'all' ? "ยังไม่มีรายการที่เสร็จสิ้น" : "ไม่พบรายการในช่วงเวลาที่เลือก"}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {selectedTimeFilter === 'all' 
                  ? "รายการที่ได้รับการแก้ไขจะแสดงที่นี่"
                  : "ลองเลือกช่วงเวลาอื่น"
                }
              </p>
            </div>
          ) : (
            filteredComplaints.map((item) => {
              const assignment = assignments[item._id];
              const categoryIcon = menu?.find((m) => m.Prob_name === item.category)?.Prob_pic;
              const processingTime = getProcessingTime(item);
              const timeStyle = getTimeBadgeStyle(processingTime.hours);
              const beforeImg = item.images?.[0];
              const afterImg = assignment?.solutionImages?.[0] || item.images?.[1];
              
              return (
                <div
                  key={item._id}
                  onClick={() => setModalData(item)}
                  className="group cursor-pointer"
                >
                  <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-green-100 hover:border-green-300 transform hover:-translate-y-1">
                    {/* Image Section */}
                    <div className="relative h-52 overflow-hidden">
                      {beforeImg && afterImg ? (
                        // Before/After Compare View
                        <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
                          <ReactCompareImage
                            leftImage={beforeImg}
                            rightImage={afterImg}
                            handle={<div className="w-1 h-10 bg-white rounded-full shadow-lg" />}
                            sliderLineWidth={2}
                            sliderLineColor="#ffffff"
                            sliderPositionPercentage={0.5}
                          />
                          <div className="absolute top-12 left-2 z-20 bg-black/70 text-white px-2 py-1 rounded text-[10px] font-medium">
                            ก่อน
                          </div>
                          <div className="absolute top-12 right-2 z-20 bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-medium">
                            หลัง
                          </div>
                        </div>
                      ) : beforeImg ? (
                        // Single image
                        <img
                          src={beforeImg}
                          alt="ภาพปัญหา"
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        // Placeholder
                        <div className="w-full h-full bg-gradient-to-br from-emerald-700 to-green-800 flex items-center justify-center">
                          {categoryIcon ? (
                            <img src={categoryIcon} alt={item.category} className="w-16 h-16 object-contain opacity-50" />
                          ) : (
                            <FileText size={48} className="text-emerald-500" />
                          )}
                        </div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                      
                      {/* Success Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <div className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-full shadow-md">
                          <CheckCircle2 size={12} />
                          <span className="text-[10px] font-semibold">เสร็จสิ้น</span>
                        </div>
                      </div>
                      
                      {/* Date Badge */}
                      {item.createdAt && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-md">
                            <Calendar size={12} className="text-green-600" />
                            <span className="text-xs font-semibold text-gray-700">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Category & Location */}
                      <div className="absolute bottom-3 left-3 right-3 z-10">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {/* Icon Box */}
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-xl p-1 shadow-lg flex-shrink-0">
                            {categoryIcon ? (
                              <img
                                src={categoryIcon}
                                alt={item.category}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
                                <FileText size={20} className="sm:w-[22px] sm:h-[22px] text-green-500" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-white font-bold text-base drop-shadow-lg truncate">
                              {item.category || "ไม่ระบุหมวดหมู่"}
                            </h3>
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="text-emerald-400 flex-shrink-0" />
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
                      {/* Processing Time Badge */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`flex items-center gap-1.5 ${timeStyle.bg} text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-sm`}>
                          <Clock size={12} />
                          <span>{timeStyle.text}</span>
                          <span className="opacity-80">({processingTime.display})</span>
                        </div>
                      </div>

                      {/* Problems Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.problems?.slice(0, 3).map((prob, i) => {
                          const probTrimmed = (prob || "").trim().toLowerCase();
                          const found = problemOptions?.find((opt) => {
                            const labelTrimmed = (opt.label || "").trim().toLowerCase();
                            return labelTrimmed === probTrimmed || 
                                   labelTrimmed.includes(probTrimmed) || 
                                   probTrimmed.includes(labelTrimmed);
                          });
                          
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg"
                            >
                              {found?.iconUrl ? (
                                <img
                                  src={found.iconUrl}
                                  alt={prob}
                                  className="w-3.5 h-3.5 object-contain"
                                />
                              ) : (
                                <span className="w-3.5 h-3.5 bg-green-200 rounded-full flex items-center justify-center text-[8px] text-green-600">•</span>
                              )}
                              <span className="text-xs text-green-700 font-medium">{prob}</span>
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
                      {item.detail && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && selectedTimeFilter === 'all' && (
            <div className="flex items-center justify-center gap-2 py-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoadingMore}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ก่อนหน้า
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isLoadingMore}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md"
                          : "bg-white border border-gray-200 hover:bg-gray-50"
                      } disabled:opacity-50`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoadingMore}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ถัดไป
              </button>
            </div>
          )}
          
          {/* Page info */}
          {!isLoading && totalPages > 1 && selectedTimeFilter === 'all' && (
            <div className="text-center text-xs text-gray-500 pb-2">
              หน้า {currentPage} จาก {totalPages} ({totalItems} รายการ)
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <CardModalDetail
        modalData={modalData}
        onClose={() => setModalData(null)}
      />
    </>
  );
};

export default StatusPage;
