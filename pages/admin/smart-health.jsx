import {
  CircleDot,
  Stethoscope,
  ClipboardCheck,
  PackageCheck,
} from "lucide-react";
import { updateStatus, countStatuses } from "@/components/StatusSmHealth";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";

export default function SmartHealthPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { menu, fetchMenu } = useHealthMenuStore();

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/smart-health/ob-registration");
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteRequest = async (id) => {
    const confirm = await Swal.fire({
      title: "ยืนยันการลบ?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
    });
    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/smart-health/ob-registration?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRequests(requests.filter((r) => r._id !== id));
        Swal.fire("ลบแล้ว", "ข้อมูลถูกลบแล้ว", "success");
      }
    } catch (err) {
      console.error("Delete failed", err);
      Swal.fire("ล้มเหลว", "ไม่สามารถลบได้", "error");
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchMenu();
  }, []);

  return (
    <div className="p-6">
      <div className="text-2xl p-6">รายการพร้อมยืม</div>
      <div className="flex justify-center mb-6">
        <div className="bg-black/50 backdrop-blur-md rounded-xl p-6 max-w-screen-md w-full border border-white/10 shadow-lg">
          <div className="flex flex-wrap justify-center gap-4">
            {menu.map((item) => {
              const mockCounts = {
                รถเข็น: 5,
                "ไม้เท้า 3ขา": 3,
                "walker 4ขา": 4,
                เตียง: 2,
                สามล้อโยกมือ: 6,
                ไม้ค้ำยัน: 7,
              };
              const count = mockCounts[item.shot_name] ?? 0;

              return (
                <div
                  key={item._id}
                  className="bg-base-200 rounded-xl p-3 text-center shadow-md flex flex-col items-center w-28"
                >
                  <img
                    src={item.image_icon}
                    alt={item.shot_name}
                    className="w-8 h-8 mb-1"
                  />
                  <div className="font-bold">{item.shot_name}</div>
                  <div className="text-green-500 text-sm">✅ พร้อมยืม</div>
                  <div className="text-xs">{count} รายการ</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-center mb-6">
        <div className="flex flex-wrap justify-center gap-4 max-w-screen-md">
          {Object.entries(countStatuses(requests)).map(([status, count]) => {
            const borderColor =
              status === "รับคำร้อง"
                ? "border-yellow-500"
                : status === "ประเมินโดยพยาบาลวิชาชีพ"
                ? "border-blue-500"
                : status === "ลงทะเบียนอุปกรณ์"
                ? "border-orange-500"
                : status === "ส่งมอบอุปกรณ์"
                ? "border-green-500"
                : "border-gray-300";
            return (
              <div
                key={status}
                className={`bg-white ${borderColor} border-2 rounded-xl p-4 text-center shadow-md w-40 flex flex-col justify-between h-24`}
              >
                <div className="flex items-center justify-center gap-1 text-sm font-medium text-gray-700">
                  {status === "รับคำร้อง" && <CircleDot size={24} className="text-yellow-500" />}
                  {status === "ประเมินโดยพยาบาลวิชาชีพ" && <Stethoscope size={24} className="text-blue-500" />}
                  {status === "ลงทะเบียนอุปกรณ์" && <ClipboardCheck size={24} className="text-orange-500" />}
                  {status === "ส่งมอบอุปกรณ์" && <PackageCheck size={24} className="text-green-500" />}
                  <span>{status}</span>
                </div>
                <div className="text-2xl font-bold text-primary mt-auto">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <div className="overflow-x-auto">
          <h1 className="text-xl font-bold mb-4">รายการผู้ขอกายอุปกรณ์</h1>
          <table className="table w-full">
            <thead>
              <tr>
                <th>อุปกรณ์</th>
                <th>เหตุผล</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="flex items-center gap-2">
                    {(() => {
                      const item = menu.find(
                        (m) => m.shot_name === r.equipment
                      );
                      return item?.image_icon ? (
                        <>
                          <img
                            src={item.image_icon}
                            alt={r.equipment}
                            className="w-6 h-6 object-contain"
                          />
                          <span>{r.equipment}</span>
                        </>
                      ) : (
                        <span>{r.equipment}</span>
                      );
                    })()}
                  </td>
                  <td>{r.reason}</td>
                  <td>{r.status || "รับคำร้อง"}</td>
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
                      onClick={() => updateStatus(r._id, r.status)}
                      className="btn btn-sm btn-warning"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => deleteRequest(r._id)}
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
      )}
    </div>
  );
}
