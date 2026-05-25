// lib/permissions.ts
// ระบบจัดการสิทธิ์การเข้าถึงหน้าต่างๆ

export type Role = 'superadmin' | 'admin' | 'user' | 'guest';

export interface PagePermission {
  path: string;
  label: string;
  icon: string;
  description: string;
  category: 'settings' | 'management' | 'reports' | 'user';
}

// รายการหน้าทั้งหมดในระบบ
export const ALL_PAGES: PagePermission[] = [
  // Settings
  {
    path: '/admin',
    label: 'ตั้งค่าหน้าจอ',
    icon: '🛠',
    description: 'ตั้งค่าหน้าจอและระบบ',
    category: 'settings'
  },
  {
    path: '/admin/register-user',
    label: 'จัดการผู้ใช้งาน',
    icon: '👥',
    description: 'ลงทะเบียนและแก้ไขข้อมูลผู้ใช้',
    category: 'settings'
  },
  
  // Management
  {
    path: '/admin/manage-complaints',
    label: 'จัดการเรื่องร้องเรียน',
    icon: '📋',
    description: 'จัดการเรื่องร้องเรียนทั้งหมด',
    category: 'management'
  },
  {
    path: '/admin/smart-health',
    label: 'smart-health',
    icon: '🟣',
    description: 'ระบบสุขภาพอัจฉริยะ',
    category: 'management'
  },
  {
    path: '/admin/education-map',
    label: 'smart-school',
    icon: '🏫',
    description: 'ระบบการศึกษา',
    category: 'management'
  },
  {
    path: '/admin/smart-papar/water-quality',
    label: 'smart-papar (คุณภาพน้ำ)',
    icon: '💧',
    description: 'ระบบบันทึกคุณภาพน้ำรายวัน (งานประปา)',
    category: 'management'
  },
  {
    path: '/admin/pm25-settings',
    label: 'จัดการ PM2.5',
    icon: '🌫️',
    description: 'ตั้งค่าแหล่งข้อมูลฝุ่น Sheet และ DustBoy API',
    category: 'management'
  },
  {
    path: '/admin/manage-activities',
    label: 'จัดการกิจกรรม',
    icon: '📅',
    description: 'จัดการกิจกรรมต่างๆ',
    category: 'management'
  },
  
  // Reports
  {
    path: '/admin/dashboard',
    label: 'แดชบอร์ด',
    icon: '📊',
    description: 'ดูสถิติและรายงาน',
    category: 'reports'
  },
  {
    path: '/admin/feedback-analysis',
    label: 'วิเคราะห์ความคิดเห็น',
    icon: '📈',
    description: 'วิเคราะห์ความคิดเห็นผู้ใช้',
    category: 'reports'
  },
  {
    path: '/admin/my-tasks',
    label: 'งานของฉัน',
    icon: '✓',
    description: 'ดูและจัดการงานที่รอการดำเนินการ',
    category: 'management'
  },
  {
    path: '/admin/notifications',
    label: 'การแจ้งเตือน',
    icon: '🔔',
    description: 'ดูและจัดการการแจ้งเตือน',
    category: 'user'
  },
  
  // User
  {
    path: '/user/satisfaction',
    label: 'ประเมินความพึงพอใจ',
    icon: '⭐',
    description: 'ประเมินความพึงพอใจการใช้บริการ',
    category: 'user'
  },
];

// หน้าที่ superadmin เท่านั้นที่เข้าถึงได้
export const SUPERADMIN_ONLY_PAGES = [
  '/admin/superadmin',
  '/admin/superadmin/users',
  '/admin/superadmin/permissions',
];

// สิทธิ์เริ่มต้นตาม role
export const DEFAULT_PERMISSIONS: Record<Role, string[]> = {
  superadmin: ALL_PAGES.map(p => p.path), // superadmin เข้าถึงได้ทุกหน้า
  admin: [
    '/admin',
    '/admin/register-user',
    '/admin/manage-complaints',
    '/admin/dashboard',
    '/admin/smart-health',
    '/admin/education-map',
    '/admin/smart-papar/water-quality',
    '/admin/pm25-settings',
    '/admin/feedback-analysis',
    '/admin/my-tasks',
    '/admin/notifications',
    '/user/satisfaction',
  ],
  user: [
    '/user/satisfaction',
  ],
  guest: [],
};

// ฟังก์ชันตรวจสอบว่า user มีสิทธิ์เข้าถึงหน้านั้นหรือไม่
export function hasPermission(
  userRole: Role,
  userPermissions: string[] | undefined,
  pagePath: string
): boolean {
  // superadmin เข้าถึงได้ทุกหน้า
  if (userRole === 'superadmin') {
    return true;
  }
  
  // ถ้า user มี custom permissions ให้ใช้
  if (userPermissions && userPermissions.length > 0) {
    return userPermissions.some(p => pagePath.startsWith(p));
  }
  
  // ถ้าไม่มี custom permissions ให้ใช้ default ตาม role
  const defaultPerms = DEFAULT_PERMISSIONS[userRole] || [];
  return defaultPerms.some(p => pagePath.startsWith(p));
}

// ฟังก์ชันดึงหน้าที่ user เข้าถึงได้
export function getAccessiblePages(
  userRole: Role,
  userPermissions: string[] | undefined
): PagePermission[] {
  // superadmin เข้าถึงได้ทุกหน้า
  if (userRole === 'superadmin') {
    return ALL_PAGES;
  }
  
  const allowedPaths = userPermissions && userPermissions.length > 0
    ? userPermissions
    : DEFAULT_PERMISSIONS[userRole] || [];
  
  return ALL_PAGES.filter(page => 
    allowedPaths.some(p => page.path.startsWith(p) || page.path === p)
  );
}

// จัดกลุ่มหน้าตาม category
export function groupPagesByCategory(pages: PagePermission[]): Record<string, PagePermission[]> {
  return pages.reduce((acc, page) => {
    if (!acc[page.category]) {
      acc[page.category] = [];
    }
    acc[page.category].push(page);
    return acc;
  }, {} as Record<string, PagePermission[]>);
}

// Category labels
export const CATEGORY_LABELS: Record<string, string> = {
  settings: '⚙️ ตั้งค่า',
  management: '📋 จัดการ',
  reports: '📊 รายงาน',
  user: '👤 ผู้ใช้',
};

