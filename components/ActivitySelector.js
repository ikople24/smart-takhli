import React, { useState, useEffect, useCallback } from 'react';

const ActivitySelector = ({ selectedActivity, onActivityChange, showLabel = true }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/activities');
      const data = await response.json();
      
      if (data.success) {
        setActivities(data.data);
      } else {
        setError('ไม่สามารถโหลดกิจกรรมได้');
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      setError('เกิดข้อผิดพลาดในการโหลดกิจกรรม');
    } finally {
      setLoading(false);
    }
  }, []); // ลบ dependencies ที่ทำให้เกิด infinite loop

  // Call after fetchActivities is defined to avoid TDZ during SSR
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // แยก logic การเลือก default activity ออกมา
  useEffect(() => {
    if (activities.length > 0 && !selectedActivity) {
      const defaultActivity = activities.find(activity => activity.isDefault) || activities[0];
      onActivityChange(defaultActivity);
    }
  }, [activities, selectedActivity, onActivityChange]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        {error}
      </div>
    );
  }

        if (activities.length === 0) {
        return (
          <div className="text-gray-500 text-sm">
            ไม่มีกิจกรรมในระบบ
          </div>
        );
      }

  return (
    <div>
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          เลือกกิจกรรม *
        </label>
      )}
      <select
        value={selectedActivity?._id || ''}
        onChange={(e) => {
          const activity = activities.find(a => a._id === e.target.value);
          onActivityChange(activity);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required
      >
        <option value="">เลือกกิจกรรม</option>
        {activities.map((activity) => {
          const now = new Date();
          const startDate = new Date(activity.startDate);
          const endDate = new Date(activity.endDate);
          let status = '';
          
          if (now < startDate) {
            status = ' (กำลังจะเริ่ม)';
          } else if (now > endDate) {
            status = ' (สิ้นสุดแล้ว)';
          } else {
            status = ' (กำลังดำเนินการ)';
          }
          
          return (
            <option key={activity._id} value={activity._id}>
              {activity.name}
              {activity.isDefault && ' (กิจกรรมหลัก)'}
              {status}
            </option>
          );
        })}
      </select>
      {selectedActivity && (
        <div className="mt-2 text-sm text-gray-600">
          <p><strong>รายละเอียด:</strong> {selectedActivity.description || 'ไม่มีรายละเอียด'}</p>
          <p><strong>วันที่:</strong> {new Date(selectedActivity.startDate).toLocaleDateString('th-TH')} - {new Date(selectedActivity.endDate).toLocaleDateString('th-TH')}</p>
          <p><strong>สถานะ:</strong> {
            (() => {
              const now = new Date();
              const startDate = new Date(selectedActivity.startDate);
              const endDate = new Date(selectedActivity.endDate);
              
              if (now < startDate) {
                return '🟡 กำลังจะเริ่ม';
              } else if (now > endDate) {
                return '🔴 สิ้นสุดแล้ว';
              } else {
                return '🟢 กำลังดำเนินการ';
              }
            })()
          }</p>
        </div>
      )}
    </div>
  );
};

export default ActivitySelector;
