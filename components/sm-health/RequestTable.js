import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import Image from "next/image";
import { MapPin } from "lucide-react";

export default function RequestTable({ requests = [], menu = [], loading, onDelete }) {
  const [delayPassed, setDelayPassed] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setDelayPassed(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setDelayPassed(false);
    }
  }, [loading]);

  if (loading && delayPassed) {
    return (
      <div className="overflow-x-auto mt-6">
        <h1 className="text-xl font-bold mb-4">รายการผู้ขอกายอุปกรณ์</h1>
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>อุปกรณ์</th>
              <th>เหตุผล</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...Array(3)].map((_, i) => (
              <tr key={i}>
                <td><div className="skeleton h-4 w-24" /></td>
                <td><div className="skeleton h-4 w-24" /></td>
                <td><div className="skeleton h-4 w-20" /></td>
                <td><div className="skeleton h-4 w-16" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto mt-6">
      <h1 className="text-xl font-bold mb-4">รายการผู้ขอกายอุปกรณ์</h1>
      <table className="table table-sm w-full">
        <thead>
          <tr>
            <th>#</th>
            <th>อุปกรณ์</th>
            <th>เหตุผล</th>
            <th>สถานะ</th>
            <th>ส่งเมื่อ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r, i) => (
            <tr key={r._id}>
              <th>{i + 1}</th>
              <td className="flex items-center gap-2">
                {(() => {
                  const item = menu.find((m) => m.label === r.equipment || m.shot_name === r.equipment);
                  return item?.image_icon ? (
                    <>
                      <Image src={item.image_icon} alt={r.equipment} width={24} height={24} className="object-contain" />
                      <span>{r.equipment}</span>
                    </>
                  ) : (
                    <span>{r.equipment}</span>
                  );
                })()}
              </td>
              <td>{r.reason}</td>
              <td>
                {(() => {
                  const status = r.status || "รับคำร้อง";
                  const statusMap = {
                    "รับคำร้อง": {
                      text: "รับคำร้อง",
                      icon: "🟡",
                      className: "border border-yellow-400 text-yellow-600"
                    },
                    "ประเมินโดยพยาบาลวิชาชีพ": {
                      text: "ประเมินโดยพยาบาลวิชาชีพ",
                      icon: "🩺",
                      className: "border border-blue-400 text-blue-600"
                    },
                    "ลงทะเบียนอุปกรณ์": {
                      text: "ลงทะเบียนอุปกรณ์",
                      icon: "📝",
                      className: "border border-orange-400 text-orange-600"
                    },
                    "ส่งมอบอุปกรณ์": {
                      text: "ส่งมอบอุปกรณ์",
                      icon: "📦",
                      className: "border border-green-400 text-green-600"
                    }
                  };
                  const s = statusMap[status] || {
                    text: status,
                    icon: "ℹ️",
                    className: "border border-gray-400 text-gray-600"
                  };
                  return (
                    <div className={`rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2 ${s.className}`}>
                      <span>{s.icon}</span>
                      <span className="font-medium">{s.text}</span>
                    </div>
                  );
                })()}
              </td>
              <td>{new Date(r.submitted_at).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric"
              })}</td>
              <td className="flex gap-1">
                <button
                  onClick={() =>
                    Swal.fire({
                      title: "ข้อมูล",
                      html: `
                        <div style="text-align:left">
                          <p><b>ชื่อ:</b> ${r.name}</p>
                          <p><b>เบอร์โทร:</b> ${r.phone}</p>
                          <p><b>อุปกรณ์:</b> ${r.equipment}</p>
                          <p><b>เหตุผล:</b> ${r.reason}</p>
                          <p><b>ตำแหน่ง:</b> ${r.location ? (r.location.lat && r.location.lng ? `${r.location.lat}, ${r.location.lng}` : r.location) : "ไม่ระบุ"}</p>
                          ${r.location && r.location.lat && r.location.lng ? `<p><b>ลิงก์แผนที่:</b> <a href="https://www.google.com/maps?q=${r.location.lat},${r.location.lng}&z=15" target="_blank" style="color: blue; text-decoration: underline;">เปิด Google Maps</a></p>` : ''}
                          <p><b>สถานะ:</b> ${r.status || "รับคำร้อง"}</p>
                          <p><b>ส่งเมื่อ:</b> ${new Date(r.submitted_at).toLocaleString()}</p>
                        </div>
                      `,
                    })
                  }
                  className="btn btn-sm btn-info"
                >
                  ดูข้อมูล
                </button>
                <button
                  onClick={() => {
                    // Debug: แสดงข้อมูล location
                    console.log("Location data:", r.location);
                    console.log("Location type:", typeof r.location);
                    if (r.location && r.location.lat && r.location.lng) {
                      console.log("Coordinates:", `${r.location.lat}, ${r.location.lng}`);
                      console.log("Google Maps URL:", `https://www.google.com/maps?q=${r.location.lat},${r.location.lng}&z=15`);
                    }
                    console.log("Full request data:", r);
                    
                    // เปิด Google Maps ในแท็บใหม่
                    if (r.location && r.location.lat && r.location.lng) {
                      // ใช้ coordinates ถ้ามี - แสดงหมุดที่ตำแหน่งนั้นเลย
                      const googleMapsUrl = `https://www.google.com/maps?q=${r.location.lat},${r.location.lng}&z=15`;
                      console.log("Opening coordinates URL:", googleMapsUrl);
                      window.open(googleMapsUrl, '_blank');
                    } else if (r.location && typeof r.location === 'string') {
                      // ใช้ string location
                      const encodedLocation = encodeURIComponent(r.location);
                      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}&z=15`;
                      console.log("Opening string URL:", googleMapsUrl);
                      window.open(googleMapsUrl, '_blank');
                    } else {
                      // ถ้าไม่มี location ให้แสดง alert
                      Swal.fire({
                        title: "ไม่พบข้อมูลตำแหน่ง",
                        text: "ไม่มีการระบุตำแหน่งในข้อมูลนี้",
                        icon: "info"
                      });
                    }
                    
                    // ทดสอบ URL ตัวอย่าง
                    console.log("Test URLs:");
                    console.log("Coordinates example:", "https://www.google.com/maps/search/?api=1&query=13.7563,100.5018");
                    console.log("String example:", "https://www.google.com/maps/search/?api=1&query=โรงพยาบาลตาคลี");
                  }}
                  className="btn btn-sm btn-primary"
                  title={r.location ? (r.location.lat && r.location.lng ? `เปิดแผนที่ที่ตำแหน่ง: ${r.location.lat}, ${r.location.lng}` : `เปิดแผนที่: ${r.location}`) : "ไม่พบข้อมูลตำแหน่ง"}
                >
                  <MapPin className="w-3 h-3" />
                  แผนที่
                </button>
                
                {/* ปุ่มการดำเนินการตามสถานะ */}
                {(() => {
                  const currentStatus = r.status || "รับคำร้อง";
                  
                  switch (currentStatus) {
                    case "รับคำร้อง":
                      return (
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: "ประเมินโดยพยาบาลวิชาชีพ",
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
                          className="btn btn-sm btn-primary"
                        >
                          🩺 ประเมิน
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
                          className="btn btn-sm btn-warning"
                        >
                          📝 ลงทะเบียน
                        </button>
                      );
                      
                    case "ลงทะเบียนอุปกรณ์":
                      return (
                        <button
                          onClick={async () => {
                            const result = await Swal.fire({
                              title: "ส่งมอบอุปกรณ์",
                              text: "ยืนยันการส่งมอบอุปกรณ์และสร้างรายการยืม?",
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
                                    html: `
                                      <p>ส่งมอบอุปกรณ์แล้ว</p>
                                      <p><strong>รหัสการยืม:</strong> ${data.borrowId}</p>
                                    `,
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
                          className="btn btn-sm btn-success"
                        >
                          📦 ส่งมอบ
                        </button>
                      );
                      
                    case "ส่งมอบอุปกรณ์":
                      return (
                        <div className="text-sm text-green-600 font-medium">
                          ✅ เสร็จสิ้น
                        </div>
                      );
                      
                    default:
                      return (
                        <button
                          onClick={async () => {
                            Swal.fire({
                              title: "แก้ไขสถานะ",
                              html: `
                                <div style="margin-top: 1rem;">
                                  <label for="statusSelect" style="display: block; margin-bottom: 0.5rem;">เลือกสถานะใหม่</label>
                                  <select id="statusSelect" class="swal2-input" style="width: 100%; padding: 0.5rem;">
                                    <option value="รับคำร้อง">รับคำร้อง</option>
                                    <option value="ประเมินโดยพยาบาลวิชาชีพ">ประเมินโดยพยาบาลวิชาชีพ</option>
                                    <option value="ลงทะเบียนอุปกรณ์">ลงทะเบียนอุปกรณ์</option>
                                    <option value="ส่งมอบอุปกรณ์">ส่งมอบอุปกรณ์</option>
                                  </select>
                                </div>
                              `,
                              preConfirm: () => {
                                const selected = document.getElementById("statusSelect").value;
                                if (!selected) {
                                  Swal.showValidationMessage("กรุณาเลือกสถานะ");
                                }
                                return selected;
                              },
                              showCancelButton: true,
                              confirmButtonText: "บันทึก",
                              cancelButtonText: "ยกเลิก",
                            }).then(async (result) => {
                              if (result.isConfirmed && result.value && result.value !== r.status) {
                                try {
                                  const response = await fetch(`/api/smart-health/update-request-status?id=${r._id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ 
                                      status: result.value,
                                      action: "manual"
                                    })
                                  });
                                  
                                  if (response.ok) {
                                    Swal.fire("สำเร็จ", "อัปเดตสถานะเรียบร้อยแล้ว", "success");
                                    window.location.reload();
                                  } else {
                                    Swal.fire("ผิดพลาด", "ไม่สามารถอัปเดตสถานะได้", "error");
                                  }
                                } catch (error) {
                                  console.error("Update status error:", error);
                                  Swal.fire("ผิดพลาด", "เกิดข้อผิดพลาดในการอัปเดต", "error");
                                }
                              }
                            });
                          }}
                          className="btn btn-sm btn-warning"
                        >
                          แก้ไข
                        </button>
                      );
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
                  className="btn btn-sm btn-error"
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}