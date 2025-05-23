//admin/index.js
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [label, setLabel] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState([]);
  const [menuOptions, setMenuOptions] = useState([]);
  const [filterCategory, setFilterCategory] = useState("ทั้งหมด");

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
      <h1 className="text-xl font-bold mb-4">Admin Upload Page</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="เช่น ไฟไม่ติด"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Icon URL</label>
          <input
            type="text"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="https://..."
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

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          บันทึกข้อมูล
        </button>
      </form>

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

        <table className="min-w-full border text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2">Label</th>
              <th className="border px-3 py-2">Icon</th>
              <th className="border px-3 py-2">Category</th>
              <th className="border px-3 py-2">Active</th>
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
                  <td className="border px-3 py-1">{item.label}</td>
                  <td className="border px-3 py-1">
                    <img src={item.iconUrl} alt="icon" className="h-6 w-6" />
                  </td>
                  <td className="border px-3 py-1">{item.category}</td>
                  <td className="border px-3 py-1">
                    {item.active ? "✅" : "❌"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
