import BottomNav from "./BottomNav";
import TopNavbar from "./TopNavbar";
import { LayoutAdmin } from "./LayoutAdmin";
import { useRouter } from "next/router";

// metadata สำหรับแต่ละ admin page — title / subtitle / breadcrumbs / noSidebar
const ADMIN_META = {
  '/admin':                           { title: 'ตั้งค่าหน้าจอ' },
  '/admin/dashboard':                 { title: 'แดชบอร์ด' },
  '/admin/manage-complaints':         { title: 'การร้องเรียน' },
  '/admin/smart-health':              { title: 'Smart Health' },
  '/admin/smart-school':              { title: 'Smart School' },
  '/admin/register-user':             { title: 'จัดการผู้ใช้งาน' },
  '/admin/manage-activities':         { title: 'จัดการกิจกรรม' },
  '/admin/pm25-settings':             { title: 'จัดการ PM2.5' },
  '/admin/elderly-cards':             { title: 'ข้อมูลผู้สูงอายุ' },
  '/admin/elderly-schedule':          { title: 'ตารางเยี่ยมผู้สูงอายุ' },
  '/admin/feedback-analysis':         { title: 'วิเคราะห์ความคิดเห็น' },
  '/admin/my-tasks': {
    title: 'KPI งานของฉัน',
    subtitle: 'สรุปภาระงานและผลการดำเนินการ',
    breadcrumbs: [
      { label: 'Dashboard', href: '/admin/dashboard' },
      { label: 'KPI งานของฉัน' },
    ],
  },
  '/admin/notifications': {
    title: 'การแจ้งเตือน',
    subtitle: 'ดูและจัดการการแจ้งเตือนของคุณ',
    breadcrumbs: [
      { label: 'Dashboard', href: '/admin/dashboard' },
      { label: 'การแจ้งเตือน' },
    ],
  },
  '/admin/analytics': {
    title: 'วิเคราะห์สถิติ',
    subtitle: 'ภาพรวมประสิทธิภาพและแนวโน้มของระบบ',
    breadcrumbs: [
      { label: 'Admin', href: '/admin' },
      { label: 'วิเคราะห์สถิติ' },
    ],
  },
  '/admin/smart-papar/water-quality':   { title: 'คุณภาพน้ำ (ประปา)' },
  '/admin/smart-light':               { title: 'เสาไฟสาธารณะ (กองช่าง)', fullBleed: true },
  '/admin/settings/organizations':     { title: 'ข้อมูลองค์กร', subtitle: 'จัดการข้อมูลองค์กรและสำนักงาน' },
  '/admin/settings/communities':       { title: 'ข้อมูลชุมชน', subtitle: 'จัดการข้อมูลชุมชนในพื้นที่' },
  '/admin/settings/geojson-map':      { title: 'แผนที่ GeoJSON', subtitle: 'จัดการและแสดงผล GeoJSON พื้นที่บริการ' },
  '/admin/superadmin':                { title: 'การบริหารระบบ' },
  '/admin/superadmin/audit-log':      { title: 'Audit Log' },
  '/admin/superadmin/setup':          { title: 'ตั้งค่า Superadmin', noSidebar: true },
};

const Layout = ({ children }) => {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith("/admin");

  if (isAdminRoute) {
    // หา metadata ตาม pathname (fallback ว่างถ้าไม่มีใน map)
    const meta = ADMIN_META[router.pathname] || {};
    return (
      <div className="h-screen overflow-hidden w-full min-w-[320px]">
        {/*
          LayoutAdmin อยู่ที่นี่ (ไม่ใช่ใน page component)
          → sidebar state ไม่ถูก reset เมื่อ navigate ระหว่าง admin pages
        */}
        <LayoutAdmin
          title={meta.title}
          subtitle={meta.subtitle}
          breadcrumbs={meta.breadcrumbs}
          noSidebar={meta.noSidebar}
          fullBleed={meta.fullBleed}
        >
          {children}
        </LayoutAdmin>
        <BottomNav />
      </div>
    );
  }

  // Public / User pages: layout เดิม
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 w-full min-w-[320px]">
      <TopNavbar />
      <main className="flex-1 pb-16 px-4 pt-4 flex flex-col gap-4 w-full overflow-x-hidden">
        <div className="w-full">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;
