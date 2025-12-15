import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import Image from "next/image";
import { MapPin, Search, Filter } from "lucide-react";

export default function RequestTable({ requests = [], menu = [], loading, onDelete }) {
  const [delayPassed, setDelayPassed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setDelayPassed(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setDelayPassed(false);
    }
  }, [loading]);

  // Filter requests by search term
  const filteredRequests = requests.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.equipment?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.phone?.includes(searchTerm)
  );

  if (loading && delayPassed) {
    return (
      <div className="p-4 sm:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded-xl w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">รายการคำขออุปกรณ์</h2>
          <p className="text-sm text-gray-500">{filteredRequests.length} รายการ</p>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ, อุปกรณ์, เบอร์โทร..."
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">ไม่พบรายการ</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? "ลองค้นหาด้วยคำค้นอื่น" : "ยังไม่มีคำขออุปกรณ์ในขณะนี้"}
          </p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ผู้ขอ</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">อุปกรณ์</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">สถานะ</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">วันที่</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
          {filteredRequests.map((r, i) => (
            <tr key={r._id} className="hover:bg-gray-50/50 transition-colors">
              <td className="py-3 px-4 text-sm text-gray-500">{i + 1}</td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                    {r.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.phone}</div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                {(() => {
                  const item = menu.find((m) => m.label === r.equipment || m.shot_name === r.equipment);
                  return item?.image_icon ? (
                    <>
                      <Image src={item.image_icon} alt={r.equipment} width={24} height={24} className="object-contain" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{r.equipment}</div>
                        <div className="text-xs text-gray-500 max-w-[150px] truncate">{r.reason}</div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{r.equipment}</div>
                      <div className="text-xs text-gray-500 max-w-[150px] truncate">{r.reason}</div>
                    </div>
                  );
                })()}
                </div>
              </td>
              <td className="py-3 px-4">
                {(() => {
                  const status = r.status || "รับคำร้อง";
                  const statusMap = {
                    "รับคำร้อง": {
                      text: "รับคำร้อง",
                      className: "bg-yellow-50 text-yellow-700 border-yellow-200"
                    },
                    "ประเมินโดยพยาบาลวิชาชีพ": {
                      text: "ประเมิน",
                      className: "bg-blue-50 text-blue-700 border-blue-200"
                    },
                    "ลงทะเบียนอุปกรณ์": {
                      text: "ลงทะเบียน",
                      className: "bg-orange-50 text-orange-700 border-orange-200"
                    },
                    "ส่งมอบอุปกรณ์": {
                      text: "ส่งมอบแล้ว",
                      className: "bg-green-50 text-green-700 border-green-200"
                    }
                  };
                  const s = statusMap[status] || {
                    text: status,
                    className: "bg-gray-50 text-gray-700 border-gray-200"
                  };
                  return (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${s.className}`}>
                      {s.text}
                    </span>
                  );
                })()}
              </td>
              <td className="py-3 px-4">
                <div className="text-sm text-gray-900">
                  {new Date(r.submitted_at).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit"
                  })}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(r.submitted_at).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() =>
                    Swal.fire({
                      title: "รายละเอียดคำขอ",
                      html: `
                        <div style="text-align:left; font-size: 14px;">
                          <p style="margin-bottom: 8px;"><b>ชื่อ:</b> ${r.name}</p>
                          <p style="margin-bottom: 8px;"><b>เบอร์โทร:</b> ${r.phone}</p>
                          <p style="margin-bottom: 8px;"><b>อุปกรณ์:</b> ${r.equipment}</p>
                          <p style="margin-bottom: 8px;"><b>เหตุผล:</b> ${r.reason}</p>
                          <p style="margin-bottom: 8px;"><b>ตำแหน่ง:</b> ${r.location ? (r.location.lat && r.location.lng ? `${r.location.lat}, ${r.location.lng}` : r.location) : "ไม่ระบุ"}</p>
                          ${r.location && r.location.lat && r.location.lng ? `<p style="margin-bottom: 8px;"><b>ลิงก์แผนที่:</b> <a href="https://www.google.com/maps?q=${r.location.lat},${r.location.lng}&z=15" target="_blank" style="color: #3b82f6; text-decoration: underline;">เปิด Google Maps</a></p>` : ''}
                          <p style="margin-bottom: 8px;"><b>สถานะ:</b> ${r.status || "รับคำร้อง"}</p>
                          <p><b>ส่งเมื่อ:</b> ${new Date(r.submitted_at).toLocaleString("th-TH")}</p>
                        </div>
                      `,
                    })
                  }
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="ดูข้อมูล"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (r.location && r.location.lat && r.location.lng) {
                      const googleMapsUrl = `https://www.google.com/maps?q=${r.location.lat},${r.location.lng}&z=15`;
                      window.open(googleMapsUrl, '_blank');
                    } else if (r.location && typeof r.location === 'string') {
                      const encodedLocation = encodeURIComponent(r.location);
                      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}&z=15`;
                      window.open(googleMapsUrl, '_blank');
                    } else {
                      Swal.fire({
                        title: "ไม่พบข้อมูลตำแหน่ง",
                        text: "ไม่มีการระบุตำแหน่งในข้อมูลนี้",
                        icon: "info"
                      });
                    }
                  }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="ดูแผนที่"
                >
                  <MapPin className="w-4 h-4" />
                </button>
                
                {/* Action Button by Status */}
                {(() => {
                  const currentStatus = r.status || "รับคำร้อง";
                  const buttonClass = "px-3 py-1.5 text-xs font-medium rounded-lg transition-all";
                  
                  switch (currentStatus) {
                    case "รับคำร้อง":
                      return (
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: "ประเมินโดยพยาบาล",
                              text: "ยืนยันการประเมินโดยพยาบาลวิชาชีพ?",
                              icon: "question",
                              showCancelButton: true,
                              confirmButtonText: "ยืนยัน",
                              cancelButtonText: "ยกเลิก",
                            });
                            
                            if (result.isConfirmed) {
                              try {
                                const response = await fetch(`/api/smart-health/update-request-status?id=${r._id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ 
                                    status: "ประเมินโดยพยาบาลวิชาชีพ",
                                    action: "assess"
                                  })
                                });
                                
                                if (response.ok) {
                                  Swal.fire("สำเร็จ", "ประเมินโดยพยาบาลวิชาชีพแล้ว", "success");
                                  window.location.reload();
                                } else {
                                  Swal.fire("ผิดพลาด", "ไม่สามารถอัปเดตสถานะได้", "error");
                                }
                              } catch (error) {
                                console.error("Update status error:", error);
                                Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาดในการอัปเดต", "error");
                              }
                            }
                          }}
                          className={`${buttonClass} bg-blue-500 text-white hover:bg-blue-600`}
                        >
                          ประเมิน
                        </button>
                      );
                      
                    case "ประเมินโดยพยาบาลวิชาชีพ":
                      return (
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: "ลงทะเบียนอุปกรณ์",
                              text: "ยืนยันการลงทะเบียนอุปกรณ์?",
                              icon: "question",
                              showCancelButton: true,
                              confirmButtonText: "ยืนยัน",
                              cancelButtonText: "ยกเลิก",
                            });
                            
                            if (result.isConfirmed) {
                              try {
                                const response = await fetch(`/api/smart-health/update-request-status?id=${r._id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ 
                                    status: "ลงทะเบียนอุปกรณ์",
                                    action: "register"
                                  })
                                });
                                
                                if (response.ok) {
                                  Swal.fire("สำเร็จ", "ลงทะเบียนอุปกรณ์แล้ว", "success");
                                  window.location.reload();
                                } else {
                                  Swal.fire("ผิดพลาด", "ไม่สามารถอัปเดตสถานะได้", "error");
                                }
                              } catch (error) {
                                console.error("Update status error:", error);
                                Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาดในการอัปเดต", "error");
                              }
                            }
                          }}
                          className={`${buttonClass} bg-orange-500 text-white hover:bg-orange-600`}
                        >
                          ลงทะเบียน
                        </button>
                      );
                      
                    case "ลงทะเบียนอุปกรณ์":
                      return (
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: "ส่งมอบอุปกรณ์",
                              text: "ยืนยันการส่งมอบอุปกรณ์?",
                              icon: "question",
                              showCancelButton: true,
                              confirmButtonText: "ยืนยัน",
                              cancelButtonText: "ยกเลิก",
                            });
                            
                            if (result.isConfirmed) {
                              try {
                                const response = await fetch(`/api/smart-health/update-request-status?id=${r._id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ 
                                    status: "ส่งมอบอุปกรณ์",
                                    action: "borrow"
                                  })
                                });
                                
                                const data = await response.json();
                                
                                if (response.ok) {
                                  Swal.fire({
                                    title: "ส่งมอบสำเร็จ!",
                                    html: `<p>รหัสการยืม: <strong>${data.borrowId}</strong></p>`,
                                    icon: "success"
                                  });
                                  window.location.reload();
                                } else {
                                  Swal.fire("ผิดพลาด", data.message || "ไม่สามารถอัปเดตสถานะได้", "error");
                                }
                              } catch (error) {
                                console.error("Update status error:", error);
                                Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาดในการอัปเดต", "error");
                              }
                            }
                          }}
                          className={`${buttonClass} bg-green-500 text-white hover:bg-green-600`}
                        >
                          ส่งมอบ
                        </button>
                      );
                      
                    case "ส่งมอบอุปกรณ์":
                      return (
                        <span className="px-2 py-1 text-xs text-green-600 bg-green-50 rounded-full">
                          ✓ เสร็จสิ้น
                        </span>
                      );
                      
                    default:
                      return null;
                  }
                })()}
                
                <button
                  onClick={() =>
                    Swal.fire({
                      title: "ยืนยันการลบ?",
                      text: "คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonColor: "#d33",
                      cancelButtonColor: "#3085d6",
                      confirmButtonText: "ใช่, ลบเลย",
                      cancelButtonText: "ยกเลิก",
                    }).then((result) => {
                      if (result.isConfirmed) {
                        onDelete(r._id);
                        Swal.fire("ลบแล้ว!", "ลบรายการเรียบร้อยแล้ว", "success");
                      }
                    })
                  }
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="ลบ"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                </div>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}