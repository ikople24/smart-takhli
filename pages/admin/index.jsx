//admin/index.js
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [label, setLabel] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState([]);
  const [menuOptions, setMenuOptions] = useState([]);
  const [filterCategory, setFilterCategory] = useState("ทั้งหมด");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const [resProblems, resMenus] = await Promise.all([
          fetch("/api/problems"),
          fetch("/api/menu"),
        ]);
        const [dataProblems, dataMenus] = await Promise.all([
          resProblems.json(),
          resMenus.json(),
        ]);
        setItems(dataProblems);
        setMenuOptions(dataMenus);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchItems();
  }, []);

  const handleEdit = (item) => {
    setLabel(item.label);
    setIconUrl(item.iconUrl);
    setCategory(item.category);
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("คุณแน่ใจหรือว่าต้องการลบรายการนี้?")) return;

    const BASE_URL =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3004"
        : "https://express-docker-server-production.up.railway.app";

    try {
      const res = await fetch(`${BASE_URL}/api/problems/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      const updated = await fetch("/api/problems").then((r) => r.json());
      setItems(updated);
    } catch (err) {
      console.error("Error deleting:", err);
      alert("❌ ไม่สามารถลบข้อมูลได้");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      label,
      iconUrl,
      category,
      active: true,
    };

    const BASE_URL =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3004"
        : "https://express-docker-server-production.up.railway.app";

    try {
      console.log("🔎 Submit Data:", data);
      const res = await fetch(`${BASE_URL}/api/problems`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      const result = await res.json();
      alert("✅ บันทึกข้อมูลสำเร็จ");
      setIsEditing(false);

      // Reset form
      setLabel("");
      setIconUrl("");
      setCategory("");

      // Refresh data
      const refetch = await fetch("/api/problems");
      const updated = await refetch.json();
      setItems(updated);
    } catch (err) {
      console.error("Error submitting:", err);
      alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  return (
    <div className="p-4">
      <div className={`card bg-base-100 shadow mb-6 ${isEditing ? 'border-2 border-orange-400' : ''}`}>
        <div className="card-body">
          <h1 className="text-xl font-bold mb-4">Admin Upload Page</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input input-bordered input-primary w-full"
            placeholder="เช่น ไฟไม่ติด"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Icon URL</label>
          <textarea
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            className="textarea textarea-bordered textarea-primary w-full"
            placeholder="https://..."
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {menuOptions
              .sort((a, b) => a.order - b.order)
              .map((opt, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setCategory(opt.Prob_name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded border ${
                    category === opt.Prob_name
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  <img src={opt.Prob_pic} alt="" className="w-5 h-5" />
                  {opt.Prob_name}
                </button>
              ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-outline btn-warning"
            onClick={() => {
              setLabel("");
              setIconUrl("");
              setCategory("");
              setIsEditing(false);
            }}
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="btn btn-accent ml-2"
          >
            บันทึกข้อมูล
          </button>
        </div>
          </form>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">รายการที่มีอยู่ในระบบ</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterCategory("ทั้งหมด")}
            className={`px-3 py-1 rounded border ${
              filterCategory === "ทั้งหมด"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            ทั้งหมด ({items.length})
          </button>
          {menuOptions.map((opt, i) => {
            const count = items.filter(
              (item) => item.category === opt.Prob_name
            ).length;
            return (
              <button
                key={i}
                onClick={() => setFilterCategory(opt.Prob_name)}
                className={`px-3 py-1 rounded border ${
                  filterCategory === opt.Prob_name
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {opt.Prob_name} ({count})
              </button>
            );
          })}
        </div>

        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th className="text-center">Label</th>
              <th className="text-center">Icon</th>
              <th className="text-center w-40">Category</th>
              <th className="text-center">Active</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter(
                (item) =>
                  filterCategory === "ทั้งหมด" ||
                  item.category === filterCategory
              )
              .sort((a, b) => (b._id > a._id ? 1 : -1))
              .map((item, index) => (
                <tr key={index}>
                  <td>{item.label}</td>
                  <td>
                    <img src={item.iconUrl} alt="icon" className="h-8 w-8" />
                  </td>
                  <td className="w-40">{item.category}</td>
                  <td className="text-center align-middle">{item.active ? "✅" : "❌"}</td>
                  <td className="space-x-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="btn btn-outline btn-info btn-sm"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="btn btn-outline btn-error btn-sm"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
