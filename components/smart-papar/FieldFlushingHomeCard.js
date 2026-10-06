// การ์ด "บันทึกโบตะกอน" บนหน้าแรก — โชว์เฉพาะเครื่องที่เจ้าหน้าที่ใส่รหัสภาคสนามแล้ว ประชาชนทั่วไปไม่เห็น
// โหลดไม่ได้/ยังไม่ได้ใส่รหัส → ไม่เรนเดอร์อะไรเลย (ทางเข้าครั้งแรกคือลิงก์ "สำหรับเจ้าหน้าที่" ท้ายหน้า)
import { useEffect, useState } from "react";
import Link from "next/link";

export default function FieldFlushingHomeCard() {
  const [name, setName] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/smart-papar/field/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.unlocked) setName(d.name || "เจ้าหน้าที่");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!name) return null;

  return (
    <Link
      href="/papar/flushing"
      className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-sky-600 to-blue-700 p-4 text-white shadow-sm"
    >
      <span className="text-3xl">🚿</span>
      <span className="flex-1">
        <span className="block text-lg font-bold">บันทึกโบตะกอน</span>
        <span className="block text-sm text-sky-100">เจ้าหน้าที่: {name}</span>
      </span>
      <span className="text-2xl">›</span>
    </Link>
  );
}
