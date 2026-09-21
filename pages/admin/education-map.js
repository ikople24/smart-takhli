// pages/admin/education-map.js — path เดิม redirect ไปโมดูลใหม่
// (คงไว้เผื่อบุ๊กมาร์ก/ลิงก์เก่าของเจ้าหน้าที่ — โค้ดหน้าเดิมดูได้จาก git history)
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function EducationMapRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/smart-school");
  }, [router]);
  return null;
}
