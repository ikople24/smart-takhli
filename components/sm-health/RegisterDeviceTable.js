import React, { useState, useMemo, useEffect } from "react";
import { Plus, Search, Package, Trash2, X, Check, AlertTriangle, Wrench, CheckCircle, MoreVertical } from "lucide-react";
import Swal from "sweetalert2";

// Status configuration
const DEVICE_STATUSES = {
  available: {
    label: "พร้อมใช้งาน",
    color: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle,
    dotColor: "bg-green-500",
  },
  borrowed: {
    label: "ถูกยืม",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Package,
    dotColor: "bg-blue-500",
  },
  broken: {
    label: "ชำรุด",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: AlertTriangle,
    dotColor: "bg-red-500",
  },
  repair: {
    label: "ซ่อมบำรุง",
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

  // Close dropdown when clicking outside
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

  // Helper to get device status
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
    
    // Filter by status
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

  // Status counts
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

  // Count by type
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
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">คลังอุปกรณ์</h2>
          <p className="text-sm text-gray-500">
            ทั้งหมด {devices.length} รายการ | กำลังแสดง {filtered.length} รายการ
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all font-medium"
        >
          <Plus className="w-5 h-5" />
          เพิ่มอุปกรณ์ใหม่
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาอุปกรณ์..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            statusFilter === "all"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          ทั้งหมด ({statusCounts.all})
        </button>
        {Object.entries(DEVICE_STATUSES).map(([key, config]) => {
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${config.dotColor}`}></span>
              {config.label} ({statusCounts[key]})
            </button>
          );
        })}
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {obTypes.map((type) => {
          const count = type === "ทั้งหมด" ? devices.length : typeCounts[type] || 0;
          const isActive = filter === type;
          
          return (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`
                inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${isActive
                  ? "bg-primary text-white shadow-md"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
                }
              `}
            >
              {type}
              <span
                className={`
                  px-1.5 py-0.5 rounded-full text-xs
                  ${isActive ? "bg-white/20" : "bg-gray-100"}
                `}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">ไม่พบอุปกรณ์</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? "ลองค้นหาด้วยคำค้นอื่น" : "ยังไม่มีอุปกรณ์ในหมวดนี้"}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                  #
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ประเภทอุปกรณ์
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  รหัส
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Serial Number
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item, idx) => {
                const id = item._id?.$oid || item._id || item.index_id_tk;
                const currentStatus = getDeviceStatus(item);
                const statusConfig = DEVICE_STATUSES[currentStatus] || DEVICE_STATUSES.available;
                const StatusIcon = statusConfig.icon;

                return (
                  <tr
                    key={id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                        {item.ob_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 font-mono">
                      {item.id_code_th}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-mono">
                      {item.index_id_tk}
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative status-dropdown">
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm ${statusConfig.color}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                          <MoreVertical className="w-3 h-3 ml-1 opacity-50" />
                        </button>

                        {/* Status Dropdown */}
                        {activeDropdown === id && (
                          <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
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
                                    isCurrentStatus
                                      ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                                      : "hover:bg-gray-50 text-gray-700"
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${config.dotColor}`}></span>
                                  <Icon className="w-4 h-4" />
                                  {config.label}
                                  {isCurrentStatus && (
                                    <Check className="w-4 h-4 ml-auto text-green-500" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
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
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
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
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleAddDevice} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ประเภทอุปกรณ์ *
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                  value={newDevice.ob_type}
                  onChange={(e) =>
                    setNewDevice({ ...newDevice, ob_type: e.target.value })
                  }
                >
                  <option value="">เลือกประเภท</option>
                  {obTypes
                    .filter((t) => t !== "ทั้งหมด")
                    .map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  <option value="__new__">+ เพิ่มประเภทใหม่</option>
                </select>
                {newDevice.ob_type === "__new__" && (
                  <input
                    type="text"
                    placeholder="ระบุประเภทใหม่"
                    className="mt-2 w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    onChange={(e) =>
                      setNewDevice({ ...newDevice, ob_type: e.target.value })
                    }
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสอุปกรณ์ *
                </label>
                <input
                  type="text"
                  placeholder="เช่น ศ.สส 297"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={newDevice.id_code_th}
                  onChange={(e) =>
                    setNewDevice({ ...newDevice, id_code_th: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  placeholder="เช่น ศ.สส 297-67-0001"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={newDevice.index_id_tk}
                  onChange={(e) =>
                    setNewDevice({ ...newDevice, index_id_tk: e.target.value })
                  }
                />
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    isSubmitting
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      บันทึก
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
