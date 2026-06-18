// pages/admin/education-map.js
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import EducationDetailModal from '@/components/education/EducationDetailModal';

// EditForm Component
function EditForm({ data, onClose, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    _id: data._id,
    prefix: data.prefix || '',
    name: data.name || '',
    educationLevel: data.educationLevel || '',
    phone: data.phone || '',
    address: data.address || '',
    actualAddress: data.actualAddress || '',
    note: data.note || '',
    annualIncome: data.annualIncome || '',
    incomeSource: data.incomeSource || [],
    householdMembers: data.householdMembers || 1,
    housingStatus: data.housingStatus || '',
    familyStatus: data.familyStatus ? (Array.isArray(data.familyStatus) ? data.familyStatus : [data.familyStatus]) : [],
    receivedScholarship: data.receivedScholarship || [],
    takhliScholarshipHistory: data.takhliScholarshipHistory ? (Array.isArray(data.takhliScholarshipHistory) ? data.takhliScholarshipHistory : [data.takhliScholarshipHistory]) : [],
    schoolName: data.schoolName || '',
    gradeLevel: data.gradeLevel || '',
    gpa: data.gpa || ''
  });

  // อัปเดต formData เมื่อ data prop เปลี่ยน
  useEffect(() => {
    console.log('EditForm received data:', data);
    console.log('Family status in data:', data.familyStatus);
    console.log('Takhli scholarship history in data:', data.takhliScholarshipHistory);
    console.log('School name in data:', data.schoolName);
    console.log('Grade level in data:', data.gradeLevel);
    console.log('GPA in data:', data.gpa);
    console.log('Actual address in data:', data.actualAddress);
    const newFormData = {
      _id: data._id,
      prefix: data.prefix || '',
      name: data.name || '',
      educationLevel: data.educationLevel || '',
      phone: data.phone || '',
      address: data.address || '',
      actualAddress: data.actualAddress || '',
      note: data.note || '',
      annualIncome: data.annualIncome || '',
      incomeSource: data.incomeSource || [],
      householdMembers: data.householdMembers || 1,
      housingStatus: data.housingStatus || '',
      familyStatus: data.familyStatus ? (Array.isArray(data.familyStatus) ? data.familyStatus : [data.familyStatus]) : [],
      receivedScholarship: data.receivedScholarship || [],
      takhliScholarshipHistory: data.takhliScholarshipHistory ? (Array.isArray(data.takhliScholarshipHistory) ? data.takhliScholarshipHistory : [data.takhliScholarshipHistory]) : [],
      schoolName: data.schoolName || '',
      gradeLevel: data.gradeLevel || '',
      gpa: data.gpa || ''
    };
    console.log('Setting form data to:', newFormData);
    console.log('Family status in newFormData:', newFormData.familyStatus);
    console.log('Takhli scholarship history in newFormData:', newFormData.takhliScholarshipHistory);
    console.log('School name in newFormData:', newFormData.schoolName);
    console.log('Grade level in newFormData:', newFormData.gradeLevel);
    console.log('GPA in newFormData:', newFormData.gpa);
    console.log('Actual address in newFormData:', newFormData.actualAddress);
    setFormData(newFormData);
  }, [data]);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form data being submitted:', formData);
    console.log('Family status in form data:', formData.familyStatus);
    console.log('Takhli scholarship history in form data:', formData.takhliScholarshipHistory);
    console.log('School name in form data:', formData.schoolName);
    console.log('Grade level in form data:', formData.gradeLevel);
    console.log('GPA in form data:', formData.gpa);
    console.log('Actual address in form data:', formData.actualAddress);
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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

  const { monthly: monthlyIncome, daily: dailyIncome, perPerson: perPersonIncome, perPersonMonthly: perPersonMonthlyIncome, perPersonDaily: perPersonDailyIncome } = calculateIncome(formData.annualIncome, formData.householdMembers);

  // จัดการแหล่งที่มาของรายได้
  const handleIncomeSourceChange = (source) => {
    setFormData(prev => ({
      ...prev,
      incomeSource: prev.incomeSource.includes(source)
        ? prev.incomeSource.filter(s => s !== source)
        : [...prev.incomeSource, source]
    }));
  };

  // จัดการสถานภาพครอบครัว
  const handleFamilyStatusChange = (status) => {
    setFormData(prev => ({
      ...prev,
      familyStatus: prev.familyStatus.includes(status)
        ? prev.familyStatus.filter(item => item !== status)
        : [...prev.familyStatus, status]
    }));
  };

  // จัดการประวัติการรับทุนจากเทศบาลเมืองตาคลี
  const handleTakhliScholarshipHistoryChange = (history) => {
    setFormData(prev => ({
      ...prev,
      takhliScholarshipHistory: prev.takhliScholarshipHistory.includes(history)
        ? prev.takhliScholarshipHistory.filter(item => item !== history)
        : [...prev.takhliScholarshipHistory, history]
    }));
  };

  const handleCancel = () => {
    // Check if form has been modified
    const hasChanges = 
      formData.prefix !== (data.prefix || '') ||
      formData.name !== (data.name || '') ||
      formData.educationLevel !== (data.educationLevel || '') ||
      formData.phone !== (data.phone || '') ||
      formData.address !== (data.address || '') ||
      formData.note !== (data.note || '') ||
      formData.annualIncome !== (data.annualIncome || '') ||
      formData.householdMembers !== (data.householdMembers || 1) ||
      formData.housingStatus !== (data.housingStatus || '') ||
      JSON.stringify(formData.incomeSource) !== JSON.stringify(data.incomeSource || []) ||
      JSON.stringify(formData.familyStatus) !== JSON.stringify(data.familyStatus ? (Array.isArray(data.familyStatus) ? data.familyStatus : [data.familyStatus]) : []) ||
      JSON.stringify(formData.receivedScholarship) !== JSON.stringify(data.receivedScholarship || []) ||
      JSON.stringify(formData.takhliScholarshipHistory) !== JSON.stringify(data.takhliScholarshipHistory ? (Array.isArray(data.takhliScholarshipHistory) ? data.takhliScholarshipHistory : [data.takhliScholarshipHistory]) : []) ||
      formData.schoolName !== (data.schoolName || '') ||
      formData.gradeLevel !== (data.gradeLevel || '') ||
      formData.gpa !== (data.gpa || '');

    if (hasChanges) {
      Swal.fire({
        title: 'ยืนยันการยกเลิก',
        text: 'ข้อมูลที่แก้ไขจะไม่ถูกบันทึก ต้องการยกเลิกหรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280',
        confirmButtonText: 'ยกเลิก',
        cancelButtonText: 'กลับไปแก้ไข'
      }).then((result) => {
        if (result.isConfirmed) {
          onClose();
        }
      });
    } else {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ข้อมูลส่วนตัว */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
          ข้อมูลส่วนตัว
        </h3>
      {/* Prefix and Name */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            คำนำหน้า
          </label>
          <select
            value={formData.prefix}
            onChange={(e) => handleChange('prefix', e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
          >
            <option value="">เลือกคำนำหน้า</option>
            <option value="ด.ช.">ด.ช.</option>
            <option value="ด.ญ.">ด.ญ.</option>
            <option value="นาย">นาย</option>
            <option value="นางสาว">นางสาว</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ชื่อ-นามสกุล *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
            placeholder="ชื่อ-นามสกุล"
          />
        </div>
      </div>

      {/* Education Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ระดับการศึกษา
        </label>
        <select
          value={formData.educationLevel}
          onChange={(e) => handleChange('educationLevel', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      {/* School Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ชื่อสถานศึกษา
          </label>
          <input
            type="text"
            value={formData.schoolName}
            onChange={(e) => handleChange('schoolName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="ชื่อสถานศึกษา"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ระดับชั้น
          </label>
          <input
            type="text"
            value={formData.gradeLevel}
            onChange={(e) => handleChange('gradeLevel', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="เช่น ป.6, ม.3, ม.6"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            เกรดเฉลี่ยปีที่ผ่านมา
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="4"
            value={formData.gpa}
            onChange={(e) => handleChange('gpa', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="เช่น 3.50"
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เบอร์โทรศัพท์
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="เบอร์โทรศัพท์"
          maxLength={10}
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ที่อยู่
        </label>
        <textarea
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="ที่อยู่"
        />
      </div>

      {/* Actual Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ที่อยู่อาศัยจริง
        </label>
        <textarea
          value={formData.actualAddress}
          onChange={(e) => handleChange('actualAddress', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="ที่อยู่อาศัยจริง (ถ้าแตกต่างจากที่อยู่ข้างต้น)"
          style={{ borderColor: '#3B82F6', backgroundColor: '#F8FAFC' }}
        />
        <div className="text-xs text-gray-500 mt-1">
          💡 กรอกที่อยู่อาศัยจริงหากแตกต่างจากที่อยู่ข้างต้น
        </div>
      </div>

      {/* Household Members and Housing Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            จำนวนสมาชิกในบ้าน *
          </label>
          <input
            type="number"
            value={formData.householdMembers}
            onChange={(e) => {
              const value = e.target.value;
              const parsedValue = value === '' ? 1 : parseInt(value);
              handleChange('householdMembers', parsedValue);
            }}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="จำนวนสมาชิก"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            สถานภาพที่อยู่ผู้ปกครอง
          </label>
          <select
            value={formData.housingStatus}
            onChange={(e) => handleChange('housingStatus', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">เลือกสถานภาพที่อยู่ผู้ปกครอง</option>
            <option value="ผู้อาศัย">ผู้อาศัย</option>
            <option value="เจ้าของ">เจ้าของ</option>
            <option value="บ้านเช่า">บ้านเช่า</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </div>
      </div>

      {/* Family Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          สถานภาพครอบครัว
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.familyStatus.includes('บิดา-มารดาแยกกันอยู่')}
              onChange={() => handleFamilyStatusChange('บิดา-มารดาแยกกันอยู่')}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">บิดา-มารดาแยกกันอยู่</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.familyStatus.includes('แยกกันอยู่ชั่วคราว')}
              onChange={() => handleFamilyStatusChange('แยกกันอยู่ชั่วคราว')}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">แยกกันอยู่ชั่วคราว</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.familyStatus.includes('หย่าร้าง')}
              onChange={() => handleFamilyStatusChange('หย่าร้าง')}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">หย่าร้าง</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.familyStatus.includes('บิดาส่งเสีย')}
              onChange={() => handleFamilyStatusChange('บิดาส่งเสีย')}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">บิดาส่งเสีย</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.familyStatus.includes('มารดาส่งเสีย')}
              onChange={() => handleFamilyStatusChange('มารดาส่งเสีย')}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">มารดาส่งเสีย</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.familyStatus.includes('บิดา/มารดาไม่ได้ส่งเสีย')}
              onChange={() => handleFamilyStatusChange('บิดา/มารดาไม่ได้ส่งเสีย')}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">บิดา/มารดาไม่ได้ส่งเสีย</span>
          </label>
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          หมายเหตุ
        </label>
        <textarea
          value={formData.note}
          onChange={(e) => handleChange('note', e.target.value)}
          rows={3}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
          placeholder="หมายเหตุ (ถ้ามี)"
        />
      </div>
      </div>

      {/* ข้อมูลรายได้ */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
          ข้อมูลรายได้
        </h3>

        {/* Annual Income */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            รายได้ต่อปี (บาท)
          </label>
          <input
            type="number"
            value={formData.annualIncome}
            onChange={(e) => handleChange('annualIncome', e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent bg-white"
            placeholder="กรอกรายได้ต่อปี"
          />
          
          {/* Income Summary */}
          {formData.annualIncome && (
            <div className="mt-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {parseInt(formData.annualIncome).toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-600">บาท/ปี (รวม)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {monthlyIncome.toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-600">บาท/เดือน (รวม)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {dailyIncome.toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-600">บาท/วัน (รวม)</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {perPersonIncome.toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-600">บาท/คน/ปี</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {perPersonMonthlyIncome.toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-600">บาท/คน/เดือน</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {perPersonDailyIncome.toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-600">บาท/คน/วัน</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Income Sources */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            แหล่งที่มาของรายได้
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'ค้าขาย',
              'ค่าจ้างรายวัน', 
              'เงินอุดหนุนบุตร',
              'เบี้ยผู้สูงอายุ',
              'เงินเดือน',
              'ไม่มีรายได้',
            ].map((source) => (
              <label key={source} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.incomeSource.includes(source)}
                  onChange={() => handleIncomeSourceChange(source)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">{source}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ข้อมูลทุนการศึกษา */}
      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
          ข้อมูลทุนการศึกษา
        </h3>

        <div className="space-y-6">
          {/* ทุนการศึกษาที่ได้รับ */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              ทุนการศึกษาที่ได้รับ
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'ทุนเรียนดี',
                'ทุนยากจน',
                'ทุนกองทุนการศึกษา',
                'ทุนจากองค์กรภายนอก',
                'ไม่ได้รับทุน'
              ].map((scholarship) => (
                <label key={scholarship} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.receivedScholarship.includes(scholarship)}
                    onChange={() => {
                      setFormData(prev => ({
                        ...prev,
                        receivedScholarship: prev.receivedScholarship.includes(scholarship)
                          ? prev.receivedScholarship.filter(s => s !== scholarship)
                          : [...prev.receivedScholarship, scholarship]
                      }));
                    }}
                    className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-700">{scholarship}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ประวัติการรับทุนจากเทศบาลเมืองตาคลี */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              ประวัติการรับทุนจากเทศบาลเมืองตาคลี
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'เคยได้รับทุนการศึกษา ปีงบประมาณ 2565',
                'เคยได้รับทุนการศึกษา ปีงบประมาณ 2566',
                'เคยได้รับทุนการศึกษา ปีงบประมาณ 2567',
                'ไม่เคยได้รับทุนการศึกษา'
              ].map((history) => (
                <label key={history} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.takhliScholarshipHistory.includes(history)}
                    onChange={() => handleTakhliScholarshipHistoryChange(history)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{history}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="px-6 py-2.5 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isSaving ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              กำลังบันทึก...
            </div>
          ) : (
            'บันทึก'
          )}
        </button>
      </div>
    </form>
  );
}

// โหลด MapEducationPoints แบบ dynamic (เพราะใช้ Leaflet)
const MapEducationPoints = dynamic(() => import('../../components/education/MapEducationPoints'), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="animate-pulse bg-gray-200 h-96 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-2">🗺️</div>
          <p className="text-gray-500">กำลังโหลดแผนที่...</p>
        </div>
      </div>
    </div>
  )
});

export default function EducationMapPage() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editModal, setEditModal] = useState({ isOpen: false, data: null });
  const [detailModal, setDetailModal] = useState({ isOpen: false, data: null });
  const [tableFilter, setTableFilter] = useState('all');
  const [incomeFilter, setIncomeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/education/all');
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const data = await response.json();
      console.log('Fetched data:', data);
      console.log('Sample item with household data:', data.find(item => item.householdMembers || item.housingStatus));
      console.log('Sample item with family status:', data.find(item => item.familyStatus));
      console.log('Sample item with takhli scholarship history:', data.find(item => item.takhliScholarshipHistory));
      console.log('Sample item with school data:', data.find(item => item.schoolName || item.gradeLevel || item.gpa));
      console.log('Sample item with actual address:', data.find(item => item.actualAddress));
      setPoints(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (item) => {
    console.log('Opening edit modal with data:', item);
    console.log('Family status in item:', item.familyStatus);
    console.log('Takhli scholarship history in item:', item.takhliScholarshipHistory);
    console.log('School name in item:', item.schoolName);
    console.log('Grade level in item:', item.gradeLevel);
    console.log('GPA in item:', item.gpa);
    console.log('Actual address in item:', item.actualAddress);
    setEditModal({ isOpen: true, data: item });
  };

  const handleCloseEditModal = () => {
    setEditModal({ isOpen: false, data: null });
  };



  const fixDuplicates = async () => {
    try {
      const response = await fetch('/api/education/fix-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        Swal.fire({
          title: 'สำเร็จ!',
          text: `จัดการข้อมูลซ้ำสำเร็จ\nพบกลุ่มข้อมูลซ้ำ: ${result.results.duplicateGroups} กลุ่ม\nลบข้อมูลซ้ำ: ${result.results.deletedRecords} รายการ\nข้อมูลทั้งหมด: ${result.summary.totalRecords} รายการ`,
          icon: 'success',
        });
        // รีเฟรชข้อมูล
        fetchData();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: error.message,
        icon: 'error',
      });
    }
  };

  const fixPrefixes = async () => {
    try {
      const response = await fetch('/api/education/bulk-update-prefix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        Swal.fire({
          title: 'สำเร็จ!',
          text: `แก้ไขคำนำหน้าสำเร็จ\nดช. → ด.ช.: ${result.results['ดช. → ด.ช.'].modifiedCount} รายการ\nดญ. → ด.ญ.: ${result.results['ดญ. → ด.ญ.'].modifiedCount} รายการ`,
          icon: 'success',
        });
        // รีเฟรชข้อมูล
        fetchData();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: error.message,
        icon: 'error',
      });
    }
  };

  const resetApplicantId = async () => {
    try {
      // แสดง confirmation dialog
      const result = await Swal.fire({
        title: 'ยืนยันการรีเซ็ตเลขที่ผู้สมัคร',
        text: 'การดำเนินการนี้จะรีเซ็ตเลขที่ผู้สมัคร (applicantId) ทั้งหมดให้เป็นลำดับใหม่ตามวันที่สร้างข้อมูล ต้องการดำเนินการต่อหรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'รีเซ็ต',
        cancelButtonText: 'ยกเลิก'
      });

      if (result.isConfirmed) {
        // แสดง loading
        Swal.fire({
          title: 'กำลังรีเซ็ตเลขที่ผู้สมัคร...',
          text: 'กรุณารอสักครู่',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        const response = await fetch('/api/education/reset-applicant-id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();
        
        if (response.ok) {
          Swal.fire({
            title: 'รีเซ็ตสำเร็จ!',
            text: `รีเซ็ตเลขที่ผู้สมัครสำเร็จ\nอัปเดต: ${result.updatedCount} รายการ`,
            icon: 'success',
          });
          // รีเฟรชข้อมูล
          fetchData();
        } else {
          throw new Error(result.message);
        }
      }
    } catch (error) {
      Swal.fire({
        title: 'เกิดข้อผิดพลาด',
        text: error.message,
        icon: 'error',
      });
    }
  };

  const handleSaveEdit = async (updatedData) => {
    try {
      setIsSaving(true);
      
      console.log('Sending update data:', updatedData);
      console.log('Family status in updatedData:', updatedData.familyStatus);
      console.log('Takhli scholarship history in updatedData:', updatedData.takhliScholarshipHistory);
      console.log('School name in updatedData:', updatedData.schoolName);
      console.log('Grade level in updatedData:', updatedData.gradeLevel);
      console.log('GPA in updatedData:', updatedData.gpa);
      console.log('Actual address in updatedData:', updatedData.actualAddress);
      
      const response = await fetch(`/api/education/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to update data');
      }

      const result = await response.json();
      console.log('Updated data:', result);

      // Update the specific item in the points array
      setPoints(prevPoints => {
        const updatedPoints = prevPoints.map(item => 
          item._id === updatedData._id 
            ? { ...item, ...updatedData }
            : item
        );
        console.log('Updated points array:', updatedPoints.find(item => item._id === updatedData._id));
        console.log('School data in updated points:', updatedPoints.find(item => item._id === updatedData._id)?.schoolName);
        console.log('Grade data in updated points:', updatedPoints.find(item => item._id === updatedData._id)?.gradeLevel);
        console.log('GPA data in updated points:', updatedPoints.find(item => item._id === updatedData._id)?.gpa);
        console.log('Actual address in updated points:', updatedPoints.find(item => item._id === updatedData._id)?.actualAddress);
        return updatedPoints;
      });

      // Refresh data to ensure consistency
      await fetchData();
      
      // Close modal
      handleCloseEditModal();
      
      // Show success message with SweetAlert
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'บันทึกข้อมูลเรียบร้อยแล้ว',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#3B82F6',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error updating data:', error);
      
      // Show error message with SweetAlert
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด!',
        text: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#EF4444'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ฟังก์ชันสำหรับการเรียงลำดับ
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // คำนวณรายได้เฉลี่ยรายวันต่อคน
  const calculateDailyIncomePerPerson = (annualIncome, householdMembers) => {
    if (!annualIncome || !householdMembers || annualIncome <= 0 || householdMembers <= 0) return 0;
    return Math.round((annualIncome / householdMembers) / 12 / 30);
  };

  // ฟังก์ชันสำหรับการกรองและเรียงลำดับข้อมูล
  const getFilteredAndSortedData = () => {
    let filteredData = points;
    
    // กรองตามคำค้นหา (ชื่อ)
    if (searchTerm.trim()) {
      filteredData = filteredData.filter(item => {
        const fullName = (item.prefix || '') + (item.name || '');
        return fullName.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }
    
    // กรองตามระดับการศึกษา
    if (tableFilter !== 'all') {
      filteredData = filteredData.filter(item => item.educationLevel === tableFilter);
    }
    
    // กรองตามรายได้เฉลี่ยรายวัน
    if (incomeFilter !== 'all') {
      filteredData = filteredData.filter(item => {
        const dailyIncome = calculateDailyIncomePerPerson(item.annualIncome, item.householdMembers);
        
        if (incomeFilter === 'low') {
          return dailyIncome < 100;
        } else if (incomeFilter === 'medium') {
          return dailyIncome >= 100 && dailyIncome <= 150;
        } else if (incomeFilter === 'high') {
          return dailyIncome > 200;
        }
        return true;
      });
    }
    
    // เรียงลำดับ
    filteredData.sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';
      
      // สำหรับชื่อ ให้รวม prefix ด้วย
      if (sortField === 'name') {
        aValue = (a.prefix || '') + (a.name || '');
        bValue = (b.prefix || '') + (b.name || '');
      }
      
      // สำหรับวันที่ ให้เรียงจากใหม่ไปเก่า
      if (sortField === 'createdAt') {
        const aDate = new Date(a.createdAt || 0);
        const bDate = new Date(b.createdAt || 0);
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue, 'th');
      } else {
        return bValue.localeCompare(aValue, 'th');
      }
    });
    
    return filteredData;
  };

  // ฟังก์ชันสำหรับสีของระดับการศึกษา
  const getLevelColor = (level) => {
    const colors = {
      'อนุบาล': '#FF6B9D',
      'ประถม': '#FF6B35',
      'มัธยมต้น': '#6BCF7F',
      'มัธยมปลาย': '#4D96FF',
      'ปวช.': '#9B59B6',
      'ปวส.': '#E67E22',
      'ปริญญาตรี': '#E74C3C',
      'ไม่ระบุ': '#95A5A6'
    };
    return colors[level] || colors['ไม่ระบุ'];
  };

  const exportToCSV = () => {
    const headers = ['ชื่อ', 'ระดับการศึกษา', 'ที่อยู่', 'หมายเหตุ'];
    const csvData = points.map(item => [
      `${item.prefix || ''}${item.name || ''}`,
      item.educationLevel || 'ไม่ระบุ',
      item.address || '',
      item.note || ''
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `education-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                แผนที่ภาพรวมข้อมูลสำรวจทางการศึกษา
              </h1>
              <p className="text-gray-600 mt-1">
                จัดการและวิเคราะห์ข้อมูลการศึกษาของผู้ขอรับสิทธิ
              </p>
            </div>
            <div className="flex items-center gap-2 mt-4 md:mt-0">
              {/* ปุ่มรีเฟรช - แสดงเสมอ */}
              <button
                onClick={fetchData}
                className="btn btn-sm bg-blue-500 text-white hover:bg-blue-600 border-0"
              >
                <span>🔄</span>
                <span>รีเฟรช</span>
              </button>
              
              {/* ปุ่มแสดง/ซ่อนปุ่มดำเนินการขั้นสูง */}
              <button
                onClick={() => setShowAdvancedActions(!showAdvancedActions)}
                className="btn btn-sm bg-gray-500 text-white hover:bg-gray-600 border-0"
              >
                <span>{showAdvancedActions ? '🔽' : '🔼'}</span>
                <span>{showAdvancedActions ? 'ซ่อน' : 'แสดง'} ปุ่มดำเนินการ</span>
              </button>
              
              {/* ปุ่มดำเนินการขั้นสูง - แสดงเมื่อกดปุ่มด้านบน */}
              {showAdvancedActions && (
                <>
                  <button
                    onClick={resetApplicantId}
                    className="btn btn-sm bg-purple-500 text-white hover:bg-purple-600 border-0"
                  >
                    <span>🔄</span>
                    <span>รีเซ็ตเลขที่ผู้สมัคร</span>
                  </button>
                  <button
                    onClick={fixDuplicates}
                    className="btn btn-sm bg-red-500 text-white hover:bg-red-600 border-0"
                  >
                    <span>🗑️</span>
                    <span>ลบข้อมูลซ้ำ</span>
                  </button>
                  <button
                    onClick={fixPrefixes}
                    className="btn btn-sm bg-orange-500 text-white hover:bg-orange-600 border-0"
                  >
                    <span>🔧</span>
                    <span>แก้ไขคำนำหน้า</span>
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="btn btn-sm bg-green-500 text-white hover:bg-green-600 border-0"
                  >
                    <span>📥</span>
                    <span>ส่งออก CSV</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === 'dashboard' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>📊</span>
              <span>แดชบอร์ด</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === 'map' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>🗺️</span>
              <span>แผนที่</span>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === 'table' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>📋</span>
              <span>ตารางข้อมูล</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Summary - Always visible at top */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">ข้อมูลสรุป</h2>
          
          {/* ข้อมูลพื้นฐาน */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ข้อมูลพื้นฐาน</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-100 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 text-sm">รายการทั้งหมด</h4>
                <p className="text-2xl font-bold text-blue-600">{points.length}</p>
              </div>
              <div className="bg-green-100 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 text-sm">มีพิกัด</h4>
                <p className="text-2xl font-bold text-green-600">
                  {points.filter(item => item.location && item.location.lat && item.location.lng).length}
                </p>
              </div>
              <div className="bg-purple-100 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-800 text-sm">มีรูปภาพ</h4>
                <p className="text-2xl font-bold text-purple-600">
                  {points.filter(item => item.imageUrl && item.imageUrl.length > 0).length}
                </p>
              </div>
              <div className="bg-orange-100 p-4 rounded-lg">
                <h4 className="font-semibold text-orange-800 text-sm">มีเบอร์โทร</h4>
                <p className="text-2xl font-bold text-orange-600">
                  {points.filter(item => item.phone).length}
                </p>
              </div>
            </div>
          </div>

          {/* ข้อมูลครอบครัว */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ข้อมูลครอบครัว</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-red-100 p-4 rounded-lg">
                <h4 className="font-semibold text-red-800 text-sm">สมาชิกเฉลี่ย</h4>
                <p className="text-2xl font-bold text-red-600">
                  {points.length > 0 ? 
                    Math.round(points.reduce((sum, item) => sum + (item.householdMembers || 1), 0) / points.length) : 
                    0
                  } คน
                </p>
              </div>
              <div className="bg-teal-100 p-4 rounded-lg">
                <h4 className="font-semibold text-teal-800 text-sm">เจ้าของบ้าน</h4>
                <p className="text-2xl font-bold text-teal-600">
                  {points.filter(item => item.housingStatus === 'เจ้าของ').length} คน
                </p>
              </div>
              <div className="bg-cyan-100 p-4 rounded-lg">
                <h4 className="font-semibold text-cyan-800 text-sm">ผู้อาศัย</h4>
                <p className="text-2xl font-bold text-cyan-600">
                  {points.filter(item => item.housingStatus === 'ผู้อาศัย').length} คน
                </p>
              </div>
              <div className="bg-lime-100 p-4 rounded-lg">
                <h4 className="font-semibold text-lime-800 text-sm">บ้านเช่า</h4>
                <p className="text-2xl font-bold text-lime-600">
                  {points.filter(item => item.housingStatus === 'บ้านเช่า').length} คน
                </p>
              </div>
            </div>
          </div>

          {/* ข้อมูลรายได้ */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ข้อมูลรายได้เฉลี่ยต่อคน</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-100 p-4 rounded-lg">
                <h4 className="font-semibold text-indigo-800 text-sm">รายได้เฉลี่ย/คน/ปี</h4>
                <p className="text-2xl font-bold text-indigo-600">
                  {(() => {
                    const validData = points.filter(item => item.annualIncome && item.householdMembers);
                    if (validData.length === 0) return '0';
                    const totalPerPerson = validData.reduce((sum, item) => 
                      sum + (item.annualIncome / (item.householdMembers || 1)), 0
                    );
                    return Math.round(totalPerPerson / validData.length).toLocaleString();
                  })()} บาท
                </p>
              </div>
              <div className="bg-pink-100 p-4 rounded-lg">
                <h4 className="font-semibold text-pink-800 text-sm">รายได้เฉลี่ย/คน/เดือน</h4>
                <p className="text-2xl font-bold text-pink-600">
                  {(() => {
                    const validData = points.filter(item => item.annualIncome && item.householdMembers);
                    if (validData.length === 0) return '0';
                    const totalPerPerson = validData.reduce((sum, item) => 
                      sum + (item.annualIncome / (item.householdMembers || 1)), 0
                    );
                    return Math.round((totalPerPerson / validData.length) / 12).toLocaleString();
                  })()} บาท
                </p>
              </div>
              <div className="bg-yellow-100 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-800 text-sm">รายได้เฉลี่ย/คน/วัน</h4>
                <p className="text-2xl font-bold text-yellow-600">
                  {(() => {
                    const validData = points.filter(item => item.annualIncome && item.householdMembers);
                    if (validData.length === 0) return '0';
                    const totalPerPerson = validData.reduce((sum, item) => 
                      sum + (item.annualIncome / (item.householdMembers || 1)), 0
                    );
                    return Math.round((totalPerPerson / validData.length) / 12 / 30).toLocaleString();
                  })()} บาท
                </p>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'map' && (
          <div className="space-y-6">
            <MapEducationPoints data={points} />
          </div>
        )}

        {activeTab === 'table' && (
          <div className="space-y-6">
            {/* Table with Filter and Sort */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <h2 className="text-xl font-semibold text-gray-800">ข้อมูลผู้ขอรับสิทธิการศึกษา</h2>
                  
                  {/* Search and Filter */}
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    {/* Search */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">ค้นหาจากชื่อ:</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="พิมพ์ชื่อเพื่อค้นหา..."
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Education Level Filter */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">ระดับการศึกษา:</label>
                      <select
                        value={tableFilter}
                        onChange={(e) => setTableFilter(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">ทั้งหมด ({points.length})</option>
                        {Array.from(new Set(points.map(item => item.educationLevel).filter(Boolean))).map(level => (
                          <option key={level} value={level}>
                            {level} ({points.filter(item => item.educationLevel === level).length})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Income Filter */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">รายได้เฉลี่ยรายวัน:</label>
                      <select
                        value={incomeFilter}
                        onChange={(e) => setIncomeFilter(e.target.value)}
                        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">ทุกระดับรายได้</option>
                        <option value="low">ต่ำกว่า 100 บาท/วัน</option>
                        <option value="medium">100-150 บาท/วัน</option>
                        <option value="high">เกิน 200 บาท/วัน</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition w-16"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center gap-1">
                          ลำดับ
                          {sortField === 'createdAt' && (
                            <span className="text-blue-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          ชื่อ
                          {sortField === 'name' && (
                            <span className="text-blue-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => handleSort('educationLevel')}
                      >
                        <div className="flex items-center gap-1">
                          ระดับการศึกษา
                          {sortField === 'educationLevel' && (
                            <span className="text-blue-500">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สมาชิกในบ้าน</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายได้ต่อคน/ปี</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายได้ต่อคน/เดือน</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รายได้ต่อคน/วัน</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะที่อยู่อาศัย</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ที่อยู่</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredAndSortedData().map((item, index) => (
                      <tr 
                        key={item._id || index} 
                        className="hover:bg-gray-50 cursor-pointer transition"
                        onClick={() => {
                          console.log('Row clicked:', item);
                          setDetailModal({ isOpen: true, data: item });
                        }}
                      >
                        <td className="px-6 py-4 text-sm text-gray-500 text-center">
                          {sortField === 'createdAt' ? (
                            <div className="text-xs">
                              <div className="font-medium">{index + 1}</div>
                              <div className="text-gray-400">
                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString('th-TH') : '-'}
                              </div>
                            </div>
                          ) : (
                            index + 1
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {(() => {
                            const fullName = (item.prefix || '') + (item.name || '');
                            if (searchTerm && fullName.toLowerCase().includes(searchTerm.toLowerCase())) {
                              const parts = fullName.split(new RegExp(`(${searchTerm})`, 'gi'));
                              return (
                                <span>
                                  {parts.map((part, index) => 
                                    part.toLowerCase() === searchTerm.toLowerCase() ? (
                                      <mark key={index} className="bg-yellow-200 px-1 rounded">
                                        {part}
                                      </mark>
                                    ) : (
                                      part
                                    )
                                  )}
                                </span>
                              );
                            }
                            return fullName;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <span className="px-2 py-1 text-xs font-medium rounded-full"
                                style={{
                                  backgroundColor: getLevelColor(item.educationLevel) + '20',
                                  color: getLevelColor(item.educationLevel)
                                }}>
                            {item.educationLevel || 'ไม่ระบุ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center">
                          {item.householdMembers || 1} คน
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center">
                          {item.annualIncome && item.householdMembers ? 
                            (item.annualIncome / (item.householdMembers || 1)).toLocaleString() + ' บาท' : 
                            'ไม่มีข้อมูล'
                          }
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center">
                          {item.annualIncome && item.householdMembers ? 
                            Math.round((item.annualIncome / (item.householdMembers || 1)) / 12).toLocaleString() + ' บาท' : 
                            'ไม่มีข้อมูล'
                          }
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center">
                          {item.annualIncome && item.householdMembers ? 
                            Math.round((item.annualIncome / (item.householdMembers || 1)) / 12 / 30).toLocaleString() + ' บาท' : 
                            'ไม่มีข้อมูล'
                          }
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center">
                          {item.housingStatus ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              {item.housingStatus}
                            </span>
                          ) : (
                            'ไม่ระบุ'
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.address || 'ไม่มีข้อมูล'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(item);
                            }}
                            className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition"
                          >
                            แก้ไข
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Summary */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <div>
                    แสดง {getFilteredAndSortedData().length} รายการจากทั้งหมด {points.length} รายการ
                    {(searchTerm || tableFilter !== 'all' || incomeFilter !== 'all') && (
                      <span className="ml-2 text-blue-600">
                        {searchTerm && `(ค้นหา: "${searchTerm}")`}
                        {tableFilter !== 'all' && ` (ระดับ: ${tableFilter})`}
                        {incomeFilter !== 'all' && (
                          incomeFilter === 'low' ? ' (รายได้: ต่ำกว่า 100 บาท/วัน)' :
                          incomeFilter === 'medium' ? ' (รายได้: 100-150 บาท/วัน)' :
                          ' (รายได้: เกิน 200 บาท/วัน)'
                        )}
                      </span>
                    )}
                  </div>
                  {(searchTerm || tableFilter !== 'all' || incomeFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setTableFilter('all');
                        setIncomeFilter('all');
                      }}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Glass Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">แก้ไขข้อมูล</h2>
              <button
                onClick={handleCloseEditModal}
                className="text-slate-400 hover:text-slate-600 transition text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {editModal.data && (
                <EditForm 
                  data={editModal.data} 
                  onClose={handleCloseEditModal}
                  onSave={handleSaveEdit}
                  isSaving={isSaving}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <EducationDetailModal
        data={detailModal.data}
        isOpen={detailModal.isOpen}
        onClose={() => {
          console.log('Closing detail modal');
          setDetailModal({ isOpen: false, data: null });
        }}
      />
    </div>
  );
}