import { Dialog } from "@headlessui/react";

export default function CardModalDetail({ modalData, onClose }) {
  if (!modalData) return null;

  return (
    <Dialog open={!!modalData} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/10">
      <Dialog.Panel className="bg-white max-w-lg w-full p-6 rounded shadow">
        <Dialog.Title className="text-xl font-bold mb-4">รายละเอียดคำร้อง</Dialog.Title>
        <p><strong>หัวข้อ:</strong> {modalData.title || modalData.problems?.[0]}</p>
        <p className="mt-2"><strong>รายละเอียด:</strong> {modalData.detail}</p>
        <p className="mt-2 text-sm text-gray-500">อัปเดตเมื่อ: {new Date(modalData.updatedAt).toLocaleDateString("th-TH")}</p>
        <div className="mt-4 text-right">
          <button onClick={onClose} className="btn btn-sm btn-outline">ปิด</button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
