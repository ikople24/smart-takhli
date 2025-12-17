import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Plus,
  Search,
  Users,
  Trash2,
  X,
  Check,
  MapPin,
  User,
  Home,
  Eye,
  Navigation,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Map,
} from "lucide-react";
import Swal from "sweetalert2";

// Dynamic import for map component (ssr: false for leaflet)
const LocationPickerMap = dynamic(
  () => import("./LocationPickerMap"),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> }
);

// คำนำหน้าชื่อ
const TITLES = ["นาย", "นาง", "นางสาว"];

// กลุ่มข้อมูล
const DATA_GROUPS = [
  { value: "general", label: "ผู้สูงอายุทั่วไป", color: "bg-gray-100 text-gray-700" },
  { value: "elderly_98", label: "ผู้สูงอายุ 98 ปีขึ้นไป", color: "bg-purple-100 text-purple-700" },
  { value: "bedridden", label: "ผู้ป่วยติดเตียง", color: "bg-red-100 text-red-700" },
  { value: "disabled", label: "ผู้พิการ", color: "bg-orange-100 text-orange-700" },
  { value: "alone", label: "อยู่คนเดียว", color: "bg-blue-100 text-blue-700" },
];

// คำนวณอายุจากปี พ.ศ.
const calculateAge = (birthYear) => {
  if (!birthYear) return null;
  const currentYear = new Date().getFullYear() + 543; // ปี พ.ศ.
  return currentYear - parseInt(birthYear);
};

// รายชื่อชุมชนจาก CommunitySelector
const COMMUNITIES = [
  "สามล",
  "รจนา",
  "หัวเขาตาคลี",
  "สว่างวงษ์",
  "ตาคลีพัฒนา",
  "ตีคลี",
  "ทิพย์พิมาน",
  "ตาคลีใหญ่",
  "บ้านใหม่โพนทอง",
  "วิลาวัลย์",
  "โพธิ์งาม",
  "พุทธนิมิต",
  "ยศวิมล",
  "ศรีเทพ",
  "สังข์ทอง",
  "ศรีสวัสดิ์",
  "เขาใบไม้",
  "จันทร์เทวี",
  "รวมใจ",
  "ตลาดโพนทอง",
  "มาลัย",
  "สารภี",
];

