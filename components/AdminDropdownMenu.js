import { useRouter } from "next/router";
import { AlignJustify } from "lucide-react";

const AdminDropdownMenu = ({ links, show, loading }) => {
  const router = useRouter();

  if (!show) return null;

  return (
    <div className="dropdown dropdown-right">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost text-gray-700 hover:text-gray-900"
      >
        <AlignJustify className="w-5 h-5" />
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
          <li className="text-center py-4">
            <span className="text-gray-400">ไม่มีเมนู</span>
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