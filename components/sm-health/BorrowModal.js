import React, { useState, useEffect } from "react";
import { User, X, Package, Calendar, CreditCard } from "lucide-react";

export default function BorrowModal({ onClose, onSuccess }) {
  const [availableDevices, setAvailableDevices] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [borrowDateTime, setBorrowDateTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [citizenId, setCitizenId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/smart-health/available-devices")
      .then((res) => res.json())
      .then((data) => setAvailableDevices(data))
      .catch((err) => console.error("Error loading devices", err));

    fetch("/api/smart-health/registered-users")
      .then((res) => res.json())
      .then((data) => setRegisteredUsers(data))
      .catch((err) => console.error("Error loading registered users", err));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showUserDropdown &&
        !event.target.closest(".user-dropdown-container")
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserDropdown]);

  // Helper function to get device types
  const getDeviceTypes = () => {
    const deviceGroups = {};
    availableDevices.forEach((device) => {
      if (device.ob_status === true) {
        const type = device.ob_type || "ไม่ระบุประเภท";
        if (!deviceGroups[type]) {
          deviceGroups[type] = [];
        }
        deviceGroups[type].push(device);
      }
    });
    return deviceGroups;
  };

  // Get available devices for selected type
  const getAvailableDevicesByType = (type) => {
    return availableDevices.filter(
      (device) => device.ob_status === true && device.ob_type === type
    );
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!citizenId || citizenId.length !== 13) {
      alert("กรุณากรอกเลขบัตรประชาชน 13 หลัก");
      return;
    }

    setIsSubmitting(true);

    const formData = {
      user: {
        ...selectedUser,
        citizenId: citizenId,
      },
      deviceType: selectedDeviceType,
      deviceId: selectedDevice,
      borrowDateTime: borrowDateTime,
    };

    try {
      const response = await fetch("/api/smart-health/borrow-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      alert(`บันทึกข้อมูลสำเร็จ!\nรหัสการยืม: ${result.borrowingId}`);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to submit borrow request:", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = registeredUsers.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm)
  );

  const isFormValid =
    selectedUser && selectedDevice && citizenId.length === 13;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">ยืมอุปกรณ์</h3>
              <p className="text-xs text-gray-500">กรอกข้อมูลการยืมอุปกรณ์</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              เลือกผู้ขอ
            </label>
            <div className="relative user-dropdown-container">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหรือเบอร์โทร"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setShowUserDropdown(true)}
                />
                <button
                  type="button"
                  className="px-3 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                >
                  <User className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {showUserDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                  <div className="p-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 sticky top-0">
                    ผู้ขอที่ผ่านการลงทะเบียน ({filteredUsers.length} รายการ)
                  </div>
                  {filteredUsers.map((user, index) => (
                    <div
                      key={index}
                      className="p-3 hover:bg-primary/5 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchTerm(user.name || "");
                        setShowUserDropdown(false);
                      }}
                    >
                      <div className="font-medium text-gray-900">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-500">{user.phone}</div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      ไม่พบผู้ขอที่ตรงกับคำค้นหา
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ชื่อ:</span>
                    <span className="font-medium">{selectedUser.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">เบอร์โทร:</span>
                    <span className="font-medium">{selectedUser.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">สถานะ:</span>
                    <span className="text-green-600 font-medium">
                      {selectedUser.status}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Citizen ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <CreditCard className="w-4 h-4 inline mr-1" />
              เลขบัตรประชาชน *
            </label>
            <input
              type="text"
              placeholder="กรอกเลขบัตรประชาชน 13 หลัก"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={citizenId}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                if (value.length <= 13) {
                  setCitizenId(value);
                }
              }}
              maxLength={13}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-500">กรุณากรอก 13 หลัก</span>
              <span
                className={`text-xs ${citizenId.length === 13 ? "text-green-600" : "text-gray-400"}`}
              >
                {citizenId.length}/13
              </span>
            </div>
          </div>

          {/* Device Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Package className="w-4 h-4 inline mr-1" />
              ประเภทอุปกรณ์
            </label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
              value={selectedDeviceType}
              onChange={(e) => {
                setSelectedDeviceType(e.target.value);
                setSelectedDevice("");
              }}
            >
              <option value="">เลือกประเภทอุปกรณ์</option>
              {Object.entries(getDeviceTypes()).map(([type, devices]) => (
                <option key={type} value={type}>
                  {type} ({devices.length} รายการ)
                </option>
              ))}
            </select>
          </div>

          {/* Device Selection */}
          {selectedDeviceType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสอุปกรณ์
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                <option value="">เลือกรหัสอุปกรณ์</option>
                {getAvailableDevicesByType(selectedDeviceType).map(
                  (device, i) => (
                    <option
                      key={i}
                      value={device.index_id_tk || device.ob_code}
                    >
                      {device.index_id_tk || device.ob_code} - {device.ob_type}
                    </option>
                  )
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                มีอุปกรณ์ว่าง{" "}
                {getAvailableDevicesByType(selectedDeviceType).length} รายการ
              </p>
            </div>
          )}

          {/* Date Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              วันที่และเวลา
            </label>
            <input
              type="datetime-local"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={borrowDateTime}
              onChange={(e) => setBorrowDateTime(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors font-medium"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all ${
              isFormValid && !isSubmitting
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                กำลังบันทึก...
              </span>
            ) : (
              "บันทึกการยืม"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
