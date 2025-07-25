import ImageUploads from '@/components/ImageUploads';
import React, { useState } from 'react';
import LocationConfirm from '@/components/LocationConfirm';
import Swal from 'sweetalert2';

export default function EducationFormModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState({
    educationLevel: '',
    prefix: '',
    fullName: '',
    address: '',
    phone: '',
    note: '',
    image: [],
  });
  const [useCurrent, setUseCurrent] = useState(false);
  const [location, setLocation] = useState(null);

  // ImageUploads will handle image upload and update formData.image as array of URLs

  const handleSubmit = async () => {
    if (
      !formData.educationLevel ||
      !formData.prefix ||
      !formData.fullName ||
      !formData.address ||
      !formData.phone ||
      !formData.note ||
      formData.image.length === 0 ||
      !location
    ) {
      Swal.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
      return;
    }

    const payload = {
      ...formData,
      location,
      status: "รับคำร้อง",
    };

    try {
      const res = await fetch('/api/education/education-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        Swal.fire({ icon: 'success', title: 'ส่งข้อมูลเรียบร้อยแล้ว' });
        onClose();
      } else {
        const errData = await res.json();
        Swal.fire({ icon: 'error', title: 'ไม่สามารถส่งข้อมูลได้', text: errData.message });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดขณะส่งข้อมูล' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 relative">
        <button className="absolute top-2 right-2 text-gray-500" onClick={onClose}>✕</button>
        <h2 className="text-lg font-semibold text-center text-blue-600">แบบฟอร์มสำรวจการศึกษา</h2>

        <label className="font-extrabold text-sm text-gray-600">ระดับการศึกษา</label>
        <div className="flex flex-wrap gap-2 justify-center">
          {["มัธยมต้น", "มัธยมปลาย", "ปวช", "ปวส", "ปริญญาตรี"].map((level) => (
            <button
              key={level}
              type="button"
              className={`btn btn-sm rounded-full ${
                formData.educationLevel === level ? "btn-info" : "btn-outline"
              }`}
              onClick={() => setFormData({ ...formData, educationLevel: level })}
            >
              {level}
            </button>
          ))}
        </div>

        <label className="font-extrabold text-sm text-gray-600">1. คำนำหน้า</label>
        <div className="flex flex-wrap gap-2 justify-center">
          {["ดช.", "ดญ.", "นาย", "นางสาว"].map((prefix) => (
            <button
              key={prefix}
              type="button"
              className={`btn btn-sm rounded-full ${
                formData.prefix === prefix ? "btn-info" : "btn-outline"
              }`}
              onClick={() => setFormData({ ...formData, prefix })}
            >
              {prefix}
            </button>
          ))}
        </div>

        <label className="font-extrabold text-sm text-gray-600">2. ชื่อ-นามสกุล</label>
        <input
          type="text"
          placeholder="ชื่อ-นามสกุล"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="input input-bordered w-full"
        />

        <label className="font-extrabold text-sm text-gray-600">3. ที่อยู่</label>
        <textarea
          placeholder="ที่อยู่"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="textarea textarea-bordered w-full"
        />

        <label className="font-extrabold text-sm text-gray-600">4. เบอร์โทร</label>
        <input
          type="tel"
          placeholder="เบอร์โทร 10 หลัก"
          value={formData.phone}
          maxLength={10}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/, '') })}
          className="input input-bordered w-full"
        />

        <label className="font-extrabold text-sm text-gray-600">5. หมายเหตุ</label>
        <textarea
          placeholder="หมายเหตุ (ถ้ามี)"
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          className="textarea textarea-bordered w-full"
        />

        <label className="font-extrabold text-sm text-gray-600">6. อัพโหลดรูปภาพ</label>
        <ImageUploads onChange={(urls) => setFormData({ ...formData, image: urls })} />

        <label className="font-extrabold text-sm text-gray-600">7. ตำแหน่งที่ตั้ง</label>
        <LocationConfirm
          useCurrent={useCurrent}
          onToggle={setUseCurrent}
          location={location}
          setLocation={setLocation}
          formSubmitted={false}
        />

        <div className="flex gap-2 pt-2">
          <button className="btn btn-secondary flex-1" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary flex-1" onClick={handleSubmit}>ส่งข้อมูล</button>
        </div>
      </div>
    </div>
  );
}