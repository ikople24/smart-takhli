import { useRouter } from "next/router";
import { AlignJustify, Lock } from "lucide-react";

const AdminDropdownMenu = ({ links, show, loading, disabled }) => {
  const router = useRouter();

  if (!show) return null;

  // ถ้าถูก disabled → แสดงไอคอนล็อค
  if (disabled) {
    return (
      <div className="tooltip tooltip-right" data-tip="ไม่มีสิทธิ์เข้าถึงเมนู">
        <button
          className="btn btn-sm btn-ghost text-gray-400 cursor-not-allowed"
          disabled
        >
          <Lock className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="dropdown dropdown-right">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost text-gray-700 hover:text-gray-900"
      >
        {loading ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : (
          <AlignJustify className="w-5 h-5" />
        )}
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-[100] menu p-2 shadow bg-base-100 rounded-box w-64 max-h-[70vh] overflow-y-auto"
      >
        {loading ? (
          <li className="text-center py-4">
            <span className="loading loading-spinner loading-sm"></span>
          </li>
        ) : links.length === 0 ? (
          <li className="text-center py-4 text-gray-400">
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              ไม่มีสิทธิ์เข้าถึงเมนู
            </span>
          </li>
        ) : (
          links.map(({ path, label }, index) => (
            <li key={index}>
              <button
                className="text-black hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={() => router.push(path)}
              >
                {label}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default AdminDropdownMenu;