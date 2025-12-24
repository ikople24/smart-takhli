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
  Edit3,
  Phone,
  CreditCard,
  Image as ImageIcon,
  DollarSign,
  Wrench,
  FileText,
  Heart,
  Calendar,
  Save,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";

// Dynamic import for map component (ssr: false for leaflet)
const LocationPickerMap = dynamic(
  () => import("./LocationPickerMap"),
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div> }
);

// คำนำหน้าชื่อ
const TITLES = ["นาย", "นาง", "นางสาว", "เด็กชาย", "เด็กหญิง"];

// กลุ่มข้อมูลตามมาตรฐานสาธารณสุข (รองรับข้อมูลเดิมและใหม่)
const DATA_GROUPS = [
  // ผู้สูงอายุตาม ADL
  { value: "elderly_social", label: "ติดสังคม", color: "bg-emerald-100 text-emerald-700", icon: "🟢", category: "elderly", description: "ADL ดี ช่วยเหลือตัวเองได้" },
  { value: "elderly_home", label: "ติดบ้าน", color: "bg-amber-100 text-amber-700", icon: "🟡", category: "elderly", description: "ADL ปานกลาง ต้องมีผู้ดูแล" },
  { value: "elderly_bed", label: "ติดเตียง (สูงอายุ)", color: "bg-red-100 text-red-700", icon: "🔴", category: "elderly", description: "ADL ต่ำ ต้องดูแลตลอด" },
  { value: "elderly_98", label: "อายุ 98 ปีขึ้นไป", color: "bg-purple-100 text-purple-700", icon: "👴", category: "elderly", description: "ผู้สูงอายุยืนยาว" },
  // ผู้พิการ (รวมข้อมูลเดิม "disabled")
  { value: "disabled", label: "ผู้พิการ (ทั่วไป)", color: "bg-blue-100 text-blue-700", icon: "♿", category: "disabled", description: "ผู้พิการที่ยังไม่ได้ระบุประเภท" },
  { value: "disabled_move", label: "พิการทางการเคลื่อนไหว", color: "bg-blue-100 text-blue-700", icon: "🦽", category: "disabled", description: "ใช้อุปกรณ์ช่วยเดิน/รถเข็น" },
  { value: "disabled_vision", label: "พิการทางการมองเห็น", color: "bg-indigo-100 text-indigo-700", icon: "👁", category: "disabled", description: "สายตาเลือนราง/ตาบอด" },
  { value: "disabled_hearing", label: "พิการทางการได้ยิน", color: "bg-violet-100 text-violet-700", icon: "👂", category: "disabled", description: "หูตึง/หูหนวก" },
  { value: "disabled_mental", label: "พิการทางจิตใจ", color: "bg-pink-100 text-pink-700", icon: "🧠", category: "disabled", description: "โรคจิตเวช/ออทิสติก" },
  { value: "disabled_intellect", label: "พิการทางสติปัญญา", color: "bg-rose-100 text-rose-700", icon: "💭", category: "disabled", description: "พัฒนาการช้า/ปัญญาอ่อน" },
  // ผู้ป่วย
  { value: "chronic", label: "โรคเรื้อรัง", color: "bg-orange-100 text-orange-700", icon: "💊", category: "patient", description: "เบาหวาน/ความดัน/หัวใจ" },
  { value: "bedridden", label: "ผู้ป่วยติดเตียง", color: "bg-red-100 text-red-700", icon: "🛏", category: "patient", description: "ช่วยเหลือตัวเองไม่ได้" },
  { value: "palliative", label: "ผู้ป่วยระยะสุดท้าย", color: "bg-gray-200 text-gray-700", icon: "🕯", category: "patient", description: "ต้องการการดูแลแบบประคับประคอง" },
  // อื่นๆ
  { value: "alone", label: "อยู่คนเดียว", color: "bg-cyan-100 text-cyan-700", icon: "🏠", category: "other", description: "ไม่มีผู้ดูแล/ญาติ" },
  { value: "poor", label: "ผู้ยากไร้", color: "bg-stone-100 text-stone-700", icon: "📋", category: "other", description: "รายได้ต่ำกว่าเกณฑ์" },
  { value: "general", label: "ทั่วไป", color: "bg-slate-100 text-slate-700", icon: "👤", category: "other", description: "ไม่อยู่ในกลุ่มเฉพาะ" },
];

