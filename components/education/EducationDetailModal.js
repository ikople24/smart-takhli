import React, { useState } from 'react';
import Image from 'next/image';
import { FaMapMarkerAlt, FaPhone, FaGraduationCap, FaUser, FaHome, FaMoneyBillWave, FaUsers, FaImage, FaTimes, FaCalendarAlt, FaIdCard, FaCopy } from 'react-icons/fa';

export default function EducationDetailModal({ data, isOpen, onClose }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [imageLoading, setImageLoading] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  
  // ฟังก์ชันคัดลอกข้อมูล
  const copyToClipboard = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  // ฟังก์ชัน retry ภาพ
  const retryImage = (index) => {
    setImageErrors(prev => ({ ...prev, [`image-${index}`]: false }));
    setImageLoading(prev => ({ ...prev, [`image-${index}`]: true }));
  };
  
  console.log('EducationDetailModal render:', { isOpen, data });
  console.log('Data details:', {
    applicantId: data?.applicantId,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
    _id: data?._id,
    imageUrl: data?.imageUrl
  });

  // Reset loading state when modal opens
  React.useEffect(() => {
    if (isOpen && data?.imageUrl) {
      console.log('Modal opened with images:', data.imageUrl);
      const newLoadingState = {};
      const newErrorState = {};
      data.imageUrl.forEach((image, index) => {
        console.log(`Setting up image ${index}:`, image);
        newLoadingState[`image-${index}`] = true;
        newErrorState[`image-${index}`] = false;
      });
      setImageLoading(newLoadingState);
      setImageErrors(newErrorState);
    }
  }, [isOpen, data?.imageUrl]);
  
  if (!isOpen || !data) {
    console.log('Modal not rendering - isOpen:', isOpen, 'data:', !!data);
    return null;
  }

  // คำนวณรายได้ต่อเดือนและต่อวัน
  const calculateIncome = (annualIncome, householdMembers) => {
    if (!annualIncome || isNaN(annualIncome)) return { monthly: 0, daily: 0, perPerson: 0, perPersonMonthly: 0, perPersonDaily: 0 };
    const annual = parseFloat(annualIncome);
    const monthly = annual / 12;
    const daily = monthly / 30;
    const perPerson = annual / (householdMembers || 1);
    const perPersonMonthly = perPerson / 12;
    const perPersonDaily = perPersonMonthly / 30;
    return {
      monthly: Math.round(monthly),
      daily: Math.round(daily),
      perPerson: Math.round(perPerson),
      perPersonMonthly: Math.round(perPersonMonthly),
      perPersonDaily: Math.round(perPersonDaily)
    };
  };

  const { monthly: monthlyIncome, daily: dailyIncome, perPerson: perPersonIncome, perPersonMonthly: perPersonMonthlyIncome } = calculateIncome(data.annualIncome, data.householdMembers);

  // แปลงระดับการศึกษาเป็นสี
  const getLevelColor = (level) => {
    const colors = {
      'อนุบาล': 'bg-pink-500',
      'ประถม': 'bg-yellow-500',
      'มัธยมต้น': 'bg-green-500',
      'มัธยมปลาย': 'bg-blue-500',
      'ปวช': 'bg-indigo-500',
      'ปวช.': 'bg-indigo-500',
      'ปวส': 'bg-purple-500',
      'ปวส.': 'bg-purple-500',
      'ปริญญาตรี': 'bg-red-500',
      'ไม่ระบุ': 'bg-gray-500'
    };
    return colors[level] || colors['ไม่ระบุ'];
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${getLevelColor(data.educationLevel)} flex items-center justify-center text-white font-bold`}>
              {data.educationLevel === 'อนุบาล' ? 'อ' : 
               data.educationLevel === 'ประถม' ? 'ป' :
               data.educationLevel === 'มัธยมต้น' ? 'ม' :
               data.educationLevel === 'มัธยมปลาย' ? 'ม' :
               data.educationLevel === 'ปวช' || data.educationLevel === 'ปวช.' ? 'ช' :
               data.educationLevel === 'ปวส' || data.educationLevel === 'ปวส.' ? 'ส' :
               data.educationLevel === 'ปริญญาตรี' ? 'ต' : '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">ข้อมูลผู้สมัคร</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FaIdCard className="text-blue-500" />
                <span>เลขที่ผู้สมัคร: <span className="font-bold text-blue-600">{data?.applicantId || 'ไม่ระบุ'}</span></span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors duration-200 bg-slate-100 hover:bg-slate-200 rounded-full p-2"
            title="ปิด"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* ข้อมูลส่วนตัว */}
          <div className="space-y-6">
            {/* ข้อมูลพื้นฐาน */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FaUser className="text-blue-500" />
                  ข้อมูลส่วนตัว
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">ชื่อ-นามสกุล</label>
                    <div className="mt-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-gray-800 font-bold text-lg">{data.prefix || ''}{data.name}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">ระดับการศึกษา</label>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-3 py-2 rounded-lg text-sm font-bold text-white ${getLevelColor(data.educationLevel)} shadow-md`}>
                        {data.educationLevel}
                      </span>
                    </div>
                  </div>
                  {(data.schoolName || data.gradeLevel || data.gpa) && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">ข้อมูลสถานศึกษา</label>
                      <div className="mt-2 space-y-2">
                        {data.schoolName && (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2 border border-blue-200">
                            <p className="text-gray-800 text-sm">
                              <span className="font-medium">สถานศึกษา:</span> {data.schoolName}
                            </p>
                          </div>
                        )}
                        {data.gradeLevel && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2 border border-green-200">
                            <p className="text-gray-800 text-sm">
                              <span className="font-medium">ระดับชั้น:</span> {data.gradeLevel}
                            </p>
                          </div>
                        )}
                        {data.gpa && (
                          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2 border border-purple-200">
                            <p className="text-gray-800 text-sm">
                              <span className="font-medium">เกรดเฉลี่ย:</span> {data.gpa}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-600">เบอร์โทรศัพท์</label>
                      {data.phone && (
                        <button
                          onClick={() => copyToClipboard(data.phone, 'phone')}
                          className="text-gray-400 hover:text-blue-500 transition-colors duration-200"
                          title="คัดลอกเบอร์โทรศัพท์"
                        >
                          <FaCopy className="text-xs" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                      {data.phone ? (
                        <a 
                          href={`tel:${data.phone}`}
                          className="text-gray-800 flex items-center gap-2 hover:text-blue-600 hover:underline transition-colors duration-200 cursor-pointer"
                          title="คลิกเพื่อโทร"
                        >
                          <FaPhone className="text-green-500" style={{ transform: 'rotate(90deg)' }} />
                          <span className="font-bold text-lg">{data.phone}</span>
                        </a>
                      ) : (
                        <p className="text-gray-800 flex items-center gap-2">
                          <FaPhone className="text-green-500" style={{ transform: 'rotate(90deg)' }} />
                          <span className="font-medium">ไม่ระบุ</span>
                        </p>
                      )}
                    </div>
                    {copiedField === 'phone' && (
                      <p className="text-green-600 text-xs mt-1">✓ คัดลอกแล้ว</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ที่อยู่ */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FaHome className="text-green-500" />
                  ที่อยู่
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-600">ที่อยู่</label>
                      {data.address && (
                        <button
                          onClick={() => copyToClipboard(data.address, 'address')}
                          className="text-gray-400 hover:text-blue-500 transition-colors duration-200"
                          title="คัดลอกที่อยู่"
                        >
                          <FaCopy className="text-xs" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-3 border border-red-200">
                      <p className="text-gray-800 flex items-center gap-2">
                        <FaMapMarkerAlt className="text-red-500" />
                        <span className="font-medium">{data.address || 'ไม่ระบุ'}</span>
                      </p>
                    </div>
                    {copiedField === 'address' && (
                      <p className="text-green-600 text-xs mt-1">✓ คัดลอกแล้ว</p>
                    )}
                  </div>
                  
                  {data.actualAddress && data.actualAddress !== data.address && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-gray-600">ที่อยู่อาศัยจริง</label>
                        <button
                          onClick={() => copyToClipboard(data.actualAddress, 'actualAddress')}
                          className="text-gray-400 hover:text-blue-500 transition-colors duration-200"
                          title="คัดลอกที่อยู่อาศัยจริง"
                        >
                          <FaCopy className="text-xs" />
                        </button>
                      </div>
                      <div className="mt-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-200">
                        <p className="text-gray-800 flex items-center gap-2">
                          <FaHome className="text-orange-500" />
                          <span className="font-medium">{data.actualAddress}</span>
                        </p>
                      </div>
                      {copiedField === 'actualAddress' && (
                        <p className="text-green-600 text-xs mt-1">✓ คัดลอกแล้ว</p>
                      )}
                    </div>
                  )}
                  {data.location && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">พิกัด</label>
                      <div className="space-y-2">
                        <p className="text-gray-800 text-sm">
                          ละติจูด: {data.location.lat?.toFixed(6)}, ลองจิจูด: {data.location.lng?.toFixed(6)}
                        </p>
                        <div className="flex gap-2">
                          <a 
                            href={`https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors duration-200 cursor-pointer"
                            title="เปิดใน Google Maps"
                          >
                            <FaMapMarkerAlt />
                            Google Maps
                          </a>
                          <a 
                            href={`https://maps.apple.com/?q=${data.location.lat},${data.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-800 text-white text-xs rounded-full hover:bg-gray-900 transition-colors duration-200 cursor-pointer"
                            title="เปิดใน Apple Maps"
                          >
                            <FaMapMarkerAlt />
                            Apple Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ข้อมูลครอบครัว */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FaUsers className="text-purple-500" />
                  ข้อมูลครอบครัว
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <label className="text-xs font-medium text-indigo-700">จำนวนสมาชิก</label>
                    <p className="text-indigo-800 font-bold text-lg">{data.householdMembers || 1} คน</p>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-3 border border-teal-200">
                    <label className="text-xs font-medium text-teal-700">สถานะที่อยู่อาศัย</label>
                    <p className="text-teal-800 font-bold">{data.housingStatus || 'ไม่ระบุ'}</p>
                  </div>
                  <div className="bg-pink-50 rounded-lg p-3 border border-pink-200">
                    <label className="text-xs font-medium text-pink-700">สถานภาพครอบครัว</label>
                    <p className="text-pink-800 font-bold">
                      {data.familyStatus && data.familyStatus.length > 0 
                        ? Array.isArray(data.familyStatus) 
                          ? data.familyStatus.join(', ') 
                          : data.familyStatus
                        : 'ไม่ระบุ'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ข้อมูลรายได้และภาพ */}
            <div className="space-y-6">
              {/* ข้อมูลรายได้ */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FaMoneyBillWave className="text-yellow-500" />
                  ข้อมูลรายได้
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600">รายได้ต่อปี</label>
                    <div className="mt-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                      <p className="text-gray-800 font-medium text-lg">
                        {data.annualIncome ? (
                          <span className="text-green-600 font-bold">{data.annualIncome.toLocaleString()} บาท</span>
                        ) : (
                          <span className="text-gray-500">ไม่ระบุ</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {data.annualIncome && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <label className="text-xs font-medium text-green-700">รายได้ต่อเดือน</label>
                          <p className="text-green-800 font-bold">{monthlyIncome.toLocaleString()} บาท</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <label className="text-xs font-medium text-blue-700">รายได้ต่อวัน</label>
                          <p className="text-blue-800 font-bold">{dailyIncome.toLocaleString()} บาท</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                          <label className="text-xs font-medium text-purple-700">รายได้ต่อคนต่อปี</label>
                          <p className="text-purple-800 font-bold">{perPersonIncome.toLocaleString()} บาท</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                          <label className="text-xs font-medium text-orange-700">รายได้ต่อคนต่อเดือน</label>
                          <p className="text-orange-800 font-bold">{perPersonMonthlyIncome.toLocaleString()} บาท</p>
                        </div>
                      </div>
                    </>
                  )}
                  {data.incomeSource && data.incomeSource.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">แหล่งที่มาของรายได้</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {data.incomeSource.map((source, index) => (
                          <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200 shadow-sm">
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ข้อมูลทุนการศึกษา */}
              {(data.receivedScholarship && data.receivedScholarship.length > 0) || (data.takhliScholarshipHistory && data.takhliScholarshipHistory.length > 0) && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaGraduationCap className="text-indigo-500" />
                    ทุนการศึกษา
                  </h3>
                  <div className="space-y-4">
                    {/* ทุนการศึกษาที่ได้รับ */}
                    {data.receivedScholarship && data.receivedScholarship.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">ทุนการศึกษาที่ได้รับ:</h4>
                        <div className="flex flex-wrap gap-2">
                          {data.receivedScholarship.map((scholarship, index) => (
                            <span key={index} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full border border-green-200 shadow-sm">
                              {scholarship}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* ประวัติการรับทุนจากเทศบาลเมืองตาคลี */}
                    {data.takhliScholarshipHistory && data.takhliScholarshipHistory.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">ประวัติการรับทุนจากเทศบาลเมืองตาคลี:</h4>
                        <div className="flex flex-wrap gap-2">
                          {data.takhliScholarshipHistory.map((history, index) => (
                            <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200 shadow-sm">
                              {history}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ภาพ */}
              {data.imageUrl && data.imageUrl.length > 0 && (
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg p-4 border border-pink-200 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaImage className="text-pink-500" />
                    ภาพประกอบ 
                    <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded-full text-sm font-medium">
                      {data.imageUrl.length} รูป
                    </span>
                  </h3>
                                      <div className="grid grid-cols-2 gap-3">
                                                                  {data.imageUrl && data.imageUrl.length > 0 ? (
                        (() => {
                          console.log('Rendering images:', data.imageUrl);
                          return data.imageUrl.map((image, index) => (
                            <div 
                              key={index} 
                              className="relative aspect-square rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl bg-slate-100 border-2 border-slate-200 hover:border-pink-300"
                              onClick={() => setSelectedImage({ src: image, index: index + 1 })}
                              title={`ภาพที่ ${index + 1}: ${image}`}
                              style={{ position: 'relative', zIndex: 1 }}
                            >
                              {/* Loading state */}
                              {imageLoading[`image-${index}`] !== false && !imageErrors[`image-${index}`] && (
                                <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center" style={{ zIndex: 2 }}>
                                  <div className="text-center">
                                    <div className="animate-pulse bg-slate-300 rounded-lg w-12 h-12 mx-auto mb-2"></div>
                                    <div className="animate-pulse bg-slate-300 rounded h-2 w-16 mx-auto"></div>
                                    <p className="text-slate-600 text-xs mt-2">กำลังโหลด...</p>
                                  </div>
                                </div>
                              )}
                              
                              <Image
                                src={image}
                                alt={`ภาพที่ ${index + 1}`}
                                fill
                                className="object-cover"
                                style={{ 
                                  display: imageErrors[`image-${index}`] ? 'none' : 'block',
                                  zIndex: 1
                                }}
                                onLoad={() => {
                                  console.log('Image loaded successfully:', image);
                                  setImageLoading(prev => ({ ...prev, [`image-${index}`]: false }));
                                }}
                                onError={() => {
                                  console.error('Image failed to load:', image);
                                  setImageLoading(prev => ({ ...prev, [`image-${index}`]: false }));
                                  setImageErrors(prev => ({ ...prev, [`image-${index}`]: true }));
                                }}
                              />
                              
                              {imageErrors[`image-${index}`] && (
                                <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center border-2 border-red-200" style={{ zIndex: 3 }}>
                                  <div className="text-center">
                                    <FaImage className="text-red-400 text-3xl mx-auto mb-2" />
                                    <p className="text-red-600 text-sm font-medium">ไม่สามารถโหลดภาพได้</p>
                                    <p className="text-red-500 text-xs mt-1 mb-2 break-all">{image}</p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        retryImage(index);
                                      }}
                                      className="mt-2 px-3 py-1 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 transition-colors duration-200"
                                    >
                                      ลองใหม่
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Success state - show image number */}
                              {!imageLoading[`image-${index}`] && !imageErrors[`image-${index}`] && (
                                <div className="absolute top-2 right-2 bg-green-500 bg-opacity-90 text-white text-xs px-2 py-1 rounded-full font-medium">
                                  ✓ ภาพที่ {index + 1}
                                </div>
                              )}
                              
                              {/* Debug info - show in development */}
                              {process.env.NODE_ENV === 'development' && (
                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                  {imageLoading[`image-${index}`] ? 'Loading' : imageErrors[`image-${index}`] ? 'Error' : 'Loaded'}
                                </div>
                              )}
                            </div>
                          ))
                        })()
                      ) : (
                         <div className="col-span-2 text-center py-8">
                           <FaImage className="text-gray-400 text-4xl mx-auto mb-2" />
                           <p className="text-gray-500">ไม่มีภาพ</p>
                         </div>
                       )}
                    </div>
                </div>
              )}
            </div>
          </div>

          {/* หมายเหตุ */}
          {data.note && (
            <div className="mt-6 bg-amber-50 rounded-lg p-4 border border-amber-200">
              <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                หมายเหตุ
              </h3>
              <p className="text-amber-900 whitespace-pre-wrap leading-relaxed">{data.note}</p>
            </div>
          )}

          {/* ข้อมูลระบบ */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaCalendarAlt className="text-purple-500" />
              ข้อมูลระบบ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FaIdCard className="text-blue-500" />
                    <span className="font-medium text-gray-700">เลขที่ผู้สมัคร</span>
                  </div>
                  {data?.applicantId && (
                    <button
                      onClick={() => copyToClipboard(data.applicantId, 'applicantId')}
                      className="text-gray-400 hover:text-blue-500 transition-colors duration-200"
                      title="คัดลอกเลขที่ผู้สมัคร"
                    >
                      <FaCopy className="text-sm" />
                    </button>
                  )}
                </div>
                <p className="font-bold text-blue-600 text-lg">{data?.applicantId || 'ไม่ระบุ'}</p>
                {copiedField === 'applicantId' && (
                  <p className="text-green-600 text-xs mt-1">✓ คัดลอกแล้ว</p>
                )}
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <FaCalendarAlt className="text-green-500" />
                  <span className="font-medium text-gray-700">วันที่สร้าง</span>
                </div>
                <p className="text-gray-800">
                  {data?.createdAt ? 
                    new Date(data.createdAt).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 
                    'ไม่ระบุ'
                  }
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <FaCalendarAlt className="text-orange-500" />
                  <span className="font-medium text-gray-700">วันที่อัปเดต</span>
                </div>
                <p className="text-gray-800">
                  {data?.updatedAt ? 
                    new Date(data.updatedAt).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 
                    'ไม่ระบุ'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 transition-colors duration-200 bg-black/50 backdrop-blur-sm rounded-full p-3 hover:bg-black/70"
            >
              <FaTimes className="text-xl" />
            </button>
            
            {/* Image counter */}
            <div className="absolute top-4 left-4 z-10 text-white bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 text-sm">
              ภาพที่ {selectedImage.index}
            </div>
            
            {/* Image */}
            <div className="relative w-full h-full flex items-center justify-center bg-gray-900">
              <Image
                src={selectedImage.src}
                alt={`ภาพที่ ${selectedImage.index}`}
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"
                onLoad={() => {
                  console.log('Image viewer image loaded successfully');
                }}
                onError={() => {
                  console.error('Image viewer image failed to load');
                }}
              />
            </div>
            
            {/* Navigation buttons */}
            {data.imageUrl && data.imageUrl.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const currentIndex = selectedImage.index - 1;
                    const prevIndex = currentIndex === 0 ? data.imageUrl.length : currentIndex;
                    setSelectedImage({ 
                      src: data.imageUrl[prevIndex - 1], 
                      index: prevIndex 
                    });
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors duration-200 bg-black/50 backdrop-blur-sm rounded-full p-3 hover:bg-black/70"
                >
                  ‹
                </button>
                <button
                  onClick={() => {
                    const currentIndex = selectedImage.index - 1;
                    const nextIndex = currentIndex === data.imageUrl.length - 1 ? 1 : currentIndex + 2;
                    setSelectedImage({ 
                      src: data.imageUrl[nextIndex - 1], 
                      index: nextIndex 
                    });
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 text-white hover:text-gray-300 transition-colors duration-200 bg-black/50 backdrop-blur-sm rounded-full p-3 hover:bg-black/70"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 