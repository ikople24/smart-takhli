import Link from "next/link";
import { useRouter } from "next/router";

const navs = [
  { label: "SMART-NAMPHRAE", path: "/" },
  { label: "อยู่ระหว่างดำเนินการ", path: "/complaint", disabled: true },
  { label: "ดำเนินการเสร็จสิ้น", path: "/status", disabled: true },
];

export default function BottomNav() {
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow z-50 flex justify-around items-center h-14 px-safe">
      {navs.map((nav) => (
        <div key={nav.path}>
          {nav.disabled ? (
            <button
              onClick={() => alert("อยู่ระหว่างดำเนินการปรับปรุงระบบ")}
              className="text-xs text-center text-gray-400 cursor-not-allowed"
              disabled
            >
              {nav.label}
            </button>
          ) : (
            <Link href={nav.path}>
              <div className={`text-xs text-center ${router.pathname === nav.path ? "text-blue-600 font-bold" : "text-gray-500"}`}>
                {nav.label}
              </div>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}