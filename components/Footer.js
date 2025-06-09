import { Globe, Youtube, Facebook } from "lucide-react";


export default function Footer() {
  return (
    <footer className="bg-white/30 text-gray-800 text-sm py-3 px-4 backdrop-blur-md border-t border-gray-300 flex justify-between items-center">
      <div>© 2025 SMART-TAKHLI — v.4.0.1</div>
      <div className="flex gap-4 text-lg">
        <a href="https://www.takhlicity.go.th" className="hover:text-[#1DA1F2] transition-colors duration-200"><Globe size={20} strokeWidth={1.5} /></a>
        <a href="#" className="hover:text-[#FF0000] transition-colors duration-200"><Youtube size={20} strokeWidth={1.5} /></a>
        <a href="https://www.facebook.com/profile.php?id=100064581164088" className="hover:text-[#1877F2] transition-colors duration-200"><Facebook size={20} strokeWidth={1.5} /></a>
      </div>
    </footer>
  );
}