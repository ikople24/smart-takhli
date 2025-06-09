//admin/index.js
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { useMenuStore } from "@/stores/useMenuStore";
import { useProblemOptionStore } from "@/stores/useProblemOptionStore";
import { useAdminOptionsStore } from "@/stores/useAdminOptionsStore";

export default function AdminPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !userId) {
      router.replace("/");
    }
  }, [isLoaded, userId]);

  if (!isLoaded || !userId) {
    return <div className="text-center p-8">กำลังโหลด...</div>;
  }
  const [activeTab, setActiveTab] = useState("problem");
  const [label, setLabel] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [category, setCategory] = useState("");
  const [filterCategory, setFilterCategory] = useState("ทั้งหมด");
  const isAdminTab = activeTab === "admin";
  const [isEditing, setIsEditing] = useState(false);

  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const { problemOptions, fetchProblemOptions, problemLoading } = useProblemOptionStore();
  const { adminOptions } = useAdminOptionsStore();

  useEffect(() => {
    fetchMenu();
    fetchProblemOptions();
    const fetchAdminOptions = async () => {
      const res = await fetch("/api/admin-options");
      const data = await res.json();
      useAdminOptionsStore.getState().setAdminOptions(data);
    };
    fetchAdminOptions();
  }, []);

  const handleEdit = (item) => {
    setLabel(item.label);
    setIconUrl(item.icon_url);
    setCategory(item.menu_category);
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("คุณแน่ใจหรือว่าต้องการลบรายการนี้?")) return;

    const endpoint = isAdminTab ? "/api/admin-options" : "/api/problems";

    try {
      const res = await fetch(`${endpoint}/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      if (isAdminTab) {
        const options = await fetch("/api/admin-options").then((r) => r.json());
        useAdminOptionsStore.getState().setAdminOptions(options);
      } else {
        await fetchProblemOptions();
      }
    } catch (err) {
      console.error("Error deleting:", err);
      alert("❌ ไม่สามารถลบข้อมูลได้");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) {
      alert("⏳ กรุณารอให้อัปโหลดเสร็จก่อน");
      return;
    }
    if (!label || !iconUrl || !category) {
      alert("❌ กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    const data = {
      label,
      iconUrl,
      category,
      active: true,
    };
    console.log("Submitting data:", data);

    const endpoint = isAdminTab ? "/api/admin-options" : "/api/problem-options";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      alert("✅ บันทึกข้อมูลสำเร็จ");
      setIsEditing(false);
      setLabel("");
      setIconUrl("");
      setCategory("");

      if (isAdminTab) {
        const options = await fetch("/api/admin-options").then((r) => r.json());
        useAdminOptionsStore.getState().setAdminOptions(options);
      } else {
        await fetchProblemOptions();
      }
    } catch (err) {
      console.error("Error submitting:", err);
      alert("❌ เกิดข้อผิดพลาดในการส่งข้อมูล");
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);

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
      console.log("Uploaded image URL:", data.secure_url);
    } catch (error) {
      console.error("Image upload failed", error);
      alert("❌ Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex flex-col lg:flex-row justify-center mb-6">
        <button
          onClick={() => setActiveTab("problem")}
          className={`px-4 py-2 rounded-t-lg lg:rounded-l-lg lg:rounded-r-none border ${activeTab === "problem" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
        >
          รายการแจ้งปัญหา
        </button>
        <button
          onClick={() => setActiveTab("admin")}
          className={`px-4 py-2 rounded-b-lg lg:rounded-r-lg lg:rounded-l-none border ${activeTab === "admin" ? "bg-blue-600 text-white" : "bg-white text-gray-700"}`}
        >
          รายการเจ้าหน้าที่
        </button>
      </div>

      {activeTab === "problem" && (
        <>
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
                        onClick={() => {
                          console.log("Selected category:", opt.Prob_name);
                          setCategory(opt.Prob_name);
                        }}
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
                disabled={isUploading}
              >
                {isUploading ? "กำลังอัปโหลด..." : "บันทึกข้อมูล"}
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
                    className={`relative px-4 py-2 rounded-lg font-semibold ${
                      filterCategory === "ทั้งหมด"
                        ? "bg-black text-white"
                        : "bg-white text-gray-800 border border-gray-300"
                    }`}
                  >
                    ทั้งหมด
                    <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {problemOptions.length}
                    </span>
                  </button>
                  {menu.map((opt, i) => {
                    const count = problemOptions.filter(
                      (item) => item.category === opt.Prob_name
                    ).length;
                    return (
                      <button
                        key={i}
                        onClick={() => setFilterCategory(opt.Prob_name)}
                        className={`relative px-4 py-2 rounded-lg font-semibold ${
                          filterCategory === opt.Prob_name
                            ? "bg-black text-white"
                            : "bg-white text-gray-800 border border-gray-300"
                        }`}
                      >
                        {opt.Prob_name}
                        <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {count}
                        </span>
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
        </>
      )}

      {activeTab === "admin" && (
        <>
          <div className={`card bg-base-100 shadow mb-6 ${isEditing ? 'border-2 border-orange-400' : ''}`}>
            <div className="card-body">
              <h1 className="text-xl font-bold mb-4">Admin Upload Page (เจ้าหน้าที่)</h1>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Label</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="input input-bordered input-primary w-full"
                    placeholder="เช่น ปรับตำแหน่งหลอดไฟ"
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
                            onClick={() => {
                              console.log("Selected category:", opt.Prob_name);
                              setCategory(opt.Prob_name);
                            }}
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
                    disabled={isUploading}
                  >
                    {isUploading ? "กำลังอัปโหลด..." : "บันทึกข้อมูล"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">รายการที่มีอยู่ในระบบ</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setFilterCategory("ทั้งหมด")}
                className={`relative px-4 py-2 rounded-lg font-semibold ${
                  filterCategory === "ทั้งหมด"
                    ? "bg-black text-white"
                    : "bg-white text-gray-800 border border-gray-300"
                }`}
              >
                ทั้งหมด
                <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {adminOptions.length}
                </span>
              </button>
              {menu.map((opt, i) => {
                const count = adminOptions.filter(
                  (item) => item.menu_category === opt.Prob_name
                ).length;
                return (
                  <button
                    key={i}
                    onClick={() => setFilterCategory(opt.Prob_name)}
                    className={`relative px-4 py-2 rounded-lg font-semibold ${
                      filterCategory === opt.Prob_name
                        ? "bg-black text-white"
                        : "bg-white text-gray-800 border border-gray-300"
                    }`}
                  >
                    {opt.Prob_name}
                    <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="text-lg font-semibold mb-2">รายการผู้ดูแล</h2>
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th className="text-center">Label</th>
                    <th className="text-center">Icon</th>
                    <th className="text-center">Category</th>
                    <th className="text-center">Active</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminOptions
                    .filter(
                      (item) =>
                        filterCategory === "ทั้งหมด" ||
                        item.menu_category === filterCategory
                    )
                    .sort((a, b) => (b._id > a._id ? 1 : -1))
                    .map((item, index) => (
                      <tr key={index}>
                        <td>{item.label}</td>
                        <td>
                          <img src={item.icon_url} alt="icon" className="h-8 w-8" />
                        </td>
                        <td className="w-40">{item.menu_category}</td>
                        <td className="text-center">{item.active ? "✅" : "❌"}</td>
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
        </>
      )}
    </div>
  );
}
