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
    note: '',
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
        note: data.note || '',
        imageUrl: data.imageUrl || [],
        location: data.location || { lat: 0, lng: 0 }
      });
    }
  }, [data]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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

          <div className="flex justify-end space-x-3 pt-4 border-t">
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