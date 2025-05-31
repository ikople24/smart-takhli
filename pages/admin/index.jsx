//admin/index.js
import { useEffect, useState } from "react";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";

export default function AdminPage() {
  const [label, setLabel] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [category, setCategory] = useState("");
  const [filterCategory, setFilterCategory] = useState("ทั้งหมด");
  const [isEditing, setIsEditing] = useState(false);

  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const { problemOptions, fetchProblemOptions, problemLoading } = useProblemOptionStore();

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    fetchProblemOptions();
  }, [fetchProblemOptions]);

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
      // Replace setItems with update to problemOptions store
      fetchProblemOptions();
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
      await fetchProblemOptions();
    } catch (err) {
      console.error("Error submitting:", err);
      alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      setIconUrl(data.secure_url);
    } catch (error) {
      console.error("Image upload failed", error);
      alert("❌ Upload failed");
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
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="mt-2 file-input file-input-bordered w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {menuLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="skeleton w-24 h-10 rounded"></div>
                ))}
              </div>
            ) : (
              menu
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
                ))
            )}
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
          {problemLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="skeleton w-24 h-8 rounded"></div>
              ))}
            </div>
          ) : (
            <>
              <button
                onClick={() => setFilterCategory("ทั้งหมด")}
                className={`px-3 py-1 rounded border ${
                  filterCategory === "ทั้งหมด"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                ทั้งหมด ({problemOptions.length})
              </button>
              {menu.map((opt, i) => {
                const count = problemOptions.filter(
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
            </>
          )}
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
            {problemOptions
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
