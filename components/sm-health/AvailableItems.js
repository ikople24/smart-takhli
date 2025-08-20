// AvailableItems.js
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ArrowRight, ArrowLeft, User } from "lucide-react";

const skeletonCount = 6; // จำนวน skeleton ที่แสดงขณะโหลด

const AvailableItems = ({ menu = [], loading = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [borrowDateTime, setBorrowDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [citizenId, setCitizenId] = useState("");

  useEffect(() => {
    fetch("/api/smart-health/available-devices")
      .then((res) => res.json())
      .then((data) => setAvailableDevices(data))
      .catch((err) => console.error("Error loading devices", err));
  }, []);

  useEffect(() => {
    fetch("/api/smart-health/registered-users")
      .then((res) => res.json())
      .then((data) => setRegisteredUsers(data))
      .catch((err) => console.error("Error loading registered users", err));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.user-dropdown-container')) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  // Helper function to get device types
  const getDeviceTypes = () => {
    const deviceGroups = {};
    availableDevices.forEach(device => {
      if (device.ob_status === true) {
        const type = device.ob_type || 'ไม่ระบุประเภท';
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
    return availableDevices.filter(device => 
      device.ob_status === true && device.ob_type === type
    );
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate citizen ID
    if (!citizenId || citizenId.length !== 13) {
      alert("กรุณากรอกเลขบัตรประชาชน 13 หลัก");
      return;
    }

    const formData = {
      user: {
        ...selectedUser,
        citizenId: citizenId
      },
      deviceType: selectedDeviceType,
      deviceId: selectedDevice,
      borrowDateTime: borrowDateTime
    };

    console.log("=== ข้อมูลการยืมอุปกรณ์ ===");
    console.log("ผู้ขอ:", formData.user);
    console.log("ประเภทอุปกรณ์:", formData.deviceType);
    console.log("รหัสอุปกรณ์:", formData.deviceId);
    console.log("วันที่และเวลา:", formData.borrowDateTime);
    console.log("==========================");

    try {
      const response = await fetch('/api/smart-health/borrow-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }

      console.log("=== ผลลัพธ์จาก API ===");
      console.log("รหัสการยืม:", result.borrowingId);
      console.log("ข้อความ:", result.message);
      console.log("======================");

      alert(`บันทึกข้อมูลสำเร็จ!\nรหัสการยืม: ${result.borrowingId}\nดูข้อมูลเพิ่มเติมใน Console (F12)`);

      // Reset form
      setShowModal(false);
      setSelectedUser(null);
      setSearchTerm("");
      setShowUserDropdown(false);
      setSelectedDeviceType("");
      setSelectedDevice("");
      setBorrowDateTime(new Date().toISOString().slice(0, 16));
      setCitizenId("");

      // Refresh available devices
      fetch("/api/smart-health/available-devices")
        .then((res) => res.json())
        .then((data) => setAvailableDevices(data))
        .catch((err) => console.error("Error refreshing devices", err));

    } catch (error) {
      console.error("Failed to submit borrow request:", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  return (
    <div className="mt-6 p-4 bg-gray-100 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">รายการพร้อมยืม</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-center">
        {loading
          ? Array.from({ length: skeletonCount }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-md p-3 w-full max-w-[130px] sm:max-w-[150px] flex flex-col items-center mx-auto animate-pulse"
              >
                <div className="skeleton h-14 w-14 mb-2 rounded-full bg-gray-300"></div>
                <div className="skeleton h-4 w-16 mb-1 rounded bg-gray-200"></div>
                <div className="skeleton h-3 w-10 mb-1 rounded bg-gray-100"></div>
                <div className="skeleton h-3 w-14 rounded bg-gray-100"></div>
              </div>
            ))
          : menu.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-md p-3 w-full max-w-[130px] sm:max-w-[150px] flex flex-col items-center mx-auto"
              >
                <div className="w-14 h-14 relative">
                  <Image
                    src={item.image_icon || "/default-icon.png"}
                    alt={`icon of ${item.image_icon}`}
                    fill
                    className="object-contain"
                  />
                </div>
                <div className="mt-2 text-center font-semibold text-sm">{item.label}</div>
                {item.available > 0 ? (
                  <div className="text-green-600 text-sm mt-1">✅ พร้อมยืม</div>
                ) : (
                  <div className="text-red-500 text-sm mt-1">⛔️ ไม่พร้อมยืม</div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {typeof item.available === "number" ? item.available : 0} รายการ
                </div>
              </div>
            ))}
      </div>
      <div className="mt-6 flex justify-center gap-4">
        <button
          className="btn btn-success flex items-center gap-2"
          onClick={() => setShowModal(true)}
        >
          <ArrowRight className="w-4 h-4" />
          ยืมอุปกรณ์
        </button>
        <button 
          className="btn btn-warning flex items-center gap-2"
          onClick={() => {
            // Navigate to return page
            window.location.href = '/admin/smart-health-return';
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          คืนอุปกรณ์
        </button>

      </div>
              {showModal && (
          <dialog className="modal modal-open">
            <div className="modal-box max-w-md">
              <h3 className="font-bold text-lg mb-4">ฟอร์มยืมอุปกรณ์</h3>
              <div className="space-y-4">
                                <div>
                  <label className="label">
                    <span className="label-text">เลือกผู้ขอ</span>
                  </label>
                  <div className="relative user-dropdown-container">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ค้นหาชื่อหรือเบอร์โทร"
                        className="input input-bordered w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setShowUserDropdown(true)}
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                      >
                        <User className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {showUserDropdown && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        <div className="p-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                          ผู้ขอที่ผ่านการลงทะเบียนอุปกรณ์ ({registeredUsers.filter(user => 
                            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.phone?.includes(searchTerm)
                          ).length} รายการ)
                        </div>
                        {registeredUsers
                          .filter(user => 
                            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.phone?.includes(searchTerm)
                          )
                          .map((user, index) => (
                            <div
                              key={index}
                              className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                              onClick={() => {
                                setSelectedUser(user);
                                setSearchTerm(user.name || '');
                                setShowUserDropdown(false);
                              }}
                            >
                              <div className="font-medium">{user.name}</div>
                              <div className="text-sm text-gray-600">{user.phone}</div>
                              <div className="text-xs text-green-600">✓ {user.status}</div>
                            </div>
                          ))}
                        {registeredUsers.filter(user => 
                          user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.phone?.includes(searchTerm)
                        ).length === 0 && (
                          <div className="p-3 text-gray-500 text-center">
                            ไม่พบผู้ขอที่ผ่านการลงทะเบียนอุปกรณ์
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                                     {selectedUser && (
                     <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                       <div className="text-sm">
                         <div><strong>ชื่อ:</strong> {selectedUser.name}</div>
                         <div><strong>เบอร์โทร:</strong> {selectedUser.phone}</div>
                         <div><strong>สถานะ:</strong> <span className="text-green-600">{selectedUser.status}</span></div>
                       </div>
                     </div>
                   )}
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">เลขบัตรประชาชน *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="กรอกเลขบัตรประชาชน 13 หลัก"
                    className="input input-bordered w-full"
                    value={citizenId}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Only allow digits
                      if (value.length <= 13) {
                        setCitizenId(value);
                      }
                    }}
                    maxLength={13}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    กรุณากรอกเลขบัตรประชาชน 13 หลัก
                  </div>
                </div>
                
                <div>
                  <label className="label">
                    <span className="label-text">ประเภทอุปกรณ์</span>
                  </label>
                  <select 
                    className="select select-bordered w-full"
                    value={selectedDeviceType}
                    onChange={(e) => {
                      setSelectedDeviceType(e.target.value);
                      setSelectedDevice(""); // Reset device selection when type changes
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

                {selectedDeviceType && (
                  <div>
                    <label className="label">
                      <span className="label-text">รหัสอุปกรณ์</span>
                    </label>
                    <select 
                      className="select select-bordered w-full"
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                    >
                      <option value="">เลือกรหัสอุปกรณ์</option>
                      {getAvailableDevicesByType(selectedDeviceType).map((device, i) => (
                        <option key={i} value={device.index_id_tk || device.ob_code}>
                          {device.index_id_tk || device.ob_code} - {device.ob_type}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-500 mt-1">
                      มีอุปกรณ์ว่าง {getAvailableDevicesByType(selectedDeviceType).length} รายการ
                    </div>
                    
                    {selectedDevice && (
                      <div className="mt-2 p-3 bg-green-50 rounded-lg">
                        <div className="text-sm">
                          <div><strong>อุปกรณ์ที่เลือก:</strong></div>
                          <div>{selectedDevice}</div>
                          <div className="text-gray-600">{selectedDeviceType}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <label className="label">
                    <span className="label-text">วันที่และเวลา</span>
                  </label>
                  <input 
                    type="datetime-local" 
                    className="input input-bordered w-full"
                    value={borrowDateTime}
                    onChange={(e) => setBorrowDateTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-action">
                <button 
                  className={`btn ${
                    selectedUser && selectedDevice && citizenId.length === 13 ? 'btn-primary' : 'btn-disabled'
                  }`}
                  disabled={!selectedUser || !selectedDevice || citizenId.length !== 13}
                  onClick={handleSubmit}
                >
                  บันทึก
                </button>
                <button 
                  className="btn" 
                  onClick={() => {
                    setShowModal(false);
                    setSelectedUser(null);
                    setSearchTerm("");
                    setShowUserDropdown(false);
                    setSelectedDeviceType("");
                    setSelectedDevice("");
                    setBorrowDateTime(new Date().toISOString().slice(0, 16));
                    setCitizenId("");
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </dialog>
        )}
    </div>
  );
};

export default AvailableItems;