// จัดกลุ่มข้อมูลตามหมวดหมู่
const DATA_GROUP_CATEGORIES = [
  { key: "elderly", label: "ผู้สูงอายุ (ADL)", icon: "👴" },
  { key: "disabled", label: "ผู้พิการ", icon: "♿" },
  { key: "patient", label: "ผู้ป่วย", icon: "🏥" },
  { key: "other", label: "อื่นๆ", icon: "📋" },
];

// ประเภทสิทธิ์การรักษา
const HEALTHCARE_RIGHTS = [
  { value: "ucs", label: "บัตรทอง (30 บาท)", icon: "🟡" },
  { value: "sss", label: "ประกันสังคม", icon: "🟠" },
  { value: "csmbs", label: "ข้าราชการ", icon: "🔵" },
  { value: "private", label: "ประกันเอกชน", icon: "🟣" },
  { value: "none", label: "ไม่มีสิทธิ์", icon: "⚪" },
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

export default function PersonDataTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCommunity, setFilterCommunity] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [showEditMapPicker, setShowEditMapPicker] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    firstName: "",
    lastName: "",
    birthYear: "",
    citizenId: "",
    phone: "",
    dataGroup: "general",
    healthStatus: "",
    healthcareRight: "",
    chronicDiseases: "",
    address: "",
    community: "",
    lat: "",
    lng: "",
    householdIncome: "",
    assistiveEquipment: "",
    notes: "",
  });
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/smart-health/people");
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error("Failed to fetch people data:", error);
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
      const res = await fetch("/api/smart-health/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          firstName: formData.firstName,
          lastName: formData.lastName,
          fullName: `${formData.title}${formData.firstName} ${formData.lastName}`,
          birthYear: parseInt(formData.birthYear),
          age: calculateAge(formData.birthYear),
          citizenId: formData.citizenId || null,
          phone: formData.phone || null,
          dataGroup: formData.dataGroup,
          healthStatus: formData.healthStatus || null,
          healthcareRight: formData.healthcareRight || null,
          chronicDiseases: formData.chronicDiseases || null,
          address: formData.address || null,
          community: formData.community,
          location: formData.lat && formData.lng ? {
            lat: parseFloat(formData.lat),
            lng: parseFloat(formData.lng),
          } : null,
          householdIncome: formData.householdIncome || null,
          assistiveEquipment: formData.assistiveEquipment || null,
          notes: formData.notes || null,
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
          citizenId: "",
          phone: "",
          dataGroup: "general",
          healthStatus: "",
          healthcareRight: "",
          chronicDiseases: "",
          address: "",
          community: "",
          lat: "",
          lng: "",
          householdIncome: "",
          assistiveEquipment: "",
          notes: "",
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
      const res = await fetch(`/api/smart-health/people?id=${item._id}`, {
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

  // Start edit mode
  const handleStartEdit = (item) => {
    setEditFormData({
      title: item.title || "",
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      birthYear: item.birthYear || "",
      dataGroup: item.dataGroup || "general",
      address: item.address || "",
      community: item.community || "",
      lat: item.location?.lat?.toString() || "",
      lng: item.location?.lng?.toString() || "",
      phone: item.phone || "",
      citizenId: item.citizenId || "",
      healthStatus: item.healthStatus || "",
      healthcareRight: item.healthcareRight || "",
      chronicDiseases: item.chronicDiseases || "",
      householdIncome: item.householdIncome || "",
      assistiveEquipment: item.assistiveEquipment || "",
      notes: item.notes || "",
      livingStatus: item.livingStatus || "",
    });
    setIsEditing(true);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData({});
    setShowEditMapPicker(false);
  };

  // Save edited data
  const handleSaveEdit = async () => {
    if (!showDetailModal?._id) return;

    setIsSubmitting(true);

    try {
      const updateData = {
        title: editFormData.title,
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        fullName: `${editFormData.title}${editFormData.firstName} ${editFormData.lastName}`,
        birthYear: editFormData.birthYear ? parseInt(editFormData.birthYear) : null,
        age: calculateAge(editFormData.birthYear),
        dataGroup: editFormData.dataGroup,
        address: editFormData.address || null,
        community: editFormData.community,
        location: editFormData.lat && editFormData.lng ? {
          lat: parseFloat(editFormData.lat),
          lng: parseFloat(editFormData.lng),
        } : null,
        phone: editFormData.phone || null,
        citizenId: editFormData.citizenId || null,
        healthStatus: editFormData.healthStatus || null,
        healthcareRight: editFormData.healthcareRight || null,
        chronicDiseases: editFormData.chronicDiseases || null,
        householdIncome: editFormData.householdIncome || null,
        assistiveEquipment: editFormData.assistiveEquipment || null,
        notes: editFormData.notes || null,
        livingStatus: editFormData.livingStatus || null,
      };

      const res = await fetch(`/api/smart-health/people?id=${showDetailModal._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "บันทึกสำเร็จ",
          showConfirmButton: false,
          timer: 1500,
        });
        setIsEditing(false);
        setShowDetailModal(null);
        fetchData();
      } else {
        const result = await res.json();
        Swal.fire("ผิดพลาด", result.message || "ไม่สามารถบันทึกได้", "error");
      }
    } catch (error) {
      console.error("Save edit error:", error);
      Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาด", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current location for edit form
  const handleEditGetLocation = () => {
    if (!navigator.geolocation) {
      Swal.fire("ไม่รองรับ", "เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง", "warning");
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setEditFormData((prev) => ({
          ...prev,
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        }));
        setIsGettingLocation(false);
      },
      () => {
        setIsGettingLocation(false);
        Swal.fire("ผิดพลาด", "ไม่สามารถรับตำแหน่งได้", "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
            ข้อมูลบุคคล
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
          <span className="hidden sm:inline">เพิ่มข้อมูลบุคคล</span>
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
            {searchTerm || filterCommunity ? "ลองค้นหาด้วยคำค้นอื่น" : "ยังไม่มีข้อมูลบุคคล"}
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
                        {item.birthYear && calculateAge(item.birthYear) > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                            {calculateAge(item.birthYear)} ปี
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
                        {item.birthYear && calculateAge(item.birthYear) > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {calculateAge(item.birthYear)} ปี
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

      {/* Add Modal - Hospital Style */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-cyan-100">
            {/* Header - Hospital Style */}
            <div className="flex items-center justify-between p-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-600 to-teal-600">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                  <span className="text-2xl">🏥</span>
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">ลงทะเบียนผู้รับบริการ</h3>
                  <p className="text-xs text-cyan-100">กรอกข้อมูลให้ครบถ้วนตามแบบฟอร์ม รพ.สต.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Section 1: ข้อมูลส่วนบุคคล */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2">
                  <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                    <User className="w-4 h-4" /> ข้อมูลส่วนบุคคล
                  </h4>
                </div>
                <div className="p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      คำนำหน้า <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TITLES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData({ ...formData, title: t })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            formData.title === t
                              ? "bg-cyan-500 text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-cyan-50 hover:text-cyan-700"
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
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        นามสกุล <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="นามสกุล"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Birth Year & Citizen ID */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ปีเกิด (พ.ศ.) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          placeholder="เช่น 2480"
                          min="2400"
                          max={new Date().getFullYear() + 543}
                          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                          value={formData.birthYear}
                          onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                        />
                        {formData.birthYear && calculateAge(formData.birthYear) > 0 && (
                          <span className="px-3 py-2 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium whitespace-nowrap">
                            {calculateAge(formData.birthYear)} ปี
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                        เลขบัตรประชาชน
                      </label>
                      <input
                        type="text"
                        placeholder="X-XXXX-XXXXX-XX-X"
                        maxLength={17}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-mono"
                        value={formData.citizenId}
                        onChange={(e) => setFormData({ ...formData, citizenId: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-3.5 h-3.5 inline mr-1" />
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      type="tel"
                      placeholder="08X-XXX-XXXX"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: ข้อมูลสุขภาพ */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2">
                  <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                    <Heart className="w-4 h-4" /> ข้อมูลสุขภาพ
                  </h4>
                </div>
                <div className="p-4 space-y-4">
                  {/* Data Group by Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      กลุ่มผู้รับบริการ <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-3">
                      {DATA_GROUP_CATEGORIES.map((cat) => (
                        <div key={cat.key} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                            <span>{cat.icon}</span> {cat.label}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {DATA_GROUPS.filter(g => g.category === cat.key).map((g) => (
                              <button
                                key={g.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, dataGroup: g.value })}
                                title={g.description}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                                  formData.dataGroup === g.value
                                    ? "bg-cyan-500 text-white shadow-md ring-2 ring-cyan-300"
                                    : g.color + " hover:scale-105"
                                }`}
                              >
                                <span>{g.icon}</span> {g.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Healthcare Rights */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      สิทธิ์การรักษา
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {HEALTHCARE_RIGHTS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, healthcareRight: r.value })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                            formData.healthcareRight === r.value
                              ? "bg-cyan-500 text-white shadow-md"
                              : "bg-gray-100 text-gray-700 hover:bg-cyan-50"
                          }`}
                        >
                          <span>{r.icon}</span> {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chronic Diseases */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      โรคประจำตัว
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น เบาหวาน, ความดันโลหิตสูง, หัวใจ"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                      value={formData.chronicDiseases}
                      onChange={(e) => setFormData({ ...formData, chronicDiseases: e.target.value })}
                    />
                  </div>

                  {/* Assistive Equipment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Wrench className="w-3.5 h-3.5 inline mr-1" />
                      อุปกรณ์ช่วยเหลือที่ใช้
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ไม้เท้า, รถเข็น, เครื่องช่วยฟัง"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                      value={formData.assistiveEquipment}
                      onChange={(e) => setFormData({ ...formData, assistiveEquipment: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: ที่อยู่ */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2">
                  <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                    <Home className="w-4 h-4" /> ที่อยู่อาศัย
                  </h4>
                </div>
                <div className="p-4 space-y-4">
                  {/* Community */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ชุมชน <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                      {COMMUNITIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormData({ ...formData, community: c })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            formData.community === c
                              ? "bg-orange-500 text-white shadow-md"
                              : "bg-white text-gray-700 hover:bg-orange-50 border border-gray-200"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ที่อยู่
                    </label>
                    <input
                      type="text"
                      placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  {/* GPS */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="w-3.5 h-3.5 inline mr-1" />
                      พิกัด GPS
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Latitude"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                        value={formData.lat}
                        onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Longitude"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                        value={formData.lng}
                        onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGetCurrentLocation}
                        disabled={isGettingLocation}
                        className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
                      >
                        {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                        <span>ตำแหน่งปัจจุบัน</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMapPicker(true)}
                        className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5 text-sm"
                      >
                        <Map className="w-4 h-4" />
                        <span>เลือกจากแผนที่</span>
                      </button>
                    </div>
                  </div>

                  {/* Household Income */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                      รายได้ครัวเรือน (ต่อเดือน)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 5,000 บาท"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                      value={formData.householdIncome}
                      onChange={(e) => setFormData({ ...formData, householdIncome: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: หมายเหตุ */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-500 to-slate-500 px-4 py-2">
                  <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4" /> หมายเหตุ
                  </h4>
                </div>
                <div className="p-4">
                  <textarea
                    placeholder="ข้อมูลเพิ่มเติมหรือหมายเหตุ..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 text-sm resize-none"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-medium text-sm flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${
                  isSubmitting
                    ? "bg-gray-300 text-gray-500"
                    : "bg-gradient-to-r from-cyan-500 to-teal-500 text-white hover:shadow-lg hover:scale-[1.02] transition-all"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    บันทึกข้อมูล
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (() => {
        const groupInfo = DATA_GROUPS.find(g => g.value === (isEditing ? editFormData.dataGroup : showDetailModal.dataGroup)) || DATA_GROUPS[0];
        const item = showDetailModal;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                <div className="flex items-center gap-3">
                  {item.personImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={item.personImage} 
                      alt={item.fullName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-emerald-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <User className="w-6 h-6 text-emerald-600" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {isEditing ? `${editFormData.title}${editFormData.firstName} ${editFormData.lastName}` : item.fullName}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isEditing ? "กำลังแก้ไขข้อมูล" : "ข้อมูลบุคคล"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      title="แก้ไข"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleCancelEdit();
                      setShowDetailModal(null);
                    }}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isEditing ? (
                  /* Edit Mode - Hospital Style */
                  <>
                    {/* Section 1: ข้อมูลส่วนบุคคล */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-2">
                        <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                          <User className="w-4 h-4" /> ข้อมูลส่วนบุคคล
                        </h4>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Title */}
                        <div className="flex flex-wrap gap-2">
                          {TITLES.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setEditFormData({ ...editFormData, title: t })}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                editFormData.title === t
                                  ? "bg-cyan-500 text-white shadow-md"
                                  : "bg-gray-100 text-gray-700 hover:bg-cyan-50"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>

                        {/* Name */}
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="ชื่อ"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                            value={editFormData.firstName}
                            onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="นามสกุล"
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                            value={editFormData.lastName}
                            onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          />
                        </div>

                        {/* Birth Year & Citizen ID */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">ปีเกิด (พ.ศ.)</label>
                            <input
                              type="number"
                              placeholder="เช่น 2480"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                              value={editFormData.birthYear}
                              onChange={(e) => setEditFormData({ ...editFormData, birthYear: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">เลข 13 หลัก</label>
                            <input
                              type="text"
                              placeholder="เลขบัตรประชาชน"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-mono"
                              value={editFormData.citizenId}
                              onChange={(e) => setEditFormData({ ...editFormData, citizenId: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">เบอร์โทร</label>
                          <input
                            type="tel"
                            placeholder="08X-XXX-XXXX"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm"
                            value={editFormData.phone}
                            onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: ข้อมูลสุขภาพ */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2">
                        <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                          <Heart className="w-4 h-4" /> ข้อมูลสุขภาพ
                        </h4>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Data Group by Category */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">กลุ่มผู้รับบริการ</label>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {DATA_GROUP_CATEGORIES.map((cat) => (
                              <div key={cat.key} className="bg-gray-50 rounded-lg p-2">
                                <p className="text-xs font-semibold text-gray-500 mb-1">{cat.icon} {cat.label}</p>
                                <div className="flex flex-wrap gap-1">
                                  {DATA_GROUPS.filter(g => g.category === cat.key).map((g) => (
                                    <button
                                      key={g.value}
                                      type="button"
                                      onClick={() => setEditFormData({ ...editFormData, dataGroup: g.value })}
                                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                        editFormData.dataGroup === g.value
                                          ? "bg-cyan-500 text-white shadow"
                                          : g.color + " hover:scale-105"
                                      }`}
                                    >
                                      {g.icon} {g.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Healthcare Rights */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">สิทธิ์การรักษา</label>
                          <div className="flex flex-wrap gap-2">
                            {HEALTHCARE_RIGHTS.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => setEditFormData({ ...editFormData, healthcareRight: r.value })}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                  editFormData.healthcareRight === r.value
                                    ? "bg-cyan-500 text-white shadow"
                                    : "bg-gray-100 text-gray-700 hover:bg-cyan-50"
                                }`}
                              >
                                {r.icon} {r.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Chronic Diseases & Equipment */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">โรคประจำตัว</label>
                            <input
                              type="text"
                              placeholder="เบาหวาน, ความดัน"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                              value={editFormData.chronicDiseases}
                              onChange={(e) => setEditFormData({ ...editFormData, chronicDiseases: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">อุปกรณ์ช่วยเหลือ</label>
                            <input
                              type="text"
                              placeholder="ไม้เท้า, รถเข็น"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                              value={editFormData.assistiveEquipment}
                              onChange={(e) => setEditFormData({ ...editFormData, assistiveEquipment: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: ที่อยู่ */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2">
                        <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                          <Home className="w-4 h-4" /> ที่อยู่อาศัย
                        </h4>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Community */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-2">ชุมชน</label>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                            {COMMUNITIES.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditFormData({ ...editFormData, community: c })}
                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                  editFormData.community === c
                                    ? "bg-orange-500 text-white"
                                    : "bg-white text-gray-700 hover:bg-orange-50 border border-gray-200"
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Address */}
                        <input
                          type="text"
                          placeholder="บ้านเลขที่ หมู่ ซอย ถนน"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                          value={editFormData.address}
                          onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        />

                        {/* GPS */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Latitude"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                            value={editFormData.lat}
                            onChange={(e) => setEditFormData({ ...editFormData, lat: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="Longitude"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                            value={editFormData.lng}
                            onChange={(e) => setEditFormData({ ...editFormData, lng: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleEditGetLocation}
                            disabled={isGettingLocation}
                            className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-1 text-sm disabled:opacity-50"
                          >
                            {isGettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                            <span>ตำแหน่ง</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowEditMapPicker(true)}
                            className="flex-1 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center justify-center gap-1 text-sm"
                          >
                            <Map className="w-4 h-4" />
                            <span>แผนที่</span>
                          </button>
                        </div>

                        {/* Income */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">รายได้ครัวเรือน/เดือน</label>
                          <input
                            type="text"
                            placeholder="เช่น 5,000 บาท"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                            value={editFormData.householdIncome}
                            onChange={(e) => setEditFormData({ ...editFormData, householdIncome: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: หมายเหตุ */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-gray-500 to-slate-500 px-3 py-2">
                        <h4 className="text-white font-semibold flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4" /> หมายเหตุ
                        </h4>
                      </div>
                      <div className="p-3">
                        <textarea
                          placeholder="ข้อมูลเพิ่มเติม..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500/20 focus:border-gray-500 text-sm resize-none"
                          value={editFormData.notes}
                          onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  /* View Mode - Hospital Style */
                  <>
                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-100">
                        <p className="text-xs text-cyan-600 mb-1">อายุ</p>
                        <p className="text-xl font-bold text-cyan-700">
                          {item.birthYear && calculateAge(item.birthYear) > 0 ? calculateAge(item.birthYear) : "-"}
                        </p>
                        <p className="text-xs text-gray-500">ปี</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 col-span-2">
                        <p className="text-xs text-emerald-600 mb-1">กลุ่มผู้รับบริการ</p>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium ${groupInfo.color}`}>
                          <span>{groupInfo.icon}</span> {groupInfo.label}
                        </div>
                        {groupInfo.description && (
                          <p className="text-xs text-gray-500 mt-1">{groupInfo.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5">
                        <h4 className="text-white font-medium text-xs flex items-center gap-1">
                          <User className="w-3 h-3" /> ข้อมูลติดต่อ
                        </h4>
                      </div>
                      <div className="p-3 space-y-2">
                        {item.citizenId && (
                          <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-gray-500">เลข 13 หลัก:</span>
                            <span className="text-sm font-mono font-medium text-purple-700">{item.citizenId}</span>
                          </div>
                        )}
                        {item.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-gray-500">โทร:</span>
                            <span className="text-sm font-medium text-blue-700">{item.phone}</span>
                          </div>
                        )}
                        {item.birthYear && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-500" />
                            <span className="text-xs text-gray-500">ปีเกิด:</span>
                            <span className="text-sm font-medium">พ.ศ. {item.birthYear}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Health Info */}
                    {(item.healthcareRight || item.chronicDiseases || item.assistiveEquipment) && (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5">
                          <h4 className="text-white font-medium text-xs flex items-center gap-1">
                            <Heart className="w-3 h-3" /> ข้อมูลสุขภาพ
                          </h4>
                        </div>
                        <div className="p-3 space-y-2">
                          {item.healthcareRight && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">สิทธิ์:</span>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {HEALTHCARE_RIGHTS.find(r => r.value === item.healthcareRight)?.label || item.healthcareRight}
                              </span>
                            </div>
                          )}
                          {item.chronicDiseases && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-gray-500">โรคประจำตัว:</span>
                              <span className="text-sm text-red-600">{item.chronicDiseases}</span>
                            </div>
                          )}
                          {item.assistiveEquipment && (
                            <div className="flex items-center gap-2">
                              <Wrench className="w-4 h-4 text-orange-500" />
                              <span className="text-xs text-gray-500">อุปกรณ์:</span>
                              <span className="text-sm text-orange-700">{item.assistiveEquipment}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5">
                        <h4 className="text-white font-medium text-xs flex items-center gap-1">
                          <Home className="w-3 h-3" /> ที่อยู่อาศัย
                        </h4>
                      </div>
                      <div className="p-3 space-y-2">
                        {item.community && (
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-500" />
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">{item.community}</span>
                          </div>
                        )}
                        {item.address && (
                          <p className="text-sm text-gray-600 pl-6">{item.address}</p>
                        )}
                        {item.location && (
                          <div className="flex items-center justify-between pl-6">
                            <span className="text-xs font-mono text-gray-500">
                              📍 {item.location.lat?.toFixed(4)}, {item.location.lng?.toFixed(4)}
                            </span>
                            <button
                              onClick={() => openGoogleMaps(item.location)}
                              className="px-2 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600"
                            >
                              🗺 นำทาง
                            </button>
                          </div>
                        )}
                        {item.householdIncome && (
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <DollarSign className="w-4 h-4 text-yellow-500" />
                            <span className="text-xs text-gray-500">รายได้:</span>
                            <span className="text-sm font-medium text-yellow-700">{item.householdIncome}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {item.notes && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> หมายเหตุ
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.notes}</p>
                      </div>
                    )}

                    {/* Images */}
                    {(item.personImage || item.residenceImage || item.livingConditionsImage) && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> รูปภาพประกอบ
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {item.personImage && (
                            <a href={item.personImage} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={item.personImage} 
                                alt="บุคคล"
                                className="w-full h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                              />
                              <p className="text-[10px] text-center text-gray-500 mt-0.5">บุคคล</p>
                            </a>
                          )}
                          {item.residenceImage && (
                            <a href={item.residenceImage} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={item.residenceImage} 
                                alt="ที่อยู่"
                                className="w-full h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                              />
                              <p className="text-[10px] text-center text-gray-500 mt-0.5">ที่อยู่</p>
                            </a>
                          )}
                          {item.livingConditionsImage && (
                            <a href={item.livingConditionsImage} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={item.livingConditionsImage} 
                                alt="ความเป็นอยู่"
                                className="w-full h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                              />
                              <p className="text-[10px] text-center text-gray-500 mt-0.5">ความเป็นอยู่</p>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Record Info */}
                    {(item.recordDate || item.dataCollector || item.livingStatus) && (
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-3 text-[10px] text-gray-400">
                        {item.livingStatus && (
                          <span className="flex items-center gap-1">
                            ❤️ {item.livingStatus}
                          </span>
                        )}
                        {item.recordDate && (
                          <span className="flex items-center gap-1">
                            📅 {item.recordDate}
                          </span>
                        )}
                        {item.dataCollector && (
                          <span className="flex items-center gap-1">
                            👤 {item.dataCollector}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-4 border-t border-gray-100">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSaveEdit}
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
                          <Save className="w-4 h-4" />
                          บันทึก
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium text-sm flex items-center justify-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      แก้ไข
                    </button>
                    <button
                      onClick={() => setShowDetailModal(null)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm"
                    >
                      ปิด
                    </button>
                  </>
                )}
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

      {/* Map Picker Modal for Edit Mode */}
      {showEditMapPicker && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
                onClick={() => setShowEditMapPicker(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 p-4">
              <LocationPickerMap
                initialLocation={{
                  lat: editFormData.lat ? parseFloat(editFormData.lat) : 15.253914,
                  lng: editFormData.lng ? parseFloat(editFormData.lng) : 100.351077,
                }}
                onLocationChange={(loc) => {
                  setEditFormData({
                    ...editFormData,
                    lat: loc.lat.toFixed(6),
                    lng: loc.lng.toFixed(6),
                  });
                }}
              />
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowEditMapPicker(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 font-medium text-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setShowEditMapPicker(false)}
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
