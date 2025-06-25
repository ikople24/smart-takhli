import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import Image from "next/image";

export default function RequestTable({ requests = [], menu = [], loading, onDelete, onUpdateStatus }) {
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
                    }).then((result) => {
                      if (result.isConfirmed && result.value && result.value !== r.status) {
                        if (onUpdateStatus) {
                          onUpdateStatus(r._id, result.value);
                        }
                        Swal.fire("สำเร็จ", "อัปเดตสถานะเรียบร้อยแล้ว", "success");
                      }
                    });
                  }}
                  className="btn btn-sm btn-warning"
                >
                  แก้ไข
                </button>
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