import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Layout from '@/components/Layout';
import ActivityFeedbackForm from '@/components/ActivityFeedbackForm';

interface Activity {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isDefault: boolean;
  images?: string[];
  views?: number;
  stats?: { avgRating: number | null; count: number };
}

const ActivitiesPage = () => {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  // นับผู้เข้าชมเมื่อเปิดดูรายละเอียด — 1 ครั้ง/กิจกรรม/session
  useEffect(() => {
    if (!selectedActivity) return;
    const key = `activity-viewed-${selectedActivity._id}`;
    if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      fetch(`/api/activities/${selectedActivity._id}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [selectedActivity]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      // ใช้ feed endpoint เพื่อให้ได้ stats (คะแนนเฉลี่ย) และ views มาด้วย
      const response = await fetch('/api/activities/feed?limit=50');
      const data = await response.json();
      if (data.success) {
        setActivities(data.data);
        // เลือกจาก ?activity= ก่อน แล้วค่อย fallback เป็นกิจกรรมเริ่มต้น
        const fromQuery =
          typeof router.query.activity === 'string'
            ? data.data.find((a: Activity) => a._id === router.query.activity)
            : null;
        const defaultActivity =
          fromQuery || data.data.find((a: Activity) => a.isDefault) || data.data[0];
        if (defaultActivity) {
          setSelectedActivity(defaultActivity);
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center py-12">
            <div className="loading loading-spinner loading-lg"></div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            🎉 กิจกรรมที่เปิดให้เข้าร่วม
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            กิจกรรมต่างๆ ที่เปิดให้ประชาชนและเยาวชนเข้าร่วม พร้อมแสดงความคิดเห็นและข้อเสนอแนะ
          </p>
        </div>

        {/* Activities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {activities.map((activity) => {
            const status = getActivityStatus(activity);
            
            return (
              <div 
                key={activity._id} 
                className={`bg-white rounded-lg shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl cursor-pointer ${
                  selectedActivity?._id === activity._id 
                    ? 'border-blue-500' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedActivity(activity)}
              >
                <div className="relative aspect-video bg-gradient-to-br from-indigo-100 to-blue-200">
                  {activity.images?.[0] ? (
                    <Image
                      src={activity.images[0]}
                      alt={activity.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-5xl">📅</div>
                  )}
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 line-clamp-2">
                      {activity.name}
                    </h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                      {status.text}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {activity.description || 'ไม่มีรายละเอียด'}
                  </p>
                  
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className="mr-2">📅</span>
                      <span>เริ่ม: {formatDate(activity.startDate)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="mr-2">🏁</span>
                      <span>สิ้นสุด: {formatDate(activity.endDate)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="mr-2">👁</span>
                      <span>
                        {activity.views || 0} ผู้เข้าชม ·{' '}
                        {activity.stats?.count
                          ? `⭐ ${activity.stats.avgRating?.toFixed(1)} (${activity.stats.count})`
                          : 'ยังไม่มีความเห็น'}
                      </span>
                    </div>
                  </div>
                  
                  {activity.isDefault && (
                    <div className="mt-4">
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

        {/* Selected Activity Feedback */}
        {selectedActivity && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                💭 แสดงความคิดเห็น: {selectedActivity.name}
              </h2>
              <p className="text-gray-600 mb-4">
                {selectedActivity.description}
              </p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>📅 {formatDate(selectedActivity.startDate)} - {formatDate(selectedActivity.endDate)}</span>
                <span>👁 {selectedActivity.views || 0} ผู้เข้าชม</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActivityStatus(selectedActivity).color}`}>
                  {getActivityStatus(selectedActivity).text}
                </span>
              </div>
            </div>

            {selectedActivity.images && selectedActivity.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {selectedActivity.images.map((img, i) => (
                  <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-gray-200">
                    <Image
                      src={img}
                      alt={`${selectedActivity.name} ${i + 1}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <ActivityFeedbackForm selectedActivity={selectedActivity} />
          </div>
        )}

        {/* No Activities Message */}
        {activities.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              ไม่มีกิจกรรมที่เปิดให้เข้าร่วมในขณะนี้
            </h3>
            <p className="text-gray-600">
              กรุณาตรวจสอบอีกครั้งในภายหลัง หรือติดต่อผู้ดูแลระบบเพื่อสอบถามข้อมูลเพิ่มเติม
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ActivitiesPage;
