import { create } from 'zustand';

export interface Notification {
  _id: string;
  userId: string;
  type: 'complaint_assigned' | 'complaint_status_updated' | 'task_pending' | 'feedback_requested' | 'admin_alert' | 'system_notice';
  title: string;
  message: string;
  actionUrl?: string;
  relatedId?: string;
  read: boolean;
  readAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;

  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setLoading: (loading: boolean) => void;

  // Computed
  getUnreadCount: () => number;
  getUnreadNotifications: () => Notification[];
  getRecentNotifications: (count: number) => Notification[];
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  setNotifications: (notifications) => {
    const unreadCount = notifications.filter((n) => !n.read).length;
    set({ notifications, unreadCount });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.read ? state.unreadCount : state.unreadCount + 1,
    }));
  },

  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n._id === id);
      const newUnreadCount =
        notification && !notification.read ? state.unreadCount - 1 : state.unreadCount;
      return {
        notifications: state.notifications.filter((n) => n._id !== id),
        unreadCount: newUnreadCount,
      };
    });
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, read: true, readAt: new Date() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAsUnread: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n._id === id ? { ...n, read: false, readAt: undefined } : n
      ),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        read: true,
        readAt: new Date(),
      })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },

  getUnreadNotifications: () => {
    return get().notifications.filter((n) => !n.read);
  },

  getRecentNotifications: (count: number = 5) => {
    return get().notifications.slice(0, count);
  },
}));
