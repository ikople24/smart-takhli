import PermissionGuard from "@/components/PermissionGuard";
import ElderlySchoolDashboard from "@/components/elderly-school/ElderlySchoolDashboard";

// โรงเรียนผู้สูงอายุ — แยกเป็นโมดูลของตัวเองจากแท็บใน /admin/smart-health
export default function ElderlySchoolPage() {
  return (
    <PermissionGuard>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <p className="text-lg font-semibold text-gray-900">โรงเรียนผู้สูงอายุ</p>
            <p className="text-xs text-gray-500 mt-1">
              แดชบอร์ดสุขภาพผู้เรียน เช็คอินรายครั้ง การประเมินสุขภาพจิต และการนำเข้าข้อมูลจากชีต
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <ElderlySchoolDashboard />
          </div>
        </div>
      </main>
    </PermissionGuard>
  );
}
