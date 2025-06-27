import React from "react";
import BorrowReturnTable from "../../components/sm-health/BorrowReturnTable";
import { useUser } from "@clerk/nextjs";

const SatisfactionPage = () => {
  const { user } = useUser();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">แบบประเมินความพึงพอใจ</h1>
      <div className="text-sm text-gray-500 mb-2">
        คุณ: {user?.primaryEmailAddress?.emailAddress || "ไม่พบผู้ใช้"}
      </div>
      <BorrowReturnTable showOnlyUnevaluated />
    </div>
  );
};

export default SatisfactionPage;