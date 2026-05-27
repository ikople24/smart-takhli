import { useState, useEffect, useRef } from "react";
import LayoutAdmin from "@/components/LayoutAdmin";
import { useUser, useAuth } from "@clerk/nextjs";
import { useMenuStore } from "@/stores/useMenuStore";
import { z } from "zod";
import Swal from "sweetalert2";

// ปรับแต่ง SweetAlert2
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

// ปรับแต่ง SweetAlert2 สำหรับ loading
const LoadingAlert = Swal.mixin({
  allowOutsideClick: false,
  allowEscapeKey: false,
  showConfirmButton: false,
  didOpen: () => {
    Swal.showLoading();
  }
});


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
    assignedTask: [], // เริ่มต้นด้วย array ว่าง
    phone: "",
  });

  const [existingUser, setExistingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserChecked, setIsUserChecked] = useState(false);

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
      // ดึงรูปโปรไฟล์จาก Clerk โดยอัตโนมัติ
      if (user?.imageUrl) {
        setForm(prev => ({
          ...prev,
          profileUrl: user.imageUrl
        }));
      }
    }
  }, [user?.id, user?.imageUrl]);

  // ป้องกันการ submit ซ้ำ
  useEffect(() => {
    if (isSubmitting) {
      // ปิดการใช้งาน form ทั้งหมด
      const form = document.querySelector('form');
      if (form) {
        form.style.pointerEvents = 'none';
      }
    } else {
      // เปิดการใช้งาน form
      const form = document.querySelector('form');
      if (form) {
        form.style.pointerEvents = 'auto';
      }
    }
  }, [isSubmitting]);

    useEffect(() => {
    const checkUser = async () => {
      if (!user?.id) {
        setIsLoading(false);
        setIsUserChecked(true);
        return;
      }

      try {
        setIsLoading(true);
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
      } finally {
        setIsLoading(false);
        setIsUserChecked(true);
      }
    };
    checkUser();
  }, [user?.id, getToken]);

  const handleChange = (e) => {
    if (isSubmitting) return;
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleEdit = () => {
    if (isSubmitting) return;
    // เติมข้อมูลจาก existingUser ลงในฟอร์ม
    if (existingUser) {
      // แปลง assignedTask จาก string เป็น array และลบข้อมูลซ้ำ
      let assignedTaskArray = [];
      if (existingUser.assignedTask) {
        if (Array.isArray(existingUser.assignedTask)) {
          // ถ้าเป็น array ให้ตรวจสอบว่าแต่ละ element เป็น string หรือไม่
          // ถ้าเป็น string เดียวที่มี comma ให้แยกออก
          if (existingUser.assignedTask.length === 1 && typeof existingUser.assignedTask[0] === 'string') {
            // แยก string ที่มี comma ออกเป็น array
            assignedTaskArray = existingUser.assignedTask[0].split(/,\s*/).filter(Boolean);
          } else {
            // ถ้าเป็น array ของ string แต่ละตัวแล้ว
            assignedTaskArray = existingUser.assignedTask;
          }
        } else if (typeof existingUser.assignedTask === 'string') {
          // แปลง string เป็น array และลบข้อมูลซ้ำ
          assignedTaskArray = existingUser.assignedTask.split(/,\s*/).filter(Boolean);
        } else {
          // ถ้าเป็น null, undefined, หรือ type อื่น ให้เป็น array ว่าง
          assignedTaskArray = [];
        }
      }

      // ลบข้อมูลซ้ำใน array
      const uniqueAssignedTaskArray = [...new Set(assignedTaskArray)];

      setForm({
        name: existingUser.name || "",
        position: existingUser.position || "",
        department: existingUser.department || "",
        role: existingUser.role || "admin",
        profileUrl: existingUser.profileUrl || user?.imageUrl || "",
        assignedTask: uniqueAssignedTaskArray, // ใช้ unique array
        phone: existingUser.phone || "",
      });
      
      console.log("🔧 Edit mode - Original assignedTask:", existingUser.assignedTask);
      console.log("🔧 Edit mode - Original assignedTask type:", typeof existingUser.assignedTask);
      console.log("🔧 Edit mode - Converted assignedTask:", assignedTaskArray);
      console.log("🔧 Edit mode - Unique assignedTask:", uniqueAssignedTaskArray);
      console.log("🔧 Edit mode - Unique assignedTask count:", uniqueAssignedTaskArray.length);
      console.log("🔧 Edit mode - Final assignedTask:", uniqueAssignedTaskArray);
      console.log("🔧 Edit mode - Final assignedTask count:", uniqueAssignedTaskArray.length);
      console.log("🔧 Edit mode - Form will allow multiple selection");
      console.log("🔧 Edit mode - When saving, it will replace all previous tasks");
      console.log("🔧 Edit mode - User can select multiple tasks but they will replace old ones");
      console.log("🔧 Edit mode - This is multi-select mode with replace on save");
      console.log("🔧 Edit mode - Selected tasks:", uniqueAssignedTaskArray);
      console.log("🔧 Edit mode - Database value:", existingUser.assignedTask);
      console.log("🔧 Edit mode - Database value type:", typeof existingUser.assignedTask);
      console.log("🔧 Edit mode - Database value split:", typeof existingUser.assignedTask === 'string' ? existingUser.assignedTask?.split(", ") : existingUser.assignedTask);
      console.log("🔧 Edit mode - Safe conversion completed");
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isSubmitting) return;
    setIsEditing(false);
    // รีเซ็ตฟอร์ม
    setForm({
      name: "",
      position: "",
      department: "",
      role: "admin",
      profileUrl: "",
      assignedTask: [], // เริ่มต้นด้วย array ว่าง
      phone: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ป้องกันการกดปุ่มซ้ำ
    if (isSubmitting) {
      console.log("⚠️ Form submission blocked - already submitting");
      e.stopPropagation();
      e.preventDefault();
      return false;
    }

    // ตั้งค่า isSubmitting เป็น true ทันทีเพื่อป้องกันการกดซ้ำ
    setIsSubmitting(true);

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
      
      // ปิด loading ก่อน
      Swal.close();
      
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ครบถ้วน',
        html: errorMessages.replace(/\n/g, '<br>'),
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#dc3545',
        timer: 5000,
        timerProgressBar: true
      });
      
      // รอสักครู่ก่อนรีเซ็ต isSubmitting เพื่อป้องกันการกดซ้ำ
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1000);
      return;
    }
    console.log("🚀 Starting form submission...");
    
    // แสดง loading
    LoadingAlert.fire({
      title: isEditing ? 'กำลังอัปเดตข้อมูล...' : 'กำลังบันทึกข้อมูล...',
      html: 'กรุณารอสักครู่'
    });

    // ลบข้อมูลซ้ำใน assignedTask ก่อนส่ง
    const uniqueAssignedTask = [...new Set(form.assignedTask)];
    
    const payload = {
      ...form,
      assignedTask: uniqueAssignedTask.join(", "), // ส่งเป็น string ที่ join แล้ว
      clerkId: user?.id,
    };
    
    console.log("🔍 FRONTEND - Before sending:", {
      originalAssignedTask: form.assignedTask,
      uniqueAssignedTask: uniqueAssignedTask,
      finalAssignedTask: uniqueAssignedTask.join(", "),
      isEditing: isEditing
    });
    
    console.log("📤 Payload assignedTask:", form.assignedTask);
    console.log("📤 Payload uniqueAssignedTask:", uniqueAssignedTask);
    console.log("📤 Payload assignedTask (joined):", uniqueAssignedTask.join(", "));
    console.log("📤 Payload assignedTask count:", uniqueAssignedTask.length);
    console.log("📤 Payload isEditing:", isEditing);
    console.log("📤 Payload will replace all previous tasks when saved");


    try {
      const endpoint = isEditing ? "/api/users/update" : "/api/users/create";
      const method = isEditing ? "PUT" : "POST";
      
      const token = await getToken();
      const res = await fetch(endpoint, {
        method: method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
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

        // ปิด loading ก่อน
        Swal.close();
        
        const message = isEditing 
          ? "อัปเดตข้อมูลเรียบร้อยแล้ว<br><br>ระบบจะรีเฟชข้อมูลเพื่อแสดงข้อมูลที่อัปเดตแล้ว"
          : "บันทึกข้อมูลเรียบร้อยแล้ว<br><br>ระบบจะรีเฟชข้อมูลเพื่อแสดงข้อมูลที่บันทึกแล้ว";
        
        Toast.fire({
          icon: 'success',
          title: isEditing ? 'อัปเดตสำเร็จ' : 'บันทึกสำเร็จ'
        });
        
        // รีเฟชข้อมูลเพื่อแสดงข้อมูลที่บันทึกแล้ว
        try {
          const token = await getToken();
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
          console.error("Error refreshing user data:", error);
        }
        
        if (isEditing) {
          setIsEditing(false);
        } else {
          setForm({
            name: "",
            position: "",
            department: "",
            role: "admin",
            profileUrl: "",
            assignedTask: [], // เริ่มต้นด้วย array ว่าง
            phone: "",
          });
        }
      } else {
        // ปิด loading ก่อน
        Swal.close();
        
        if (data.message?.includes("duplicate")) {
          Swal.fire({
            icon: 'warning',
            title: 'มีผู้ใช้นี้อยู่แล้ว',
            text: 'มีผู้ใช้นี้อยู่แล้วในระบบ',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#ffc107',
            timer: 4000,
            timerProgressBar: true
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: 'เกิดข้อผิดพลาด: ' + data.message,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#dc3545',
            timer: 5000,
            timerProgressBar: true
          });
        }
      }
    } catch (err) {
      // ปิด loading ก่อน
      Swal.close();
      
      Swal.fire({
        icon: 'error',
        title: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้',
        text: 'กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#dc3545',
        timer: 5000,
        timerProgressBar: true
      });
    } finally {
      // รอสักครู่ก่อนรีเซ็ต isSubmitting เพื่อป้องกันการกดซ้ำ
      setTimeout(() => {
        setIsSubmitting(false);
        console.log("✅ Form submission completed");
      }, 1000);
    }
  };

  return (
    <LayoutAdmin title="จัดการผู้ใช้งาน">
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
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">กำลังตรวจสอบข้อมูลผู้ใช้...</h3>
              <p className="text-sm text-gray-500">กรุณารอสักครู่</p>
            </div>
          </div>
        )}

        {/* Content after loading */}
        {!isLoading && isUserChecked && (
          <>
            {existingUser && !isEditing ? (
              // แสดงข้อมูลผู้ใช้ที่มีอยู่แล้ว
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-green-700 font-semibold">
                ผู้ใช้นี้มีอยู่ในระบบแล้ว
              </div>
              <button
                type="button"
                onClick={handleEdit}
                className="btn btn-outline btn-primary btn-sm"
                disabled={isSubmitting}
              >
                แก้ไขข้อมูล
              </button>
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
                    ? (existingUser.assignedTask.length === 1 && typeof existingUser.assignedTask[0] === 'string')
                      ? existingUser.assignedTask[0]
                      : existingUser.assignedTask.join(", ")
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
          <form 
            onSubmit={handleSubmit} 
            className="space-y-4" 
            noValidate
            style={{ pointerEvents: isSubmitting ? 'none' : 'auto' }}
          >
            {/* Hidden input เพื่อป้องกันการ submit ซ้ำ */}
            <input type="hidden" name="submitting" value={isSubmitting ? "true" : "false"} />
            {isEditing && (
              <div className="flex justify-between items-center mb-4">
                <div className="text-blue-700 font-semibold">
                  แก้ไขข้อมูลผู้ใช้
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn btn-outline btn-error btn-sm"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </button>
              </div>
            )}
            {!existingUser && !isEditing && (
              <div className="text-center py-4 mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">ยังไม่มีข้อมูลผู้ใช้ในระบบ</h3>
                <p className="text-sm text-gray-500 mb-4">กรุณากรอกข้อมูลเพื่อลงทะเบียนผู้ใช้ใหม่</p>
              </div>
            )}
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
                disabled={isSubmitting}
                className={`input input-bordered w-full ${isSubmitting ? 'bg-gray-100' : ''}`}
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
                disabled={isSubmitting}
                className={`input input-bordered w-full ${isSubmitting ? 'bg-gray-100' : ''}`}
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
                disabled={isSubmitting}
                className={`input input-bordered w-full ${isSubmitting ? 'bg-gray-100' : ''}`}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">หน้าที่</span>
              </label>
              <input
                type="text"
                name="assignedTasksDisplay"
                value={[...new Set(form.assignedTask)].join(", ")}
                readOnly
                className="input input-bordered w-full bg-gray-100"
                placeholder="เลือกงานที่ได้รับมอบหมายด้านล่าง"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">URL รูปโปรไฟล์ (จาก Clerk)</span>
              </label>
              <input
                type="url"
                name="profileUrl"
                value={form.profileUrl}
                onChange={handleChange}
                placeholder="จะถูกดึงจาก Clerk โดยอัตโนมัติ"
                disabled={isSubmitting}
                className={`input input-bordered w-full ${isSubmitting ? 'bg-gray-100' : ''}`}
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
                      disabled={isSubmitting}
                      className={`input input-bordered w-9 text-center ${isSubmitting ? 'bg-gray-100' : ''}`}
                      value={form.phone?.[i] || ""}
                      onChange={(e) => {
                        if (isSubmitting) return;
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
                <span className="label-text-alt text-blue-600">
                  เลือกแล้ว {[...new Set(form.assignedTask)].length} รายการ
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {menu.length === 0 ? (
                  <div className="text-gray-400 italic">กำลังโหลดรายการ...</div>
                ) : (
                  <>
                    <div className="w-full text-xs text-gray-500 mb-2">
                      💡 คลิกปุ่มเพื่อเลือก/ยกเลิกงานที่ได้รับมอบหมาย (เลือกได้หลายงาน)
                    </div>
                    {menu.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        className={`btn btn-outline flex items-center gap-2 ${
                          [...new Set(form.assignedTask)].includes(item.Prob_name)
                            ? "btn-active border-blue-500 bg-blue-50"
                            : ""
                        } ${isSubmitting ? 'btn-disabled' : ''}`}
                        title={isSubmitting ? "ไม่สามารถเลือกได้ขณะกำลังบันทึก" : ([...new Set(form.assignedTask)].includes(item.Prob_name) ? "คลิกเพื่อลบ" : "คลิกเพื่อเลือก")}
                        onClick={() => {
                          if (isSubmitting) return;
                          const uniqueAssignedTask = [...new Set(form.assignedTask)];
                          const exists = uniqueAssignedTask.includes(item.Prob_name);
                          let updatedTasks;
                          
                          if (exists) {
                            // ถ้ามีอยู่แล้ว ให้ลบออก
                            updatedTasks = uniqueAssignedTask.filter((t) => t !== item.Prob_name);
                          } else {
                            // ถ้าไม่มี ให้เพิ่มเข้าไปใน array เดิม (เลือกได้หลายงาน)
                            updatedTasks = [...uniqueAssignedTask, item.Prob_name];
                          }
                          
                          console.log("🔄 Updating assignedTask:", {
                            current: form.assignedTask,
                            unique: uniqueAssignedTask,
                            new: updatedTasks,
                            action: exists ? "remove" : "add",
                            item: item.Prob_name,
                            isEditing: isEditing,
                            count: updatedTasks.length
                          });
                          
                          setForm({ ...form, assignedTask: updatedTasks });
                        }}
                        disabled={isSubmitting}
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
                    ))}
                  </>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              className={`btn w-full ${isSubmitting ? 'btn-disabled opacity-50 cursor-not-allowed' : 'btn-success'}`} 
              disabled={isSubmitting}
              style={{ 
                pointerEvents: isSubmitting ? 'none' : 'auto',
                userSelect: isSubmitting ? 'none' : 'auto'
              }}
              onMouseDown={(e) => {
                if (isSubmitting) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  กำลังบันทึก...
                </>
              ) : (
                isEditing ? 'อัปเดตข้อมูล' : 'บันทึกข้อมูล'
              )}
                        </button>
          </form>
        )}
          </>
        )}
      </div>
    </div>
    </LayoutAdmin>
  );
}
