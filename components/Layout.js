import BottomNav from "./BottomNav";
import TopNavbar from "./TopNavbar";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 w-full max-w-screen-sm min-w-[320px] mx-auto">
      <TopNavbar/>
      <main className="flex-1 pb-16 px-4 pt-4 flex flex-col gap-4 w-full max-w-screen-sm mx-auto overflow-x-hidden">
        <div className="w-full">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;