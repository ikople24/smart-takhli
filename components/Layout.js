import BottomNav from "./BottomNav";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <main className="flex-1 pb-16 px-4 pt-4 flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2 lg:w-2/5">{children}</div>
        <div className="hidden md:block flex-1 bg-gray-200 rounded-xl" />
      </main>
      <BottomNav />
    </div>
  );
};

export default Layout;