import React from "react";
import dynamic from "next/dynamic";

const BorrowReturnTable = dynamic(() =>
  import("../../components/sm-health/BorrowReturnTable"), { ssr: false }
);

const SatisfactionPage = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">แบบประเมินความพึงพอใจ</h1>
      <BorrowReturnTable showOnlyUnevaluated />
    </div>
  );
};

export default SatisfactionPage;