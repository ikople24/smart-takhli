import React, { useEffect, useState } from "react";
import Image from "next/image";
import { BadgeCheck, User, Calendar, Clock, Shield } from "lucide-react";
import { useAdminOptionsStore } from "@/stores/useAdminOptionsStore";

export default function CardAssignment({ probId }) {
  const [assignment, setAssignment] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);
  const adminOptions = useAdminOptionsStore((state) => state.adminOptions);
  const fetchAdminOptions = useAdminOptionsStore.getState().fetchAdminOptions;
  
  useEffect(() => {
    fetchAdminOptions(); // ดึงข้อมูลทันทีเมื่อโหลด component
  }, [fetchAdminOptions]);

  // debug: console.log("🧠 all adminOptions from store:", adminOptions);
  const matchedOptions =
    Array.isArray(assignment?.solution) && assignment.solution.length > 0
      ? adminOptions.filter((opt) =>
          assignment.solution.includes(opt.label)
        )
      : adminOptions.filter(
          (opt) =>
            typeof opt.label === "string" &&
            typeof assignment?.solution === "string" &&
            opt.label.trim() === assignment.solution.trim()
        );
  // debug: console.log(
  //   "🔍 matchedOptions:",
  //   matchedOptions,
  //   "assignment.solution:",
  //   assignment?.solution
  // );
  if (!matchedOptions || matchedOptions.length === 0) {
    // debug: console.warn(
    //   "⚠️ No match found for solution:",
    //   assignment?.solution,
    //   "in options:",
    //   adminOptions.map((o) => o.label)
    // );
  }
  const [currentIndex, setCurrentIndex] = useState(0); // currentIndex is used for image display

  const handlePrev = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? assignment.solutionImages.length - 1 : prevIndex - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === assignment.solutionImages.length - 1 ? 0 : prevIndex + 1
    );
  };

  useEffect(() => {
    async function fetchAssignment() {
      try {
        const res = await fetch(
          `/api/assignments/by-complaint?complaintId=${probId}`
        );
        const data = await res.json();
        console.log("📦 assignment data:", data);
        setAssignment(data.data?.[0]);
      } catch (error) {
        console.error("Failed to fetch assignment:", error);
      }
    }

    if (probId) {
      fetchAssignment();
    }
  }, [probId]);

  // ดึงข้อมูลเจ้าหน้าที่ที่รับผิดชอบ
  useEffect(() => {
    async function fetchAssignedUser() {
      if (assignment?.userId) {
        try {
          console.log("🔍 Fetching user with ID:", assignment.userId);
          const res = await fetch(`/api/users/get-by-id?userId=${assignment.userId}`);
          const data = await res.json();
          console.log("👤 User data response:", data);
          if (data.success && data.user) {
            const profileUrl = data.user.profileUrl || data.user.profileImage;
            console.log("🖼️ Profile image URL:", profileUrl);
            if (profileUrl) {
              const isValidUrl = profileUrl.startsWith('http');
              const isRelativePath = profileUrl.startsWith('/');
              const isAllowedDomain = profileUrl.includes('res.cloudinary.com') || 
                                    profileUrl.includes('storage.googleapis.com') || 
                                    profileUrl.includes('cdn-icons-png.flaticon.com') || 
                                    profileUrl.includes('images.clerk.dev');
              console.log("🖼️ URL is valid:", isValidUrl, "Is relative:", isRelativePath, "Allowed domain:", isAllowedDomain);
            }
            setAssignedUser(data.user);
          }
        } catch (error) {
          console.error("Failed to fetch assigned user:", error);
        }
      }
    }

    if (assignment?.userId) {
      fetchAssignedUser();
    }
  }, [assignment?.userId]);

  if (
    !assignment ||
    (
      (!assignment.solution ||
        (Array.isArray(assignment.solution) &&
          assignment.solution.every((s) => !s || (typeof s === "string" && s.trim() === ""))) ||
        (typeof assignment.solution === "string" && assignment.solution.trim() === "")) &&
      (!assignment.note || (typeof assignment.note === "string" && assignment.note.trim() === "")) &&
      (!Array.isArray(assignment.solutionImages) || assignment.solutionImages.length === 0)
    ) ||
    !Array.isArray(assignment.solutionImages) || assignment.solutionImages.length === 0
  ) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-md rounded-md p-[6px]">
      <div className="flex flex-col justify-between space-y-4">
        {/* เจ้าหน้าที่รับผิดชอบ Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h2 className="text-lg font-semibold mb-3 text-blue-800 flex items-center gap-2">
            <User className="w-5 h-5" />
            เจ้าหน้าที่รับผิดชอบ
          </h2>
          {assignedUser ? (
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {(assignedUser.profileUrl || assignedUser.profileImage) ? (
                  <Image
                    src={assignedUser.profileUrl || assignedUser.profileImage}
                    alt="Profile"
                    width={60}
                    height={60}
                    className="w-15 h-15 rounded-full object-cover border-2 border-blue-300"
                    onError={(e) => {
                      console.log("🖼️ Image failed to load, using fallback");
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                    unoptimized={true}
                  />
                ) : null}
                <div className={`w-15 h-15 rounded-full border-2 border-blue-300 bg-blue-100 flex items-center justify-center ${(assignedUser.profileUrl || assignedUser.profileImage) ? 'hidden' : 'flex'}`}>
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="text-lg font-medium text-gray-900">{assignedUser.name}</div>
                <div className="text-sm text-gray-600">{assignedUser.position}</div>
                <div className="text-sm text-gray-600">{assignedUser.department}</div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>รับเรื่อง: {new Date(assignment.assignedAt).toLocaleDateString('th-TH')}</span>
                  </div>
                  {assignment.completedAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>เสร็จสิ้น: {new Date(assignment.completedAt).toLocaleDateString('th-TH')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              {assignment?.userId ? "กำลังโหลดข้อมูลเจ้าหน้าที่..." : "ไม่พบข้อมูลเจ้าหน้าที่ที่รับผิดชอบ"}
            </div>
          )}
        </div>

        {/* วิธีดำเนินการ Section */}
        <div>
          <h2 className="text-md font-semibold mb-4">การดำเนินการ</h2>
          <div className="relative">
            <Image
              src={assignment?.solutionImages?.[currentIndex] ?? ""}
              alt={`Main Image ${currentIndex + 1}`}
              width={800}
              height={400}
              className="w-full h-64 object-cover rounded-t-md transition-all duration-500"
            />
            {assignment?.solutionImages?.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute top-1/2 left-3 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
                >
                  ‹
                </button>
                <button
                  onClick={handleNext}
                  className="absolute top-1/2 right-3 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-75"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>

        {/* เจ้าหน้าที่ Section */}
        <div className="grid grid-cols-5 gap-4 items-start h-full">
          <div className="col-span-3 pr-6 border-r border-gray-300 h-full">
            <div className="text-md font-semibold mb-4">
              วิธีดำเนินการ (ทั้งหมด)
            </div>
            <div className="space-y-3">
              {matchedOptions.map((opt) => (
                <div key={opt.label} className="flex flex-col-2 justify-between items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src={opt.icon_url || "/check-icon.png"}
                      alt="icon"
                      width={24}
                      height={24}
                      className="w-6 h-6"
                    />
                    <span className="text-sm text-gray-800">{opt.label}</span>
                  </div>
                  <BadgeCheck className="w-4 h-4 text-green-500" />
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-md font-semibold mb-2">บันทึกเจ้าหน้าที่</div>
            <div className="bg-green-200 border border-green-200 rounded-md p-4 text-green-800 text-sm">
              <p>{assignment?.note}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
