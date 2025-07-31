import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import Image from 'next/image';

const BorrowReturnTable = ({ showOnlyUnevaluated = false }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuIcons, setMenuIcons] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [submittedFeedbacks, setSubmittedFeedbacks] = useState([]);
  const [feedbackData, setFeedbackData] = useState([]);
  
  useEffect(() => {
    const fetchSubmittedFeedbacks = async () => {
      try {
        const res = await axios.get('/api/smart-health/feedback-submitted');
        setSubmittedFeedbacks(res.data.map(fb => fb.ob_type));
        setFeedbackData(res.data);
      } catch (err) {
        console.error('Error fetching submitted feedbacks:', err);
      }
    };
    fetchSubmittedFeedbacks();
  }, []);

  const { register, handleSubmit, reset } = useForm();
  const onSubmitFeedback = async (formData) => {
    if (!formData.satisfaction) {
      await import('sweetalert2').then(Swal => {
        Swal.default.fire({
          icon: 'warning',
          title: 'กรุณาให้คะแนนความพึงพอใจ',
          text: 'กรุณาเลือกความพึงพอใจก่อนส่งแบบประเมิน',
        });
      });
      return;
    }

    // Ensure all required fields are present and not null/undefined
    const payload = {
      ob_type: formData.ob_type || '',
      relation: formData.relation || '',
      satisfaction: formData.satisfaction || '',
      suggestion: formData.suggestion || '-',
    };

    if (!payload.ob_type || !payload.relation || !payload.satisfaction || !payload.suggestion) {
      await import('sweetalert2').then(Swal => {
        Swal.default.fire({
          icon: 'error',
          title: 'ข้อมูลไม่ครบ',
          text: 'กรุณากรอกข้อมูลให้ครบถ้วน',
        });
      });
      return;
    }

    try {
      const res = await axios.post('/api/smart-health/borrow-return', payload);
      if (res.data.success) {
        await import('sweetalert2').then(Swal => {
          Swal.default.fire({
            icon: 'success',
            title: 'ส่งแบบประเมินสำเร็จ',
          });
        });
        reset();
        setSelectedItem(null);
        // Re-fetch feedbacks after successful submission
        const fetchSubmittedFeedbacks = async () => {
          try {
            const res = await axios.get('/api/smart-health/feedback-submitted');
            setSubmittedFeedbacks(res.data.map(fb => fb.ob_type));
            setFeedbackData(res.data);
          } catch (err) {
            console.error('Error fetching submitted feedbacks:', err);
          }
        };
        fetchSubmittedFeedbacks();
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      await import('sweetalert2').then(Swal => {
        Swal.default.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถส่งแบบประเมินได้',
        });
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/smart-health/borrow-return');
        setData(response.data);
      } catch (error) {
        console.error('Error fetching borrow-return data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchMenuIcons = async () => {
      try {
        const res = await axios.get('/api/smart-health/menu-ob-health');
        setMenuIcons(res.data);
      } catch (err) {
        console.error('Error fetching menu icons:', err);
      }
    };

    fetchMenuIcons();
  }, []);

  const getIconUrl = (index_id_tk) => {
    const code = index_id_tk?.substring(0, 8);
    const match = menuIcons.find(menu => menu.id_code_th === code);
    return match?.image_icon || '';
  };
  const getObjectName = (index_id_tk) => {
    const code = index_id_tk?.substring(0, 8);
    const match = menuIcons.find(menu => menu.id_code_th === code);
    return match?.shot_name || '';
  };

  if (loading) {
    return <div>กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex flex-wrap gap-2 mb-4 mt-4">
        <button
          className={`btn btn-sm ${filterType === '' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFilterType('')}
        >
          ทั้งหมด
        </button>
        {menuIcons.map((icon) => {
          const code = icon.id_code_th;
          const count = data.filter(item => item.index_id_tk?.substring(0, 8) === code).length;

          return (
            <button
              key={code}
              className={`btn btn-sm relative ${filterType === code ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterType(code)}
            >
              {icon.shot_name || code}
              {count > 0 && (
                <span className="badge bg-pink-500 text-white absolute -top-4 -right-4 text-xs rounded-full px-2">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <table className="table w-full">
        <thead>
          <tr>
            <th>ลำดับ</th>
            <th>ประเภท</th>
            <th>รหัสการยืม</th>
            <th>รหัสประชาชน</th>
            <th>รหัสอุปกรณ์</th>
            <th>วันที่ยืม</th>
            <th>วันที่คืน</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {data
            .filter((item) =>
              (filterType ? item.index_id_tk?.substring(0, 8) === filterType : true) &&
              (!showOnlyUnevaluated || !submittedFeedbacks.includes(item.id_use_object))
            )
            .map((item, index) => (
              <tr key={item._id}>
                <td>{index + 1}</td>
                <td>
                  {getIconUrl(item.index_id_tk) && (
                    <Image src={getIconUrl(item.index_id_tk)} alt="icon" width={24} height={24} unoptimized />
                  )}
                </td>
                <td>{item.index_id_tk}</td>
                <td>
                  {item.id_personal_use
                    ? `${item.id_personal_use.slice(0, 2)}xxxxxxxxx${item.id_personal_use.slice(-2)}`
                    : ''}
                </td>
                <td>{item.id_use_object}</td>
                <td>{item.date_lend}</td>
                <td>{item.date_return}</td>
                <td>
                  <div className="flex flex-col gap-1">
                    <button
                      className="btn btn-xs btn-info"
                      onClick={() => {
                        setSelectedItem(item);
                        setShowFeedbackForm(false);
                      }}
                    >
                      ดูข้อมูล
                    </button>
                    {!submittedFeedbacks.includes(item.id_use_object) && (
                      <button
                        className="btn btn-xs btn-success"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowFeedbackForm(true);
                        }}
                      >
                        ประเมิน
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {selectedItem && (
        <div className="modal modal-open">
          <div className="modal-box max-w-xl">
            <h3 className="font-bold text-lg">รายละเอียดการยืม</h3>
            <p className="py-2">รหัสการยืม: {selectedItem.index_id_tk}</p>
            <p className="py-1">เลขบัตร ปชช: {selectedItem.id_personal_use}</p>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="py-1">อุปกรณ์: {selectedItem.id_use_object}</p>
                <p className="py-1">วันที่ยืม: {selectedItem.date_lend}</p>
                <p className="py-1">วันที่คืน: {selectedItem.date_return}</p>
              </div>
              <div className="text-center">
                {getIconUrl(selectedItem.index_id_tk) && (
                  <Image src={getIconUrl(selectedItem.index_id_tk)} alt="icon" width={64} height={64} className="mx-auto mb-1" unoptimized />
                )}
                <div className="text-green-600 text-sm font-medium">{getObjectName(selectedItem.index_id_tk)}</div>
              </div>
            </div>
            {showFeedbackForm && (
              <form onSubmit={handleSubmit(onSubmitFeedback)} className="mt-4">
                <div className="mb-2">
                  <label className="label">ท่านใช้กายอุปกรณ์ประเภทใด</label>
                  <input className="input input-bordered w-full" value={selectedItem.id_use_object} readOnly {...register('ob_type')} />
                </div>
                <div className="mb-2">
                  <label className="label">ท่านมีส่วนเกี่ยวข้องอย่างไรกับการใช้อุปกรณ์</label>
                  <div className="flex flex-col gap-1">
                    <label className="cursor-pointer">
                      <input type="radio" value="เป็นผู้ใช้อุปกรณ์" {...register('relation')} className="radio mr-2" />
                      เป็นผู้ใช้อุปกรณ์
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" value="เป็นผู้ดูแล/ครอบครัว" {...register('relation')} className="radio mr-2" />
                      มีคนในครอบครัวใช้/เป็นผู้ดูแล
                    </label>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="label">ท่านมีความพึงพอใจในการใช้อุปกรณ์</label>
                  <div className="rating">
                    <input type="radio" value="1" {...register('satisfaction')} className="mask mask-star bg-orange-400" />
                    <input type="radio" value="2" {...register('satisfaction')} className="mask mask-star bg-orange-400" />
                    <input type="radio" value="3" {...register('satisfaction')} className="mask mask-star bg-orange-400" />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="label">ข้อเสนอแนะเพิ่มเติม</label>
                  <textarea className="textarea textarea-bordered w-full" placeholder="หากไม่มีให้ใส่ - " {...register('suggestion')}></textarea>
                </div>
                <div className="modal-action">
                  <button type="button" className="btn" onClick={() => setSelectedItem(null)}>ปิด</button>
                  <button type="submit" className="btn btn-primary">ส่ง</button>
                </div>
              </form>
            )}
            {!showFeedbackForm && (
              <>
                <div className="flex flex-col items-center justify-center mt-4">
                  <label className="label">ระดับความพึงพอใจ</label>
                  {(() => {
                    const matchedFeedback = feedbackData.find(fb => fb.ob_type === selectedItem.id_use_object);
                    return (
                      <div
                        className="radial-progress text-primary"
                        style={{
                          "--value": matchedFeedback?.satisfaction
                            ? (matchedFeedback.satisfaction / 3) * 100
                            : 0,
                          "--size": "6rem",
                          "--thickness": "10px"
                        }}
                      >
                        {matchedFeedback?.satisfaction
                          ? `${(matchedFeedback.satisfaction / 3) * 100}%`
                          : 'ยังไม่มีข้อมูล'}
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-action">
                  <button type="button" className="btn" onClick={() => setSelectedItem(null)}>ปิด</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowReturnTable;