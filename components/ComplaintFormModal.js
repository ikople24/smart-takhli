

const ComplaintFormModal = ({ selectedLabel, onClose }) => {
  if (!selectedLabel) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center transition-all">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md transform transition-all duration-300 opacity-0 scale-95 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            ฟอร์มสำหรับ: {selectedLabel}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm"
          >
            ✕
          </button>
        </div>
        <form className="space-y-3">
          <input className="w-full border rounded px-3 py-2 transition-all duration-200 focus:ring-2 focus:ring-blue-400 focus:outline-none" placeholder="ชื่อผู้ร้อง" />
          <textarea className="w-full border rounded px-3 py-2 transition-all duration-200 focus:ring-2 focus:ring-blue-400 focus:outline-none" placeholder="รายละเอียด" rows={3} />
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            ส่งเรื่อง
          </button>
        </form>
      </div>
    </div>
  );
};

export default ComplaintFormModal;