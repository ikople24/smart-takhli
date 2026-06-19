import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaUpload } from 'react-icons/fa';
import Image from 'next/image';

export default function EducationEditModal({ isOpen, onClose, data, onSave }) {
  const [formData, setFormData] = useState({
    prefix: '',
    name: '',
    educationLevel: '',
    phone: '',
    address: '',
    actualAddress: '',
    familyStatus: [],
    note: '',
    schoolName: '',
    gradeLevel: '',
    gpa: '',
    imageUrl: [],
    location: { lat: 0, lng: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (data) {
      setFormData({
        prefix: data.prefix || '',
        name: data.name || '',
        educationLevel: data.educationLevel || '',
        phone: data.phone || '',
        address: data.address || '',
        actualAddress: data.actualAddress || '',
        familyStatus: data.familyStatus ? (Array.isArray(data.familyStatus) ? data.familyStatus : [data.familyStatus]) : [],
        note: data.note || '',
        schoolName: data.schoolName || '',
        gradeLevel: data.gradeLevel || '',
        gpa: data.gpa || '',
        imageUrl: data.imageUrl || [],
        location: data.location || { lat: 0, lng: 0 }
      });
    }
  }, [data]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'actualAddress') {
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFamilyStatusChange = (status) => {
    setFormData(prev => ({
      ...prev,
      familyStatus: prev.familyStatus.includes(status)
        ? prev.familyStatus.filter(item => item !== status)
        : [...prev.familyStatus, status]
    }));
  };

  const handleLocationChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        [name]: parseFloat(value)
      }
    }));
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    setIsLoading(true);
    
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const result = await response.json();
          uploadedUrls.push(result.url);
        }
      }
      
      setFormData(prev => ({
        ...prev,
        imageUrl: [...prev.imageUrl, ...uploadedUrls]
      }));
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      imageUrl: prev.imageUrl.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">แก้ไขข้อมูลการศึกษา</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                คำนำหน้า
              </label>
              <input
                type="text"
                name="prefix"
                value={formData.prefix}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น นาย, นาง, นางสาว"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                ชื่อ-นามสกุล *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ชื่อ-นามสกุล"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                ระดับการศึกษา
              </label>
              <select
                name="educationLevel"
                value={formData.educationLevel}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">เลือกระดับการศึกษา</option>
                <option value="อนุบาล">อนุบาล</option>
                <option value="ประถม">ประถม</option>
                <option value="มัธยมต้น">มัธยมต้น</option>
                <option value="มัธยมปลาย">มัธยมปลาย</option>
                <option value="ปวช.">ปวช.</option>
                <option value="ปวส.">ปวส.</option>
                <option value="ปริญญาตรี">ปริญญาตรี</option>
              </select>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เบอร์โทรศัพท์"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                ชื่อสถานศึกษา
              </label>
              <input
                type="text"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ชื่อสถานศึกษา"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                ระดับชั้น
              </label>
              <input
                type="text"
                name="gradeLevel"
                value={formData.gradeLevel}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น ป.1, ม.1, ม.4"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                เกรดเฉลี่ย (GPA)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="4"
                name="gpa"
                value={formData.gpa}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00 - 4.00"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                สถานภาพครอบครัว
              </label>
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.familyStatus.includes('บิดา-มารดาแยกกันอยู่')}
                    onChange={() => handleFamilyStatusChange('บิดา-มารดาแยกกันอยู่')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">บิดา-มารดาแยกกันอยู่</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.familyStatus.includes('แยกกันอยู่ชั่วคราว')}
                    onChange={() => handleFamilyStatusChange('แยกกันอยู่ชั่วคราว')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">แยกกันอยู่ชั่วคราว</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.familyStatus.includes('หย่าร้าง')}
                    onChange={() => handleFamilyStatusChange('หย่าร้าง')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">หย่าร้าง</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.familyStatus.includes('บิดาส่งเสีย')}
                    onChange={() => handleFamilyStatusChange('บิดาส่งเสีย')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">บิดาส่งเสีย</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.familyStatus.includes('มารดาส่งเสีย')}
                    onChange={() => handleFamilyStatusChange('มารดาส่งเสีย')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">มารดาส่งเสีย</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.familyStatus.includes('บิดา/มารดาไม่ได้ส่งเสีย')}
                    onChange={() => handleFamilyStatusChange('บิดา/มารดาไม่ได้ส่งเสีย')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">บิดา/มารดาไม่ได้ส่งเสีย</span>
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              ที่อยู่
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ที่อยู่"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              ที่อยู่อาศัยจริง
            </label>
            <textarea
              name="actualAddress"
              value={formData.actualAddress}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ที่อยู่อาศัยจริง (ถ้าแตกต่างจากที่อยู่ข้างต้น)"
              style={{ borderColor: '#3B82F6', backgroundColor: '#F8FAFC' }}
            />
            <div className="text-xs text-gray-500">
              💡 กรอกที่อยู่อาศัยจริงหากแตกต่างจากที่อยู่ข้างต้น
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              หมายเหตุ
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="หมายเหตุเพิ่มเติม"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                ละติจูด
              </label>
              <input
                type="number"
                step="any"
                name="lat"
                value={formData.location.lat}
                onChange={handleLocationChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ละติจูด"
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                ลองจิจูด
              </label>
              <input
                type="number"
                step="any"
                name="lng"
                value={formData.location.lng}
                onChange={handleLocationChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ลองจิจูด"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              รูปภาพ (สูงสุด 3 รูป)
            </label>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition flex items-center space-x-2">
                  <FaUpload />
                  <span>อัปโหลดรูปภาพ</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={formData.imageUrl.length >= 3 || isLoading}
                  />
                </label>
                {isLoading && <span className="text-sm text-gray-500">กำลังอัปโหลด...</span>}
              </div>

              {formData.imageUrl.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {formData.imageUrl.map((url, index) => (
                    <div key={index} className="relative">
                      <Image
                        src={url}
                        alt={`รูปภาพ ${index + 1}`}
                        width={200}
                        height={150}
                        className="w-full h-32 object-cover rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition"
                      >
                        <FaTimes size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition flex items-center space-x-2 disabled:opacity-50"
            >
              <FaSave />
              <span>{isLoading ? 'กำลังบันทึก...' : 'บันทึก'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 