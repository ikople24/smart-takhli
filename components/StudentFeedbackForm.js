import React, { useState, useEffect, useCallback } from 'react';
import StudentFeedbackModal from './StudentFeedbackModal';
import ActivitySelector from './ActivitySelector';
import Swal from 'sweetalert2';

const StudentFeedbackForm = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [recentFeedbacks, setRecentFeedbacks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  useEffect(() => {
    fetchFeedbackStats();
    fetchRecentFeedbacks();
  }, [fetchFeedbackStats, fetchRecentFeedbacks]);

  const fetchFeedbackStats = useCallback(async () => {
    try {
      const activityId = selectedActivity?._id;
      const url = activityId ? `/api/student-feedback?activityId=${activityId}` : '/api/student-feedback';
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setFeedbackStats(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [selectedActivity?._id]);

  const fetchRecentFeedbacks = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const activityId = selectedActivity?._id;
      const url = activityId ? `/api/student-feedback?page=${page}&limit=5&activityId=${activityId}` : `/api/student-feedback?page=${page}&limit=5`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setRecentFeedbacks(data.data);
        setCurrentPage(page);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedActivity?._id]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchRecentFeedbacks(newPage);
    }
  };

  const handleSubmit = useCallback(async (formData) => {
    try {
      console.log('Sending data:', formData);
      const response = await fetch('/api/student-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'สำเร็จ!',
          text: 'บันทึกความคิดเห็นเรียบร้อยแล้ว',
          confirmButtonText: 'ตกลง'
        });
        fetchFeedbackStats();
        fetchRecentFeedbacks(1); // กลับไปหน้าแรกหลังส่งใหม่
        setIsModalOpen(false); // ปิด modal หลังส่งสำเร็จ
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: result.message,
          confirmButtonText: 'ตกลง'
        });
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'เกิดข้อผิดพลาดในการส่งข้อมูล',
        confirmButtonText: 'ตกลง'
      });
    }
  }, [fetchFeedbackStats, fetchRecentFeedbacks]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">💭 แสดงความคิดเห็น</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          เขียนความคิดเห็น
        </button>
      </div>

      {/* เลือกกิจกรรม */}
      <div className="mb-4">
        <ActivitySelector
          selectedActivity={selectedActivity}
          onActivityChange={setSelectedActivity}
          showLabel={true}
        />
      </div>

      {/* สถิติภาพรวม */}
      {feedbackStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{feedbackStats.totalComments}</div>
            <div className="text-sm text-gray-600">ความคิดเห็นทั้งหมด</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{feedbackStats.averageEmotionLevel}</div>
            <div className="text-sm text-gray-600">คะแนนเฉลี่ย</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {Object.keys(feedbackStats.categoryCounts).length}
            </div>
            <div className="text-sm text-gray-600">หมวดหมู่</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Object.keys(feedbackStats.categoryCounts).length}
            </div>
            <div className="text-sm text-gray-600">ประเภท</div>
          </div>
        </div>
      )}

      {/* แสดงความคิดเห็นล่าสุด */}
      {recentFeedbacks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">💬 ความคิดเห็นล่าสุด</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="loading loading-spinner loading-md"></div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {recentFeedbacks.map((feedback) => (
                  <div key={feedback._id} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-lg">
                          {feedback.emotionLevel >= 4.5 ? '😊' : 
                           feedback.emotionLevel >= 3.5 ? '🙂' : 
                           feedback.emotionLevel >= 2.5 ? '😐' : '😞'}
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">{feedback.grade}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(feedback.createdAt).toLocaleDateString('th-TH')}
                      </span>
                    </div>
                    <p className="text-gray-700 mt-2 text-sm">{feedback.comment}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {feedback.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        คะแนน {feedback.emotionLevel}/5
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6">
                  <div className="text-center text-sm text-gray-600 mb-3">
                    หน้า {currentPage} จาก {totalPages} (แสดง 5 รายการต่อหน้า)
                  </div>
                  <div className="flex justify-center items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ← ก่อนหน้า
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 text-sm rounded transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ถัดไป →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      <StudentFeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default StudentFeedbackForm; 