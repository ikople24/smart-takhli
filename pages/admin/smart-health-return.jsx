import React, { useState, useEffect } from "react";
import { ArrowLeft, Search, PackageCheck } from "lucide-react";

export default function SmartHealthReturnPage() {
  const [activeBorrows, setActiveBorrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchActiveBorrows();
  }, []);

  const fetchActiveBorrows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/smart-health/active-borrows');
      const data = await response.json();
      setActiveBorrows(data);
    } catch (error) {
      console.error("Failed to fetch active borrows:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (borrowId) => {
    try {
      console.log("กำลังคืนอุปกรณ์:", borrowId);
      
      const response = await fetch('/api/smart-health/return-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowId })
      });

      const result = await response.json();

      if (response.ok) {
        console.log("คืนสำเร็จ:", result);
        alert("คืนอุปกรณ์สำเร็จ!");
        
        // Refresh data immediately
        await fetchActiveBorrows();
      } else {
        console.error("คืนไม่สำเร็จ:", result);
        alert(`เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error("Failed to return device:", error);
      alert("เกิดข้อผิดพลาดในการคืนอุปกรณ์");
    }
  };

  const fixDateFormats = async () => {
    try {
      console.log("กำลังแปลงรูปแบบวันที่...");
      
      const response = await fetch('/api/smart-health/fix-date-formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok) {
        console.log("แปลงรูปแบบวันที่สำเร็จ:", result);
        alert(`แปลงรูปแบบวันที่สำเร็จ!\nจำนวนรายการทั้งหมด: ${result.totalRecords}\nจำนวนรายการที่อัปเดต: ${result.updatedRecords}\nจำนวนรายการที่ยังไม่ได้คืน: ${result.activeBorrows}`);
        
        // Refresh data immediately
        await fetchActiveBorrows();
      } else {
        console.error("แปลงรูปแบบวันที่ไม่สำเร็จ:", result);
        alert(`เกิดข้อผิดพลาด: ${result.message}`);
      }
    } catch (error) {
      console.error("Failed to fix date formats:", error);
      alert("เกิดข้อผิดพลาดในการแปลงรูปแบบวันที่");
    }
  };

  const filteredBorrows = activeBorrows.filter(borrow =>
    borrow.id_use_object?.includes(searchTerm) ||
    borrow.index_id_tk?.includes(searchTerm) ||
    borrow.id_personal_use?.includes(searchTerm)
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
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 text-transparent bg-clip-text">
          จัดการการคืนอุปกรณ์
        </h1>
        {activeBorrows.length > 0 && (
          <div className="text-sm text-gray-600">
            รายการที่ยังไม่ได้คืน: <span className="font-bold text-orange-600">{activeBorrows.length}</span> รายการ
          </div>
        )}
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
            onClick={fetchActiveBorrows}
            className="btn btn-outline"
          >
            รีเฟรช
          </button>
          <button
            onClick={fixDateFormats}
            className="btn btn-warning"
          >
            แปลงรูปแบบวันที่
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
                <th>เลขบัตรประชาชน</th>
                <th>อุปกรณ์</th>
                <th>วันที่ยืม</th>
                <th>สถานะ</th>
                <th>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredBorrows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    {searchTerm ? "ไม่พบข้อมูลที่ค้นหา" : "ไม่มีอุปกรณ์ที่ถูกยืม"}
                  </td>
                </tr>
              ) : (
                filteredBorrows.map((borrow, index) => (
                  <tr key={borrow._id || index}>
                    <td className="font-mono">{borrow.id_use_object}</td>
                    <td>{borrow.id_personal_use}</td>
                    <td>{borrow.index_id_tk}</td>
                    <td>{borrow.date_lend}</td>
                    <td>
                      <span className="badge badge-warning">
                        ถูกยืม
                      </span>
                    </td>
                    <td>
                      {(!borrow.date_return || borrow.date_return === "" || borrow.date_return === "_" || borrow.date_return === "-") && (
                        <button
                          onClick={() => handleReturn(borrow.id_use_object)}
                          className="btn btn-error btn-sm flex items-center gap-2"
                        >
                          <PackageCheck className="w-3 h-3" />
                          คืน
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-gray-600">
        แสดง {filteredBorrows.length} รายการจากทั้งหมด {activeBorrows.length} รายการ
        {activeBorrows.length >= 42 && (
          <div className="mt-2 text-green-600 font-medium">
            ✅ ดึงข้อมูลครบถ้วนแล้ว! (มากกว่า 40 รายการ)
          </div>
        )}
      </div>
    </div>
  );
}
