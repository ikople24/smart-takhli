import React, { useState } from 'react';
import { z } from 'zod';
import Swal from 'sweetalert2';
import ActivitySelector from './ActivitySelector';

const feedbackSchema = z.object({
  activityId: z.string().min(1, 'กรุณาเลือกกิจกรรม'),
  grade: z.string().min(1, 'กรุณาเลือกระดับการศึกษา'),
  comment: z.string().min(10, 'ความคิดเห็นต้องมีอย่างน้อย 10 ตัวอักษร').max(500, 'ความคิดเห็นต้องไม่เกิน 500 ตัวอักษร'),
  emotionLevel: z.number().min(1).max(5),
  category: z.string().min(1, 'กรุณาเลือกหมวดหมู่')
});

const grades = [
  'ประถมศึกษา', 'มัธยมศึกษาตอนต้น', 'มัธยมศึกษาตอนปลาย', 'อุดมศึกษา'
];

const categories = [
  'ทั่วไป', 'สุขภาพ', 'การศึกษา', 'สิ่งแวดล้อม', 'การคมนาคม',  'สวัสดิการสังคม','สันทนาการ'  ,'อื่นๆ'
];

const ratingOptions = [
  { value: 5, emoji: '😊', text: 'ประทับใจมาก' },
  { value: 4.5, emoji: '🙂', text: 'ประทับใจ' },
  { value: 3, emoji: '😐', text: 'ปานกลาง' },
  { value: 2.5, emoji: '😞', text: 'เฉยๆ' }
];

const StudentFeedbackModal = ({ isOpen, onClose, onSubmit }) => {
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [formData, setFormData] = useState({
    activityId: '',
    grade: '',
    comment: '',
    emotionLevel: 3,
    category: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      const validationResult = feedbackSchema.safeParse(formData);
      if (!validationResult.success) {
        const errorOrder = ['activityId', 'grade', 'comment', 'emotionLevel', 'category'];
        const sortedErrors = validationResult.error.errors.sort((a, b) => {
          const aIndex = errorOrder.indexOf(a.path[0]);
          const bIndex = errorOrder.indexOf(b.path[0]);
          return aIndex - bIndex;
        });
        const errorMessages = sortedErrors.map((err, index) => `${index + 1}. ${err.message}`).join('\n');
        await Swal.fire({
          icon: 'error',
          title: 'ข้อมูลไม่ครบถ้วน',
          text: errorMessages,
          confirmButtonText: 'ตกลง'
        });
        return;
      }

      setIsSubmitting(true);
      await onSubmit(formData);
      
      // Reset form and close modal
      setFormData({
        activityId: '',
        grade: '',
        comment: '',
        emotionLevel: 3,
        category: ''
      });
      setSelectedActivity(null);
      
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'เกิดข้อผิดพลาดในการส่งข้อมูล',
        confirmButtonText: 'ตกลง'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivityChange = (activity) => {
    setSelectedActivity(activity);
    setFormData(prev => ({
      ...prev,
      activityId: activity?._id || ''
    }));
  };

  const handleRatingSelect = (rating) => {
    setFormData(prev => ({
      ...prev,
      emotionLevel: rating
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 max-w-sm sm:max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">💭 แสดงความคิดเห็น</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg sm:text-xl"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <ActivitySelector
            selectedActivity={selectedActivity}
            onActivityChange={handleActivityChange}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ระดับการศึกษา *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {grades.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, grade }))}
                  className={`py-2 px-3 rounded-lg border-2 transition-all text-xs sm:text-sm ${
                    formData.grade === grade
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              แสดงความรู้สึก *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ratingOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRatingSelect(option.value)}
                  className={`py-3 px-2 rounded-lg border-2 transition-all ${
                    formData.emotionLevel === option.value
                      ? 'border-blue-500 bg-blue-50 scale-105'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xl mb-1">{option.emoji}</div>
                  <div className="text-xs sm:text-sm text-gray-600">{option.text}</div>
                </button>
              ))}
            </div>
            {formData.emotionLevel && (
              <p className="text-sm text-gray-600 mt-2">
                เลือก: {ratingOptions.find(opt => opt.value === formData.emotionLevel)?.text}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              หมวดหมู่ *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, category }))}
                  className={`py-2 px-3 rounded-lg border-2 transition-all text-xs sm:text-sm ${
                    formData.category === category
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ความคิดเห็น *
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="เขียนความคิดเห็นของคุณ (10-500 ตัวอักษร)"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.comment.length}/500 ตัวอักษร
            </p>
          </div>

          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
            >
              {isSubmitting ? 'กำลังส่ง...' : 'ส่งความคิดเห็น'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentFeedbackModal; 