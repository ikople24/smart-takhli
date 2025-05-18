

const ComplaintFormModal = ({ selectedLabel, onClose }) => {
  if (!selectedLabel) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
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
          <input className="w-full border rounded px-3 py-2" placeholder="ชื่อผู้ร้อง" />
          <textarea className="w-full border rounded px-3 py-2" placeholder="รายละเอียด" rows={3} />
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            ส่งเรื่อง
          </button>
        </form>
      </div>
    </div>
  );
};

export default ComplaintFormModal;