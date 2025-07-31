import ImageUploads from '@/components/ImageUploads';
import React, { useState } from 'react';
import LocationConfirm from '@/components/LocationConfirm';
import Swal from 'sweetalert2';
import { z } from 'zod';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Zod schema สำหรับ validation
  const educationFormSchema = z.object({
    educationLevel: z.string().min(1, 'กรุณาเลือกระดับการศึกษา'),
    prefix: z.string().min(1, 'กรุณาเลือกคำนำหน้า'),
    fullName: z.string().min(2, 'ชื่อ-นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร'),
    address: z.string().min(10, 'ที่อยู่ต้องมีอย่างน้อย 10 ตัวอักษร'),
    phone: z.string().length(10, 'เบอร์โทรศัพท์ต้องมี 10 หลัก'),
    note: z.string().min(1, 'กรุณากรอกหมายเหตุ'),
    image: z.array(z.string()).min(1, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป'),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }).nullable().refine((val) => val !== null, 'กรุณาเลือกตำแหน่งที่ตั้ง'),
  });

  // ImageUploads will handle image upload and update formData.image as array of URLs

  const handleSubmit = async () => {
    // ป้องกันการกดปุ่มซ้ำ
    if (isSubmitting) {
      return;
    }

    // Validation ด้วย Zod
    const dataToValidate = {
      ...formData,
      location,
    };

    const result = educationFormSchema.safeParse(dataToValidate);
    if (!result.success) {
      // เรียงลำดับ error ตามความสำคัญ
      const errorOrder = [
        'educationLevel',
        'fullName',
        'address', 
        'phone',
        'note',
        'image',
        'location',
        'prefix'
      ];
      
      const sortedErrors = result.error.errors.sort((a, b) => {
        const aIndex = errorOrder.indexOf(a.path[0]);
        const bIndex = errorOrder.indexOf(b.path[0]);
        return aIndex - bIndex;
      });
      
      const errorMessages = sortedErrors.map((err, index) => `${index + 1}. ${err.message}`).join('\n');
      Swal.fire({ 
        icon: 'warning', 
        title: 'ข้อมูลไม่ครบถ้วน', 
        text: errorMessages,
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    setIsSubmitting(true);

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
        setFormData({
          educationLevel: '',
          prefix: '',
          fullName: '',
          address: '',
          phone: '',
          note: '',
          image: [],
        });
        setLocation(null);
        setUseCurrent(false);
      } else {
        const errData = await res.json();
        Swal.fire({ icon: 'error', title: 'ไม่สามารถส่งข้อมูลได้', text: errData.message });
      }
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดขณะส่งข้อมูล' });
    } finally {
      setIsSubmitting(false);
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
          {["อนุบาล","ประถม","มัธยมต้น", "มัธยมปลาย", "ปวช", "ปวส", "ปริญญาตรี"].map((level) => (
            <button
              key={level}
              type="button"
              className={`btn btn-sm rounded-full ${
                formData.educationLevel === level ? "btn-info" : "btn-outline"
              }`}
              onClick={() => setFormData({ ...formData, educationLevel: level })}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
          disabled={isSubmitting}
        />

        <label className="font-extrabold text-sm text-gray-600">3. ที่อยู่</label>
        <textarea
          placeholder="ที่อยู่"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="textarea textarea-bordered w-full"
          disabled={isSubmitting}
        />

        <label className="font-extrabold text-sm text-gray-600">4. เบอร์โทร</label>
        <input
          type="tel"
          placeholder="เบอร์โทร 10 หลัก"
          value={formData.phone}
          maxLength={10}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/, '') })}
          className="input input-bordered w-full"
          disabled={isSubmitting}
        />

        <label className="font-extrabold text-sm text-gray-600">5. หมายเหตุ</label>
        <textarea
          placeholder="หมายเหตุ (ถ้ามี)"
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          className="textarea textarea-bordered w-full"
          disabled={isSubmitting}
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
          <button 
            className="btn btn-secondary flex-1" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            ยกเลิก
          </button>
          <button 
            className="btn btn-primary flex-1" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                กำลังส่ง...
              </>
            ) : (
              'ส่งข้อมูล'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}