export default function ElderlyDataTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCommunity, setFilterCommunity] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    firstName: "",
    lastName: "",
    birthYear: "",
    dataGroup: "general",
    address: "",
    community: "",
    lat: "",
    lng: "",
  });
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/smart-health/elderly");
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Failed to fetch elderly data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      Swal.fire("ไม่รองรับ", "เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง", "warning");
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setIsGettingLocation(false);
        Swal.fire({
          icon: "success",
          title: "ได้รับพิกัดแล้ว",
          text: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
          showConfirmButton: false,
          timer: 1500,
        });
      },
      (error) => {
        setIsGettingLocation(false);
        console.error("Geolocation error:", error);
        Swal.fire("ผิดพลาด", "ไม่สามารถรับตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง", "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title) {
      Swal.fire("ข้อมูลไม่ครบ", "กรุณาเลือกคำนำหน้า", "warning");
      return;
    }

    if (!formData.firstName || !formData.lastName) {
      Swal.fire("ข้อมูลไม่ครบ", "กรุณากรอกชื่อและนามสกุล", "warning");
      return;
    }

    if (!formData.birthYear) {
      Swal.fire("ข้อมูลไม่ครบ", "กรุณาระบุปีเกิด (พ.ศ.)", "warning");
      return;
    }

    if (!formData.community) {
      Swal.fire("ข้อมูลไม่ครบ", "กรุณาเลือกชุมชน", "warning");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/smart-health/elderly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          firstName: formData.firstName,
          lastName: formData.lastName,
          fullName: `${formData.title}${formData.firstName} ${formData.lastName}`,
          birthYear: parseInt(formData.birthYear),
          age: calculateAge(formData.birthYear),
          dataGroup: formData.dataGroup,
          address: formData.address || null,
          community: formData.community,
          location: formData.lat && formData.lng ? {
            lat: parseFloat(formData.lat),
            lng: parseFloat(formData.lng),
          } : null,
        }),
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "บันทึกข้อมูลสำเร็จ",
          showConfirmButton: false,
          timer: 1500,
        });
        setShowAddModal(false);
        setFormData({
          title: "",
          firstName: "",
          lastName: "",
          birthYear: "",
          dataGroup: "general",
          address: "",
          community: "",
          lat: "",
          lng: "",
        });
        fetchData();
      } else {
        const result = await res.json();
        Swal.fire("ผิดพลาด", result.message || "ไม่สามารถบันทึกข้อมูลได้", "error");
      }
    } catch (error) {
      console.error("Submit error:", error);
      Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาด", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบ?",
      html: `<p>ลบข้อมูล <strong>${item.fullName}</strong>?</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/smart-health/elderly?id=${item._id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "ลบสำเร็จ",
          showConfirmButton: false,
          timer: 1500,
        });
        fetchData();
      } else {
        Swal.fire("ผิดพลาด", "ไม่สามารถลบได้", "error");
      }
    } catch {
      Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาด", "error");
    }
  };

  const openGoogleMaps = (location) => {
    if (location?.lat && location?.lng) {
      window.open(
        `https://www.google.com/maps?q=${location.lat},${location.lng}&z=17`,
        "_blank"
      );
    }
  };

  const filtered = data.filter((item) => {
    const matchSearch =
      item.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.community?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchCommunity = filterCommunity
      ? item.community === filterCommunity
      : true;

    const matchGroup = filterGroup
      ? item.dataGroup === filterGroup
      : true;

    return matchSearch && matchCommunity && matchGroup;
  });

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCommunity, filterGroup]);

  // นับจำนวนผู้สูงอายุแต่ละชุมชน
  const communityCounts = COMMUNITIES.reduce((acc, c) => {
    acc[c] = data.filter((item) => item.community === c).length;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            ข้อมูลผู้สูงอายุ
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            ทั้งหมด {data.length} คน | แสดง {filtered.length} คน
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">เพิ่มข้อมูลผู้สูงอายุ</span>
          <span className="sm:hidden">เพิ่ม</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, ที่อยู่..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative min-w-[140px]">
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
          >
            <option value="">ทุกกลุ่ม</option>
            {DATA_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative min-w-[140px]">
          <select
            value={filterCommunity}
            onChange={(e) => setFilterCommunity(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
          >
            <option value="">ทุกชุมชน</option>
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>
                {c} ({communityCounts[c] || 0})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">
            ไม่พบข้อมูล
          </h3>
          <p className="text-gray-500 text-sm">
            {searchTerm || filterCommunity ? "ลองค้นหาด้วยคำค้นอื่น" : "ยังไม่มีข้อมูลผู้สูงอายุ"}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-2">
            {paginatedData.map((item, idx) => {
              const groupInfo = DATA_GROUPS.find(g => g.value === item.dataGroup) || DATA_GROUPS[0];
              return (
                <div
                  key={item._id}
                  className="bg-white border border-gray-200 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-gray-400">#{startIndex + idx + 1}</span>
                        {item.age && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                            {item.age} ปี
                          </span>
                        )}
                        {item.location && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                            <MapPin className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.fullName}
                      </p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${groupInfo.color}`}>
                          {groupInfo.label}
                        </span>
                        {item.community && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                            {item.community}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowDetailModal(item)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {item.location && (
                        <button
                          onClick={() => openGoogleMaps(item.location)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                        >
                          <Navigation className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-12">
                    #
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    ชื่อ-นามสกุล
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-16">
                    อายุ
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    กลุ่ม
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    ชุมชน
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">
                    พิกัด
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-24">
                    จัดการ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedData.map((item, idx) => {
                  const groupInfo = DATA_GROUPS.find(g => g.value === item.dataGroup) || DATA_GROUPS[0];
                  return (
                    <tr key={item._id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {startIndex + idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {item.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.age ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {item.age} ปี
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${groupInfo.color}`}>
                          {groupInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {item.community ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {item.community}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.location ? (
                          <button
                            onClick={() => openGoogleMaps(item.location)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                          >
                            <MapPin className="w-3 h-3" />
                            ดูแผนที่
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setShowDetailModal(item)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <p className="text-sm text-gray-500">
                แสดง {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filtered.length)} จาก {filtered.length} รายการ
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  หน้าแรก
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Page numbers */}
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
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 text-sm rounded-lg ${
                          currentPage === pageNum
                            ? "bg-emerald-500 text-white"
                            : "border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  หน้าสุดท้าย
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">เพิ่มข้อมูลผู้สูงอายุ</h3>
                  <p className="text-xs text-gray-500">กรอกข้อมูลให้ครบถ้วน</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  คำนำหน้า <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {TITLES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, title: t })}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        formData.title === t
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่อ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ชื่อ"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="นามสกุล"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Birth Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ปีเกิด (พ.ศ.) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3 items-center">
                  <input
                    type="number"
                    placeholder="เช่น 2470"
                    min="2400"
                    max={new Date().getFullYear() + 543}
                    className="flex-1 px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                    value={formData.birthYear}
                    onChange={(e) =>
                      setFormData({ ...formData, birthYear: e.target.value })
                    }
                  />
                  {formData.birthYear && calculateAge(formData.birthYear) > 0 && (
                    <div className="px-3 py-2 bg-emerald-50 rounded-xl">
                      <span className="text-sm font-medium text-emerald-700">
                        อายุ {calculateAge(formData.birthYear)} ปี
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Data Group */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  กลุ่มข้อมูล
                </label>
                <div className="flex flex-wrap gap-2">
                  {DATA_GROUPS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, dataGroup: g.value })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        formData.dataGroup === g.value
                          ? "bg-emerald-500 text-white shadow-sm"
                          : g.color + " hover:opacity-80"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Community */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  ชุมชน <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-xl bg-gray-50">
                  {COMMUNITIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, community: c })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        formData.community === c
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {formData.community && (
                  <p className="text-xs text-emerald-600 mt-1">
                    เลือก: {formData.community}
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Home className="w-3.5 h-3.5 inline mr-1" />
                  ที่อยู่
                </label>
                <input
                  type="text"
                  placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1" />
                  พิกัด GPS
                </label>
                
                {/* Input fields and buttons */}
                <div className="flex flex-wrap gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Latitude"
                    className="flex-1 min-w-[100px] px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                    value={formData.lat}
                    onChange={(e) =>
                      setFormData({ ...formData, lat: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="Longitude"
                    className="flex-1 min-w-[100px] px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                    value={formData.lng}
                    onChange={(e) =>
                      setFormData({ ...formData, lng: e.target.value })
                    }
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isGettingLocation}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                  >
                    {isGettingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        <span>ตำแหน่งปัจจุบัน</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5 text-sm"
                  >
                    <Map className="w-4 h-4" />
                    <span>เลือกจากแผนที่</span>
                  </button>
                </div>

                {formData.lat && formData.lng && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    พิกัด: {formData.lat}, {formData.lng}
                  </p>
                )}
              </div>
            </form>

            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${
                  isSubmitting
                    ? "bg-gray-200 text-gray-400"
                    : "bg-emerald-500 text-white hover:bg-emerald-600"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    บันทึก...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    บันทึก
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (() => {
        const groupInfo = DATA_GROUPS.find(g => g.value === showDetailModal.dataGroup) || DATA_GROUPS[0];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {showDetailModal.fullName}
                    </h3>
                    <p className="text-xs text-gray-500">ข้อมูลผู้สูงอายุ</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(null)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Age & Group */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-amber-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">อายุ</p>
                    <p className="text-lg font-bold text-amber-700">
                      {showDetailModal.age ? `${showDetailModal.age} ปี` : "-"}
                    </p>
                    {showDetailModal.birthYear && (
                      <p className="text-xs text-gray-500">เกิด พ.ศ. {showDetailModal.birthYear}</p>
                    )}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-1">กลุ่มข้อมูล</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${groupInfo.color}`}>
                      {groupInfo.label}
                    </span>
                  </div>
                </div>

                {showDetailModal.community && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">ชุมชน</p>
                      <p className="text-sm font-medium text-blue-700">{showDetailModal.community}</p>
                    </div>
                  </div>
                )}

                {showDetailModal.address && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <Home className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">ที่อยู่</p>
                      <p className="text-sm">{showDetailModal.address}</p>
                    </div>
                  </div>
                )}

                {showDetailModal.location && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                    <MapPin className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">พิกัด GPS</p>
                      <p className="text-sm font-mono">
                        {showDetailModal.location.lat}, {showDetailModal.location.lng}
                      </p>
                    </div>
                    <button
                      onClick={() => openGoogleMaps(showDetailModal.location)}
                      className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
                    >
                      เปิดแผนที่
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setShowDetailModal(null)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Map className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">เลือกตำแหน่งจากแผนที่</h3>
                  <p className="text-xs text-gray-500">คลิกหรือลากหมุดเพื่อเลือกตำแหน่ง</p>
                </div>
              </div>
              <button
                onClick={() => setShowMapPicker(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 p-4">
              <LocationPickerMap
                initialLocation={{
                  lat: formData.lat ? parseFloat(formData.lat) : 15.253914,
                  lng: formData.lng ? parseFloat(formData.lng) : 100.351077,
                }}
                onLocationChange={(loc) => {
                  setFormData({
                    ...formData,
                    lat: loc.lat.toFixed(6),
                    lng: loc.lng.toFixed(6),
                  });
                }}
              />
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowMapPicker(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setShowMapPicker(false)}
                className="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 font-medium text-sm flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                ยืนยันตำแหน่ง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
