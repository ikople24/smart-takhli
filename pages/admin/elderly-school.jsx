import PermissionGuard from "@/components/PermissionGuard";
import ElderlySchoolModule from "@/components/elderly-school/ElderlySchoolModule";

// โรงเรียนผู้สูงอายุ — เมนูย่อยเป็นแท็บใน ?tab= (overview|visits|registry|screening|schedule|cards|import)
// ไม่มีเมนู sidebar แยก: Sidebar หลักมีรายการ "โรงเรียนผู้สูงอายุ" รายการเดียว
export default function ElderlySchoolPage() {
  return (
    <PermissionGuard>
      <ElderlySchoolModule />
    </PermissionGuard>
  );
}
