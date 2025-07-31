import React, { useState, useMemo, useEffect } from "react";

export default function RegisterDeviceTable({ onStatusChange }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ทั้งหมด");
  const [updatingId, setUpdatingId] = useState(null); // แถวที่กำลังอัปเดต

  useEffect(() => {
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

    fetchDevices();
  }, []);

  const obTypes = useMemo(() => {
    const types = devices?.map((d) => d.ob_type).filter(Boolean) || [];
    return ["ทั้งหมด", ...Array.from(new Set(types))];
  }, [devices]);

  const filtered = useMemo(
    () =>
      filter === "ทั้งหมด"
        ? devices
        : devices.filter((item) => item.ob_type === filter),
    [devices, filter]
  );

  // ฟังก์ชันเปลี่ยนสถานะ
  async function handleToggleStatus(item) {
    const id = item._id?.$oid || item._id || item.index_id_tk;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/smart-health/register-object-health/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ob_status: !item.ob_status }),
      });
      if (res.ok) {
        setDevices((prev) =>
          prev.map((d) =>
            (d._id?.$oid || d._id || d.index_id_tk) === id
              ? { ...d, ob_status: !d.ob_status }
              : d
          )
        );
        if (typeof onStatusChange === "function") {
          onStatusChange();
        }
      } else {
        alert("อัปเดตสถานะไม่สำเร็จ");
      }
    } catch {
      alert("เกิดข้อผิดพลาดขณะอัปเดตสถานะ");
    }
    setUpdatingId(null);
  }

  async function handleDeleteItem(id) {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) return;
    try {
      const res = await fetch(`/api/smart-health/register-object-health/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => (d._id?.$oid || d._id || d.index_id_tk) !== id));
      } else {
        alert("ลบไม่สำเร็จ");
      }
    } catch {
      alert("เกิดข้อผิดพลาดขณะลบ");
    }
  }

  if (loading) return <div>กำลังโหลดข้อมูลอุปกรณ์...</div>;

  return (
    <div>
      {/* ปุ่มกรอง */}
      <div className="flex flex-wrap gap-2 mb-4 mt-6">
        {obTypes.map((type) => (
          <button
            key={type}
            className={`btn btn-xs ${filter === type ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto mt-2">
        <table className="table table-xs">
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>ประเภทอุปกรณ์</th>
              <th>รหัสอุปกรณ์</th>
              <th>Serial</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => {
              const id = item._id?.$oid || item._id || item.index_id_tk;
              return (
                <tr key={id}>
                  <td>{idx + 1}</td>
                  <td>{item.ob_type}</td>
                  <td>{item.id_code_th}</td>
                  <td>{item.index_id_tk}</td>
                  <td>
                    {item.ob_status
                      ? <span className="text-green-600">✅ พร้อมใช้งาน</span>
                      : <span className="text-gray-400">🕑 อยู่ระหว่างการยืม</span>}
                  </td>
                  <td className="flex gap-2">
                    <button
                      className="btn btn-xs btn-primary"
                      disabled={updatingId === id}
                      onClick={() => handleToggleStatus(item)}
                    >
                      {updatingId === id ? "กำลังอัปเดต..." : "เปลี่ยนสถานะ"}
                    </button>
                    <button
                      className="btn btn-xs btn-error"
                      onClick={() => handleDeleteItem(id)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-400 my-6">ไม่พบข้อมูล</div>
        )}
      </div>
    </div>
  );
}