export default function ReporterInfoCard({ reporterInfo, onClose }) {
  if (!reporterInfo) {
    return <div className="text-gray-500">No reporter information available.</div>;
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">ข้อมูลผู้แจ้ง</h3>
        <p className="mb-2"><strong>ชื่อ:</strong> {reporterInfo?.fullName}</p>
        <p className="mb-4"><strong>โทร:</strong> {reporterInfo?.phone}</p>
        <div className="modal-action">
          <button className="btn" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}