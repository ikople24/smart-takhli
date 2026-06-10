import React, { useState, useEffect } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import Link from 'next/link';

export const NotificationBell: React.FC = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { notifications, unreadCount, setNotifications, markAsRead, isLoading, setLoading } =
    useNotificationStore();
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch notifications on mount and periodically refresh
  useEffect(() => {
    // รอให้ Clerk โหลดเสร็จและ user ล็อกอินแล้วจริงๆ ก่อน
    if (!isLoaded || !isSignedIn) return;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        // ดึง session token — ถ้าได้ null แสดงว่า session ยังไม่พร้อม ให้ข้ามไป
        const token = await getToken();
        if (!token) return;

        const response = await axios.get('/api/notifications/unread', {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-app-id': process.env.NEXT_PUBLIC_APP_ID,
          },
        });
        setNotifications(response.data.notifications || []);
      } catch (error: unknown) {
        // 401 = session หมดอายุหรือยังไม่พร้อม — ไม่ต้อง log เป็น error
        if (axios.isAxiosError(error) && error.response?.status === 401) return;
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isLoaded, isSignedIn, getToken, setNotifications, setLoading]);

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="btn btn-ghost btn-circle btn-sm relative"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-error rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="p-4 border-b border-base-300 flex items-center justify-between">
            <h3 className="font-semibold text-base">การแจ้งเตือน</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  notifications.forEach((n) => {
                    if (!n.read) markAsRead(n._id);
                  });
                }}
                className="text-xs text-primary hover:underline"
              >
                ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <span className="loading loading-spinner loading-sm" />
              </div>
            ) : recentNotifications.length > 0 ? (
              <div className="divide-y divide-base-200">
                {recentNotifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 hover:bg-base-200 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-base-200' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification._id);
                      }
                      if (notification.actionUrl) {
                        window.location.href = notification.actionUrl;
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm line-clamp-1">
                          {notification.title}
                        </h4>
                        <p className="text-xs text-base-content/70 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-base-content/50 mt-2">
                          {new Date(notification.createdAt).toLocaleString('th-TH')}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-base-content/60">
                <p className="text-sm">ไม่มีการแจ้งเตือน</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-base-300 text-center">
            <Link href="/admin/notifications" className="text-sm text-primary hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};
