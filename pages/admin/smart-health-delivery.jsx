import React, { useState, useEffect } from "react";
import { PackageCheck, Search, User, Calendar, ArrowLeft, MapPin } from "lucide-react";

export default function SmartHealthDeliveryPage() {
  const [borrowedDevices, setBorrowedDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    fetchBorrowedDevices();
  }, []);

  const fetchBorrowedDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/smart-health/borrowed-devices');
      const data = await response.json();
      setBorrowedDevices(data);
    } catch (error) {
      console.error("Failed to fetch borrowed devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelivery = async (borrowId) => {
    try {
      console.log("กำลังส่งมอบอุปกรณ์:", borrowId);
      
      const response = await fetch('/api/smart-health/deliver-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowId })
      });

      const result = await response.json();

      if (response.ok) {
        console.log("ส่งมอบสำเร็จ:", result);
        alert("ส่งมอบอุปกรณ์สำเร็จ!");
        
        // Refresh data immediately
        await fetchBorrowedDevices();
      } else {
        console.error("ส่งมอบไม่สำเร็จ:", result);
        alert(`เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error("Failed to deliver device:", error);
      alert("เกิดข้อผิดพลาดในการส่งมอบอุปกรณ์");
    }
  };



  const filteredDevices = borrowedDevices.filter(device =>
    device.id_use_object?.includes(searchTerm) ||
    device.index_id_tk?.includes(searchTerm) ||
    device.id_personal_use?.includes(searchTerm) ||
    device.requestInfo?.name?.includes(searchTerm) ||
    device.requestInfo?.phone?.includes(searchTerm) ||
    device.requestInfo?.equipment?.includes(searchTerm)
  );

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => window.history.back()}
          className="btn btn-outline btn-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          กลับ
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
          จัดการการส่งมอบอุปกรณ์
        </h1>
      </div>

      <div className="mb-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="ค้นหารหัสการยืม, รหัสอุปกรณ์, หรือเลขบัตรประชาชน"
              className="input input-bordered pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchBorrowedDevices}
            className="btn btn-outline"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>รหัสการยืม</th>
                <th>ชื่อผู้ยืม</th>
                <th>เบอร์โทร</th>
                <th>อุปกรณ์</th>
                <th>เหตุผล</th>
                <th>วันที่ยืม</th>
                <th>สถานะ</th>
                <th>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-500">
                    {searchTerm ? "ไม่พบข้อมูลที่ค้นหา" : "ไม่มีอุปกรณ์ที่ถูกยืม"}
                  </td>
                </tr>
              ) : (
                filteredDevices.map((device, index) => (
                  <tr key={device._id || index}>
                    <td className="font-mono">{device.id_use_object}</td>
                    <td>{device.requestInfo?.name || "ไม่ระบุ"}</td>
                    <td>{device.requestInfo?.phone || device.id_personal_use}</td>
                    <td>{device.requestInfo?.equipment || device.index_id_tk}</td>
                    <td>{device.requestInfo?.reason || "ไม่ระบุ"}</td>
                    <td>{device.date_lend}</td>
                    <td>
                      <span className={`badge ${
                        device.date_return && device.date_return !== "" && device.date_return !== "_" && device.date_return !== "-" ? 'badge-success' : 'badge-warning'
                      }`}>
                        {device.date_return && device.date_return !== "" && device.date_return !== "_" && device.date_return !== "-" ? 'ส่งมอบแล้ว' : 'รอส่งมอบ'}
                      </span>
                    </td>
                    <td className="flex gap-1">
                      {(!device.date_return || device.date_return === "" || device.date_return === "_" || device.date_return === "-") && (
                        <button
                          onClick={() => handleDelivery(device.id_use_object)}
                          className="btn btn-success btn-sm flex items-center gap-2"
                        >
                          <PackageCheck className="w-3 h-3" />
                          ส่งมอบ
                        </button>
                      )}
                      <button
                        onClick={() => {
                          // เปิด Google Maps ในแท็บใหม่
                          const location = "โรงพยาบาลตาคลี"; // ใช้ตำแหน่งโรงพยาบาลเป็นค่าเริ่มต้น
                          const encodedLocation = encodeURIComponent(location);
                          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
                          window.open(googleMapsUrl, '_blank');
                        }}
                        className="btn btn-primary btn-sm flex items-center gap-2"
                        title="เปิดแผนที่: โรงพยาบาลตาคลี"
                      >
                        <MapPin className="w-3 h-3" />
                        แผนที่
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-gray-600">
        แสดง {filteredDevices.length} รายการจากทั้งหมด {borrowedDevices.length} รายการ
      </div>
    </div>
  );
}
