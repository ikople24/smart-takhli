import React from "react";
import { AlignJustify } from "lucide-react";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";

const TopNavbar = () => {
  const { isSignedIn } = useUser();
  return (
    <header className="bg-white/30 backdrop-blur-md border-b border-white/40 shadow-md px-4 py-4 grid grid-cols-3 items-center sticky top-0 z-50">
      <div className="text-xl font-bold text-indigo-600 flex items-center gap-2">
        <AlignJustify className="w-6 h-6 text-gray-400" />
      </div>
      <div className="text-2xl font-semibold text-blue-950 flex justify-center items-center col-start-2 whitespace-nowrap overflow-hidden text-ellipsis">
        <span className="text-sm sm:text-lg md:text-xl lg:text-2xl truncate max-w-full">SMART-NAMPHRAE</span>
      </div>
      <div className="col-start-3 flex justify-end">
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/sign-in" />
        ) : (
          <SignInButton mode="modal">
            <button
              className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center hover:ring-2 hover:ring-indigo-400 transition"
            >
              <span className="sr-only">Sign in</span>
            </button>
          </SignInButton>
        )}
      </div>
    </header>
  );
};

export default TopNavbar;
