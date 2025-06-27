import { useRouter } from "next/router";
import { AlignJustify } from "lucide-react";

const AdminDropdownMenu = ({ links, show }) => {
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
        className="dropdown-content z-[100] menu p-2 shadow bg-base-100 rounded-box w-52"
      >
        {links.map(({ path, label }, index) => (
          <li key={index}>
            <button
              className="text-black hover:text-primary"
              onClick={() => router.push(path)}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminDropdownMenu;