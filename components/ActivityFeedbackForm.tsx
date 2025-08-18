import React, { useState, useEffect } from 'react';
import ActivityFeedbackModal from './ActivityFeedbackModal';
import Swal from 'sweetalert2';

interface Activity {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isDefault: boolean;
}

interface ActivityFeedbackFormProps {
  selectedActivity: Activity | null;
}

interface FeedbackFormData {
  activityId: string;
  grade: string;
  comment: string;
  emotionLevel: number;
  category: string;
}

interface FeedbackStats {
  totalComments: number;
  averageEmotionLevel: number;
  categoryCounts: Record<string, number>;
}

interface Feedback {
  _id: string;
  grade: string;
  comment: string;
  emotionLevel: number;
  category: string;
  createdAt: string;
}

const ActivityFeedbackForm = ({ selectedActivity: propSelectedActivity }: ActivityFeedbackFormProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null);
  const [recentFeedbacks, setRecentFeedbacks] = useState<Feedback[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(propSelectedActivity);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  useEffect(() => {
    setSelectedActivity(propSelectedActivity);
  }, [propSelectedActivity]);

  const fetchFeedbackStats = async () => {
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
  };

  const fetchRecentFeedbacks = async (page = 1) => {
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
  };

  const fetchAllActivities = async () => {
    try {
      setActivitiesLoading(true);
      const response = await fetch('/api/activities');
      const data = await response.json();
      if (data.success) {
        setActivities(data.data);
      } else {
        console.error('API returned error:', data.message);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedActivity?._id) {
      fetchFeedbackStats();
      fetchRecentFeedbacks();
    }
  }, [selectedActivity?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAllActivities();
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchRecentFeedbacks(newPage);
    }
  };

  const getActivityStatus = (activity: Activity) => {
    const now = new Date();
    const startDate = new Date(activity.startDate);
    const endDate = new Date(activity.endDate);

    if (now < startDate) {
      return { status: 'upcoming', text: 'กำลังจะเริ่ม', color: 'bg-yellow-100 text-yellow-800' };
    } else if (now > endDate) {
      return { status: 'ended', text: 'สิ้นสุดแล้ว', color: 'bg-red-100 text-red-800' };
    } else {
      return { status: 'active', text: 'กำลังดำเนินการ', color: 'bg-green-100 text-green-800' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isActivityActive = (activity: Activity) => {
    const now = new Date();
    const startDate = new Date(activity.startDate);
    const endDate = new Date(activity.endDate);
    return now >= startDate && now <= endDate;
  };

  const handleSubmit = async (formData: FeedbackFormData) => {
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
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">💭 แสดงความคิดเห็น</h2>
        {selectedActivity && isActivityActive(selectedActivity) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            เขียนความคิดเห็น
          </button>
        )}
      </div>

      {/* แสดงกิจกรรมทั้งหมด */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 เลือกกิจกรรม</h3>
        {activitiesLoading ? (
          <div className="flex justify-center py-8">
            <div className="loading loading-spinner loading-md"></div>
          </div>
        ) : activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activities.map((activity) => {
              const status = getActivityStatus(activity);
              return (
                <div 
                  key={activity._id} 
                  className={`bg-white rounded-lg shadow-md overflow-hidden border-2 transition-all hover:shadow-lg cursor-pointer ${
                    selectedActivity?._id === activity._id 
                      ? 'border-blue-500' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    if (selectedActivity?._id === activity._id) {
                      // ถ้ากดการ์ดเดิมอีกครั้ง ให้ยกเลิกการเลือก
                      setSelectedActivity(null);
                    } else {
                      // ถ้ากดการ์ดใหม่ ให้เลือกการ์ดนั้น
                      setSelectedActivity(activity);
                    }
                  }}
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="text-md font-semibold text-gray-800 line-clamp-2">
                        {activity.name}
                      </h4>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                        {status.text}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {activity.description || 'ไม่มีรายละเอียด'}
                    </p>
                    
                    <div className="space-y-1 text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="mr-1">📅</span>
                        <span>เริ่ม: {formatDate(activity.startDate)}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-1">🏁</span>
                        <span>สิ้นสุด: {formatDate(activity.endDate)}</span>
                      </div>
                    </div>
                    
                    {activity.isDefault && (
                      <div className="mt-3">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          กิจกรรมหลัก
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              ไม่มีกิจกรรมในระบบ
            </h3>
            <p className="text-gray-600">
              กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มกิจกรรม
            </p>
          </div>
        )}
      </div>

      {/* แสดงกิจกรรมที่เลือก */}
      {selectedActivity && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">กิจกรรมที่เลือก:</h3>
          <p className="text-blue-700">{selectedActivity.name}</p>
          {selectedActivity.description && (
            <p className="text-blue-600 text-sm mt-1">{selectedActivity.description}</p>
          )}
          {!isActivityActive(selectedActivity) && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-sm">
                ⚠️ กิจกรรมนี้สิ้นสุดแล้ว - สามารถดูข้อมูลสถิติและความคิดเห็นได้ แต่ไม่สามารถเขียนความคิดเห็นใหม่ได้
              </p>
            </div>
          )}
        </div>
      )}



      {/* สถิติภาพรวม */}
      {selectedActivity && feedbackStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            📊 สถิติภาพรวม
            <span className="text-sm font-normal text-gray-600 ml-2">
              สำหรับ: {selectedActivity.name}
            </span>
            {!isActivityActive(selectedActivity) && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (กิจกรรมสิ้นสุดแล้ว)
              </span>
            )}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        </div>
      )}

      {/* แสดงความคิดเห็นล่าสุด */}
      {selectedActivity && recentFeedbacks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            💬 ความคิดเห็นล่าสุด
            <span className="text-sm font-normal text-gray-600 ml-2">
              สำหรับ: {selectedActivity.name}
            </span>
            {!isActivityActive(selectedActivity) && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (กิจกรรมสิ้นสุดแล้ว)
              </span>
            )}
          </h3>
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
                <div className="flex justify-center items-center gap-2 mt-6">
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
                )}
              </>
            )}
          </div>
        )}

      {/* Modal */}
      <ActivityFeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default ActivityFeedbackForm;
