import React, { useState, useRef } from 'react';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import CommunitySelector from './CommunitySelector';
import ReporterInput from './ReporterInput';
import ListButtonComplaint from './ListButtonComplaint';
import ImageUploads from './ImageUploads';
import Swal from 'sweetalert2';
const LocationConfirm = dynamic(() => import('./LocationConfirm'), { ssr: false });

const ComplaintFormModal = ({ selectedLabel, onClose }) => {
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [prefix, setPrefix] = useState('นาย');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [detail, setDetail] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [location, setLocation] = useState(null);
  const [selectedProblems, setSelectedProblems] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!location) {
      await Swal.fire({
        icon: 'warning',
        title: 'กรุณาเลือกตำแหน่ง',
        text: 'ต้องระบุตำแหน่งก่อนส่งเรื่อง',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    if (imageUrls.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'กรุณาอัปโหลดรูปภาพ',
        text: 'ต้องมีอย่างน้อย 1 รูปภาพก่อนส่งเรื่อง',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    if (!fullName.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'กรุณากรอกชื่อผู้แจ้ง',
        text: 'ต้องระบุชื่อผู้แจ้งก่อนส่งเรื่อง',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    if (!selectedCommunity) {
      await Swal.fire({
        icon: 'warning',
        title: 'กรุณาเลือกชุมชน',
        text: 'ต้องเลือกชุมชนก่อนส่งเรื่อง',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    if (selectedProblems.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'กรุณาเลือกรายการปัญหา',
        text: 'ต้องเลือกรายการปัญหาอย่างน้อย 1 รายการ',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    const payload = {
      category: selectedLabel,
      community: selectedCommunity,
      prefix,
      fullName,
      address,
      phone,
      detail,
      imageUrls,
      location,
      problems: selectedProblems,
    };

    console.log('🧾 ค่าที่จะส่งไปยัง API:', payload);

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('ส่งข้อมูลไม่สำเร็จ');
      await Swal.fire({
        icon: 'success',
        title: 'ส่งเรื่องสำเร็จ',
        confirmButtonText: 'ตกลง'
      });
      handleClearForm();
    } catch (err) {
      console.error('❌ เกิดข้อผิดพลาด:', err);
    }
  };

  const handleClearForm = () => {
    setSelectedCommunity('');
    setPrefix('นาย');
    setFullName('');
    setAddress('');
    setImageUrls([]);
    onClose();
  };

  const handleCommunitySelect = (community) => {
    setSelectedCommunity(community);
  };

  useEffect(() => {
  import('leaflet').then(L => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
    });
  });
}, []);

  if (!selectedLabel) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 overflow-y-auto flex items-center justify-center transition-all">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto transform transition-all duration-300 opacity-0 scale-95 animate-fade-in">
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
        <form onSubmit={handleSubmit} className="space-y-3">
          <CommunitySelector
            selected={selectedCommunity}
            onSelect={handleCommunitySelect}
          />
          <ListButtonComplaint
            category={selectedLabel}
            selectedProblems={selectedProblems}
            setSelectedProblems={setSelectedProblems}
          />
          <ImageUploads onChange={(urls) => setImageUrls(urls)} />
          <ReporterInput
            prefix={prefix}
            setPrefix={setPrefix}
            fullName={fullName}
            setFullName={setFullName}
            address={address}
            setAddress={setAddress}
            phone={phone}
            setPhone={setPhone}
            detail={detail}
            setDetail={setDetail}
          />
          <LocationConfirm
            useCurrent={useCurrentLocation}
            onToggle={setUseCurrentLocation}
            location={location}
            setLocation={setLocation}
          />
        <div className="flex mb-4 gap-2 justify-end">
          <button type="button" onClick={handleClearForm} className="bg-gray-100 text-black px-4 py-2 rounded">
            ล้างฟอร์ม
          </button>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            ส่งเรื่อง
          </button>
        </div>
        </form>
      </div>
    </div>
  );
};

export default ComplaintFormModal;