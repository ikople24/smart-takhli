import React from 'react';
import LocationConfirm from '@/components/LocationConfirm';
import PhotoSlots from './PhotoSlots';
import { labelCls } from './surveyTheme';

// ขั้นที่ 3: รูปภาพ + พิกัด (ปุ่มดำเนินการอยู่ที่ orchestrator)
export default function MediaStep({
  formData, setFormData,
  useCurrent, setUseCurrent,
  location, setLocation,
  onUploadingChange,
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>อัปโหลดรูปภาพ (ถ่ายใหม่ปีนี้)</label>
        <p className="-mt-0.5 mb-2.5 text-[10.5px] leading-snug text-[#8A8398]">
          แนบ 3 รูปตามหัวข้อ แตะช่องเพื่อถ่ายหรือเลือกไฟล์
        </p>
        <PhotoSlots
          value={formData.image}
          onChange={(urls) => setFormData({ ...formData, image: urls })}
          onUploadingChange={onUploadingChange}
        />
        <p className="mt-2 text-[10px] text-[#8A8398]">รองรับ .jpg .png ขนาดไม่เกิน 5MB</p>
      </div>

      <div>
        <label className={labelCls}>ตำแหน่งที่ตั้ง</label>
        {location?.lat && (
          <div className="mb-2 rounded-[12px] bg-[#EDE7FD] px-3 py-2.5 text-[11px] leading-relaxed text-[#5B21B6]">
            📍 ใช้ตำแหน่งเดิมจากปีที่แล้ว ({location.lat.toFixed(5)}, {location.lng.toFixed(5)}) — เปิดสวิตช์ด้านล่างเพื่ออัปเดตเป็นตำแหน่งปัจจุบัน หากย้ายที่อยู่
          </div>
        )}
        <LocationConfirm
          useCurrent={useCurrent}
          onToggle={setUseCurrent}
          location={location}
          setLocation={setLocation}
          formSubmitted={false}
          accent="purple"
        />
      </div>
    </div>
  );
}
