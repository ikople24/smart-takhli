import React from 'react';
import ImageUploads from '@/components/ImageUploads';
import LocationConfirm from '@/components/LocationConfirm';

// ขั้นที่ 3: รูปภาพ + พิกัด + ปุ่มส่ง
export default function MediaStep({
  formData, setFormData,
  useCurrent, setUseCurrent,
  location, setLocation,
  isSubmitting, onSubmit, onBack,
  uploading, onUploadingChange,
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">9. อัพโหลดรูปภาพ (ถ่ายใหม่ปีนี้)</label>
        <ImageUploads
          onChange={(urls) => setFormData({ ...formData, image: urls })}
          initialImages={formData.image}
          onUploadingChange={onUploadingChange}
        />
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">10. ตำแหน่งที่ตั้ง</label>
        <LocationConfirm
          useCurrent={useCurrent}
          onToggle={setUseCurrent}
          location={location}
          setLocation={setLocation}
          formSubmitted={false}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-secondary flex-1" onClick={onBack} disabled={isSubmitting}>
          ย้อนกลับ
        </button>
        <button className="btn btn-primary flex-1" onClick={onSubmit} disabled={isSubmitting || uploading}>
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              กำลังส่ง...
            </>
          ) : ('ส่งข้อมูล')}
        </button>
      </div>
    </div>
  );
}
