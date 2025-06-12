import Link from "next/link";
import { useRouter } from "next/router";
import { Home, Clock, CheckCircle } from "lucide-react";

const navs = [
  { label: "SMART-NAMPHRAE", icon: Home, path: "/" },
  { label: "อยู่ระหว่างดำเนินการ", icon: Clock, path: "/complaint", disabled: false },
  { label: "ดำเนินการเสร็จสิ้น", icon: CheckCircle, path: "/status", disabled: false },
];

export default function BottomNav() {
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white/30 backdrop-blur-md border-t border-white/40 shadow-md z-50 flex justify-around items-center h-14 px-safe">
      {navs.map((nav) =>
        nav.disabled ? (
          <div
            key={nav.path}
            className="text-xs text-center text-gray-400 cursor-not-allowed flex flex-col items-center"
          >
            <nav.icon className="mb-1" stroke="currentColor" />
            <div>{nav.label}</div>
          </div>
        ) : (
          <Link key={nav.path} href={nav.path}>
            <div className={`text-xs text-center ${router.pathname === nav.path ? "text-blue-600 font-bold" : "text-gray-500"} flex flex-col items-center`}>
              <nav.icon className="mb-1" stroke="currentColor" />
              <div>{nav.label}</div>
            </div>
          </Link>
        )
      )}
    </div>
  );
}