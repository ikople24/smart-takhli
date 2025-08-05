import React from 'react';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  totalItems,
  currentItemsCount 
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pagination Controls */}
      <div className="join flex justify-center">
        <button
          className="join-item btn btn-sm"
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1}
        >
          «
        </button>
        <button className="join-item btn btn-sm">
          หน้า {currentPage} จาก {totalPages}
        </button>
        <button
          className="join-item btn btn-sm"
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          »
        </button>
      </div>

      {/* Summary */}
      {totalItems > 0 && (
        <div className="text-center text-sm text-gray-500">
          แสดง {currentItemsCount} รายการจากทั้งหมด {totalItems} รายการ
        </div>
      )}
    </div>
  );
};

export default Pagination; 