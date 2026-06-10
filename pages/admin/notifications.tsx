import React, { useCallback, useEffect } from 'react';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useUser, useAuth } from '@clerk/nextjs';
import axios from 'axios';
import { Badge } from '@/components/ui';
import { CheckIcon, TrashIcon } from '@heroicons/react/24/outline';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID;

const NotificationsPage = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { notifications, setNotifications, markAsRead, removeNotification } =
    useNotificationStore();

  // helper — สร้าง headers พร้อม Clerk Bearer token
  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { Authorization: `Bearer ${token}`, 'x-app-id': APP_ID };
  }, [getToken]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const response = await axios.get('/api/notifications/unread', {
          headers: await authHeaders(),
        });
        setNotifications(response.data.notifications || []);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
  }, [user, authHeaders, setNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await axios.put(`/api/notifications/${id}/read`, {}, {
        headers: await authHeaders(),
      });
      markAsRead(id);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/notifications/${id}/read`, {
        headers: await authHeaders(),
      });
      removeNotification(id);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const priorityVariant = {
    low: 'neutral' as const,
    medium: 'info' as const,
    high: 'warning' as const,
    urgent: 'error' as const,
  };

  return (
      <div className="space-y-4">
        {/* Empty State */}
        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-base-200 rounded-lg">
            <p className="text-base-content/60 text-lg">ไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-4 rounded-lg border ${
                  !notification.read
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-base-200 border-base-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Badge for unread */}
                  {!notification.read && (
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{notification.title}</h3>
                      <Badge variant="accent" size="sm">
                        {notification.type}
                      </Badge>
                      <Badge
                        variant={priorityVariant[notification.priority as keyof typeof priorityVariant]}
                        size="sm"
                      >
                        {notification.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-base-content/70 mt-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-base-content/50 mt-2">
                      {new Date(notification.createdAt).toLocaleString('th-TH')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-2">
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification._id)}
                        className="btn btn-ghost btn-sm btn-circle tooltip"
                        data-tip="ทำเครื่องหมายว่าอ่านแล้ว"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification._id)}
                      className="btn btn-ghost btn-sm btn-circle text-error tooltip"
                      data-tip="ลบ"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
};

export default NotificationsPage;
