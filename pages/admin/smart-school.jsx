import PermissionGuard from "@/components/PermissionGuard";
import SmartSchoolDashboard from "@/components/smart-school/admin/SmartSchoolDashboard";

// Smart School — ระบบสำรวจการศึกษา/ทุนการศึกษา (แทน /admin/education-map เดิม)
export default function SmartSchoolPage() {
  return (
    <PermissionGuard>
      <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5">
            <p className="text-lg font-semibold text-gray-900">Smart School — สำรวจการศึกษา</p>
            <p className="text-xs text-gray-500 mt-1">
              ทะเบียนผู้ขอทุนรายบุคคล + ใบสมัครรายปีงบประมาณ พร้อมกติกาหมุนเวียนทุนต่อครัวเรือน
            </p>
          </div>
          <SmartSchoolDashboard />
        </div>
      </main>
    </PermissionGuard>
  );
}
