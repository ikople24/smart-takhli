import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Package, Trash2, X, Check, AlertTriangle, Wrench, CheckCircle, MoreVertical, ChevronDown } from "lucide-react";
import Swal from "sweetalert2";

// Status configuration
const DEVICE_STATUSES = {
  available: {
    label: "พร้อมใช้งาน",
    shortLabel: "พร้อม",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle,
    dotColor: "bg-green-500",
  },
  borrowed: {
    label: "ถูกยืม",
    shortLabel: "ยืม",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Package,
    dotColor: "bg-blue-500",
  },
  broken: {
    label: "ชำรุด",
    shortLabel: "ชำรุด",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: AlertTriangle,
    dotColor: "bg-red-500",
  },
  repair: {
    label: "ซ่อมบำรุง",
    shortLabel: "ซ่อม",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Wrench,
    dotColor: "bg-orange-500",
  },
};

export default function RegisterDeviceTable({ onStatusChange }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ทั้งหมด");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [newDevice, setNewDevice] = useState({
    ob_type: "",
    id_code_th: "",
    index_id_tk: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (activeDropdown && !e.target.closest(".status-dropdown")) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown]);

  async function fetchDevices() {
    try {
      const res = await fetch("/api/smart-health/registered-devices");
      const data = await res.json();
      setDevices(data);
    } catch (error) {
      console.error("ไม่สามารถโหลดข้อมูลอุปกรณ์:", error);
    } finally {
      setLoading(false);
    }
  }

  const getDeviceStatus = (device) => {
    if (device.device_status) return device.device_status;
    if (device.ob_status === false) return "borrowed";
    return "available";
  };

  const obTypes = useMemo(() => {
    const types = devices?.map((d) => d.ob_type).filter(Boolean) || [];
    return ["ทั้งหมด", ...Array.from(new Set(types))];
  }, [devices]);

  const filtered = useMemo(() => {
    let result = filter === "ทั้งหมด"
      ? devices
      : devices.filter((item) => item.ob_type === filter);
    
    if (statusFilter !== "all") {
      result = result.filter((item) => getDeviceStatus(item) === statusFilter);
    }
    
    if (searchTerm) {
      result = result.filter(
        (item) =>
          item.ob_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.id_code_th?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.index_id_tk?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return result;
  }, [devices, filter, statusFilter, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts = { all: devices.length, available: 0, borrowed: 0, broken: 0, repair: 0 };
    devices.forEach((d) => {
      const status = getDeviceStatus(d);
      if (counts[status] !== undefined) {
        counts[status]++;
      }
    });
    return counts;
  }, [devices]);

  const typeCounts = useMemo(() => {
    const counts = {};
    devices.forEach((d) => {
      if (d.ob_type) {
        counts[d.ob_type] = (counts[d.ob_type] || 0) + 1;
      }
    });
    return counts;
  }, [devices]);

  async function handleUpdateStatus(item, newStatus) {
    const id = item._id?.$oid || item._id || item.index_id_tk;
    setActiveDropdown(null);

    try {
      const res = await fetch(`/api/smart-health/register-object-health/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          device_status: newStatus,
          ob_status: newStatus === "available" 
        }),
      });

      if (res.ok) {
        setDevices((prev) =>
          prev.map((d) =>
            (d._id?.$oid || d._id || d.index_id_tk) === id
              ? { ...d, device_status: newStatus, ob_status: newStatus === "available" }
              : d
          )
        );
        
        const statusInfo = DEVICE_STATUSES[newStatus];
        Swal.fire({
          icon: "success",
          title: `เปลี่ยนสถานะเป็น "${statusInfo.label}" แล้ว`,
          showConfirmButton: false,
          timer: 1500,
        });

        if (typeof onStatusChange === "function") {
          onStatusChange();
        }
      } else {
        Swal.fire("ผิดพลาด", "ไม่สามารถเปลี่ยนสถานะได้", "error");
      }
    } catch (error) {
      console.error("Update status error:", error);
      Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาด", "error");
    }
  }

  async function handleDeleteItem(item) {
    const id = item._id?.$oid || item._id || item.index_id_tk;
    
    const result = await Swal.fire({
      title: "ยืนยันการลบ?",
      html: `<p>คุณต้องการลบอุปกรณ์นี้?</p>
             <p class="text-sm text-gray-500 mt-2">${item.ob_type}<br/>${item.index_id_tk}</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/smart-health/register-object-health/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDevices((prev) =>
          prev.filter((d) => (d._id?.$oid || d._id || d.index_id_tk) !== id)
        );
        Swal.fire({
          icon: "success",
          title: "ลบสำเร็จ",
          showConfirmButton: false,
          timer: 1500,
        });
        if (typeof onStatusChange === "function") {
          onStatusChange();
        }
      } else {
        Swal.fire("ผิดพลาด", "ไม่สามารถลบได้", "error");
      }
    } catch {
      Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาดขณะลบ", "error");
    }
  }

  async function handleAddDevice(e) {
    e.preventDefault();
    
    if (!newDevice.ob_type || !newDevice.id_code_th || !newDevice.index_id_tk) {
      Swal.fire("ข้อมูลไม่ครบ", "กรุณากรอกข้อมูลให้ครบถ้วน", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/smart-health/register-object-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newDevice,
          ob_status: true,
        }),
      });

      if (res.ok) {
        Swal.fire({
          icon: "success",
          title: "เพิ่มอุปกรณ์สำเร็จ",
          showConfirmButton: false,
          timer: 1500,
        });
        setShowAddModal(false);
        setNewDevice({ ob_type: "", id_code_th: "", index_id_tk: "" });
        fetchDevices();
        if (typeof onStatusChange === "function") {
          onStatusChange();
        }
      } else {
        const data = await res.json();
        Swal.fire("ผิดพลาด", data.message || "ไม่สามารถเพิ่มอุปกรณ์ได้", "error");
      }
    } catch (error) {
      console.error("Add device error:", error);
      Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาด", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-500">กำลังโหลดข้อมูลอุปกรณ์...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">คลังอุปกรณ์</h2>
          <p className="text-xs sm:text-sm text-gray-500">
            ทั้งหมด {devices.length} | แสดง {filtered.length}
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">เพิ่มอุปกรณ์ใหม่</span>
          <span className="sm:hidden">เพิ่ม</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาอุปกรณ์..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Status Filter - Horizontal Scroll */}
      <div className="mb-4 -mx-3 px-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-max min-w-full sm:w-fit">
          <button
            onClick={() => setStatusFilter("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              statusFilter === "all"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600"
            }`}
          >
            ทั้งหมด ({statusCounts.all})
          </button>
          {Object.entries(DEVICE_STATUSES).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                statusFilter === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`}></span>
              <span className="hidden sm:inline">{config.label}</span>
              <span className="sm:hidden">{config.shortLabel}</span>
              ({statusCounts[key]})
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter - Horizontal Scroll */}
      <div className="mb-4 -mx-3 px-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 w-max">
          {obTypes.map((type) => {
            const count = type === "ทั้งหมด" ? devices.length : typeCounts[type] || 0;
            const isActive = filter === type;
            const shortType = type.length > 15 ? type.substring(0, 12) + "..." : type;
            
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`
                  flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
                  ${isActive
                    ? "bg-primary text-white shadow-md"
                    : "bg-white border border-gray-200 text-gray-700"
                  }
                `}
              >
                <span className="sm:hidden">{shortType}</span>
                <span className="hidden sm:inline">{type}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-white/20" : "bg-gray-100"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">ไม่พบอุปกรณ์</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? "ลองค้นหาด้วยคำค้นอื่น" : "ยังไม่มีอุปกรณ์ในหมวดนี้"}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="sm:hidden space-y-2">
            {filtered.map((item, idx) => {
              const id = item._id?.$oid || item._id || item.index_id_tk;
              const currentStatus = getDeviceStatus(item);
              const statusConfig = DEVICE_STATUSES[currentStatus] || DEVICE_STATUSES.available;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={id}
                  className="bg-white border border-gray-200 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-400">#{idx + 1}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.shortLabel}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.ob_type}
                      </p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        {item.index_id_tk}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {/* Status Dropdown */}
                      <div className="relative status-dropdown">
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {activeDropdown === id && (
                          <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 min-w-[140px]">
                            <div className="px-3 py-1.5 text-[10px] text-gray-500 font-medium border-b border-gray-100">
                              เปลี่ยนสถานะ
                            </div>
                            {Object.entries(DEVICE_STATUSES).map(([key, config]) => {
                              const Icon = config.icon;
                              const isCurrentStatus = currentStatus === key;
                              return (
                                <button
                                  key={key}
                                  onClick={() => handleUpdateStatus(item, key)}
                                  disabled={isCurrentStatus}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                                    isCurrentStatus
                                      ? "bg-gray-50 text-gray-400"
                                      : "hover:bg-gray-50 text-gray-700"
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${config.dotColor}`}></span>
                                  <Icon className="w-3 h-3" />
                                  {config.shortLabel}
                                  {isCurrentStatus && <Check className="w-3 h-3 ml-auto text-green-500" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteItem(item)}
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
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-12">#</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">ประเภท</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">รหัส</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Serial</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">สถานะ</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item, idx) => {
                  const id = item._id?.$oid || item._id || item.index_id_tk;
                  const currentStatus = getDeviceStatus(item);
                  const statusConfig = DEVICE_STATUSES[currentStatus] || DEVICE_STATUSES.available;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr key={id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 text-sm text-gray-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
                          {item.ob_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900 font-mono">{item.id_code_th}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 font-mono">{item.index_id_tk}</td>
                      <td className="py-3 px-4">
                        <div className="relative status-dropdown">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:shadow-sm ${statusConfig.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                            <MoreVertical className="w-3 h-3 opacity-50" />
                          </button>

                          {activeDropdown === id && (
                            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 min-w-[150px]">
                              <div className="px-3 py-1.5 text-xs text-gray-500 font-medium border-b border-gray-100">
                                เปลี่ยนสถานะ
                              </div>
                              {Object.entries(DEVICE_STATUSES).map(([key, config]) => {
                                const Icon = config.icon;
                                const isCurrentStatus = currentStatus === key;
                                return (
                                  <button
                                    key={key}
                                    onClick={() => handleUpdateStatus(item, key)}
                                    disabled={isCurrentStatus}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                                      isCurrentStatus ? "bg-gray-50 text-gray-400" : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${config.dotColor}`}></span>
                                    <Icon className="w-4 h-4" />
                                    {config.label}
                                    {isCurrentStatus && <Check className="w-4 h-4 ml-auto text-green-500" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">เพิ่มอุปกรณ์ใหม่</h3>
                  <p className="text-xs text-gray-500">กรอกข้อมูลอุปกรณ์</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddDevice} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทอุปกรณ์ *</label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
                  value={newDevice.ob_type}
                  onChange={(e) => setNewDevice({ ...newDevice, ob_type: e.target.value })}
                >
                  <option value="">เลือกประเภท</option>
                  {obTypes.filter((t) => t !== "ทั้งหมด").map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  <option value="__new__">+ เพิ่มประเภทใหม่</option>
                </select>
                {newDevice.ob_type === "__new__" && (
                  <input
                    type="text"
                    placeholder="ระบุประเภทใหม่"
                    className="mt-2 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    onChange={(e) => setNewDevice({ ...newDevice, ob_type: e.target.value })}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสอุปกรณ์ *</label>
                <input
                  type="text"
                  placeholder="เช่น ศ.สส 297"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  value={newDevice.id_code_th}
                  onChange={(e) => setNewDevice({ ...newDevice, id_code_th: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number *</label>
                <input
                  type="text"
                  placeholder="เช่น ศ.สส 297-67-0001"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                  value={newDevice.index_id_tk}
                  onChange={(e) => setNewDevice({ ...newDevice, index_id_tk: e.target.value })}
                />
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
                onClick={handleAddDevice}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${
                  isSubmitting ? "bg-gray-200 text-gray-400" : "bg-primary text-white hover:bg-primary/90"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
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

      {/* Custom CSS for hiding scrollbar */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
