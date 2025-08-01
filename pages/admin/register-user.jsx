import { useState, useEffect, useRef } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useMenuStore } from "@/stores/useMenuStore";
import { z } from "zod";


export default function RegisterUserPage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { menu, fetchMenu } = useMenuStore();

  const [form, setForm] = useState({
    name: "",
    position: "",
    department: "",
    role: "admin",
    profileUrl: "",
    assignedTask: [],
    phone: "",
  });

  const [existingUser, setExistingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Zod schema สำหรับ validation
  const userRegistrationSchema = z.object({
    name: z.string().min(2, "ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร"),
    position: z.string().min(1, "กรุณากรอกตำแหน่ง"),
    department: z.string().min(1, "กรุณากรอกแผนก"),
    role: z.string().min(1, "กรุณาเลือกบทบาท"),
    profileUrl: z.string().optional(),
    assignedTask: z.array(z.string()).min(1, "กรุณาเลือกงานที่ได้รับมอบหมายอย่างน้อย 1 รายการ"),
    phone: z.string().length(10, "เบอร์โทรศัพท์ต้องมี 10 หลัก"),
  });

  const phoneRefs = useRef([]);

  useEffect(() => {
    if (user?.id) {
      fetchMenu();
    }
  }, [user?.id]);

    useEffect(() => {
    const checkUser = async () => {
      if (!user?.id) return;

      try {
        const token = await getToken();
        const clerkId = user.id;
        const res = await fetch("/api/users/get-by-clerkId", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (res.ok && data.user) {
          setExistingUser(data.user);
        }
      } catch (error) {
        console.error("Error checking user:", error);
      }
    };
    checkUser();
  }, [user?.id, getToken]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ป้องกันการกดปุ่มซ้ำ
    if (isSubmitting) {
      return;
    }

    // Validation ด้วย Zod
    const dataToValidate = {
      ...form,
      name: form.name.trim(),
      position: form.position.trim(),
      department: form.department.trim(),
    };

    const result = userRegistrationSchema.safeParse(dataToValidate);
    if (!result.success) {
      // เรียงลำดับ error ตามความสำคัญ
      const errorOrder = [
        'name',
        'position',
        'department',
        'phone',
        'assignedTask',
        'role',
        'profileUrl'
      ];
      
      const sortedErrors = result.error.errors.sort((a, b) => {
        const aIndex = errorOrder.indexOf(a.path[0]);
        const bIndex = errorOrder.indexOf(b.path[0]);
        return aIndex - bIndex;
      });
      
      const errorMessages = sortedErrors.map((err, index) => `${index + 1}. ${err.message}`).join('\n');
      alert("ข้อมูลไม่ครบถ้วน:\n" + errorMessages);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      ...form,
      assignedTask: form.assignedTask.join(", "),
      clerkId: user?.id,
    };
    console.log("Submitting form:", payload);

    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        try {
          await fetch('/api/users/set-clerk-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clerkId: user.id, role: form.role }),
          });
        } catch (err) {
          console.warn("ไม่สามารถอัปเดต Clerk role ได้:", err);
        }

        alert("บันทึกข้อมูลเรียบร้อยแล้ว");
        setForm({
          name: "",
          position: "",
          department: "",
          role: "admin",
          profileUrl: "",
          assignedTask: [],
          phone: "",
        });
      } else {
        if (data.message?.includes("duplicate")) {
          alert("มีผู้ใช้นี้อยู่แล้วในระบบ");
        } else {
          alert("เกิดข้อผิดพลาด: " + data.message);
        }
      }
    } catch (err) {
      alert("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <div
        style={{
          maxWidth: "500px",
          width: "100%",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "2rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex justify-center mb-4">
          {user?.imageUrl ? (
            <div className="avatar">
              <div className="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                <img src={user.imageUrl} alt="profile" />
              </div>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-300" />
          )}
        </div>
        {/* Clerk profile image above */}
        <h1 style={{ textAlign: "center", marginBottom: "1rem" }}>ลงทะเบียนผู้ใช้ (Register User)</h1>
        <div className="flex justify-end mb-2">
          <label className="badge badge-accent font-extrabold text-white px-10 py-5">
            Role: <span className="mx-1.5 badge badge-primary pointer-events-none">Admin</span>
          </label>
        </div>
        {existingUser ? (
          <div className="space-y-4">
            <div className="text-green-700 font-semibold text-center">
              ผู้ใช้นี้มีอยู่ในระบบแล้ว
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">ชื่อ-สกุล</span>
              </label>
              <input
                type="text"
                value={existingUser.name}
                readOnly
                className="input input-bordered w-full bg-gray-100"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">ตำแหน่ง</span>
              </label>
              <input
                type="text"
                value={existingUser.position}
                readOnly
                className="input input-bordered w-full bg-gray-100"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">กอง/ฝ่าย</span>
              </label>
              <input
                type="text"
                value={existingUser.department}
                readOnly
                className="input input-bordered w-full bg-gray-100"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">หน้าที่</span>
              </label>
              <input
                type="text"
                value={
                  Array.isArray(existingUser.assignedTask)
                    ? existingUser.assignedTask.join(", ")
                    : existingUser.assignedTask || ""
                }
                readOnly
                className="input input-bordered w-full bg-gray-100"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">URL รูปโปรไฟล์</span>
              </label>
              <input
                type="text"
                value={existingUser.profileUrl}
                readOnly
                className="input input-bordered w-full bg-gray-100"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">เบอร์โทรศัพท์</span>
              </label>
              <input
                type="text"
                value={existingUser.phone}
                readOnly
                className="input input-bordered w-full bg-gray-100"
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">ชื่อ-สกุล</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="input input-bordered w-full"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">ตำแหน่ง</span>
              </label>
              <input
                type="text"
                name="position"
                value={form.position}
                onChange={handleChange}
                required
                className="input input-bordered w-full"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">กอง/ฝ่าย</span>
              </label>
              <input
                type="text"
                name="department"
                value={form.department}
                onChange={handleChange}
                required
                className="input input-bordered w-full"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">หน้าที่</span>
              </label>
              <input
                type="text"
                name="assignedTasksDisplay"
                value={form.assignedTask.join(", ")}
                readOnly
                className="input input-bordered w-full bg-gray-100"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">URL รูปโปรไฟล์</span>
              </label>
              <input
                type="url"
                name="profileUrl"
                value={form.profileUrl}
                onChange={handleChange}
                className="input input-bordered w-full"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">เบอร์โทรศัพท์</span>
              </label>
              <div className="flex flex-wrap gap-x-1.5 gap-y-2 md:gap-x-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="relative">
                    <input
                      ref={(el) => (phoneRefs.current[i] = el)}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      className="input input-bordered w-9 text-center"
                      value={form.phone?.[i] || ""}
                      onChange={(e) => {
                        const input = e.target;
                        const newChar = input.value.replace(/\D/, "");
                        const updated = form.phone.split("");
                        updated[i] = newChar;
                        setForm({ ...form, phone: updated.join("") });

                        if (newChar && phoneRefs.current[i + 1]) {
                          phoneRefs.current[i + 1].focus();
                        }
                      }}
                    />
                    {(i === 2 || i === 6) && (
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        -
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Clerk ID</span>
              </label>
              <input
                type="text"
                value={user?.id || ""}
                readOnly
                disabled
                className="input input-bordered w-full bg-gray-100"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">งานที่ได้รับมอบหมายในระบบ</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {menu.length === 0 ? (
                  <div className="text-gray-400 italic">กำลังโหลดรายการ...</div>
                ) : (
                  menu.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      className={`btn btn-outline flex items-center gap-2 ${
                        form.assignedTask.includes(item.Prob_name)
                          ? "btn-active border-blue-500"
                          : ""
                      }`}
                      onClick={() => {
                        const exists = form.assignedTask.includes(item.Prob_name);
                        const updatedTasks = exists
                          ? form.assignedTask.filter((t) => t !== item.Prob_name)
                          : [...form.assignedTask, item.Prob_name];
                        setForm({ ...form, assignedTask: updatedTasks });
                      }}
                    >
                      <img
                        src={item.Prob_pic}
                        alt={item.Prob_name}
                        className="w-5 h-5 rounded-full"
                      />
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{item.Prob_name}</span>
                        <span className="text-xs opacity-60">{item.role}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <button type="submit" className="btn btn-success w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  กำลังบันทึก...
                </>
              ) : (
                'Save'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
