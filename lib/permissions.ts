// lib/permissions.ts
// ระบบจัดการสิทธิ์การเข้าถึงหน้าต่างๆ

export type Role = 'superadmin' | 'admin' | 'user' | 'guest';

export interface PagePermission {
  path: string;
  label: string;
  icon: string;
  description: string;
  category: 'settings' | 'management' | 'reports' | 'user';
  /**
   * ถ้า true → ซ่อนจาก TopNavbar dropdown และ LayoutAdmin sidebar
   * แต่ยังคงปรากฏใน superadmin permission UI (เพื่อให้กำหนดสิทธิ์ได้)
   * และยังเข้าถึงได้ผ่าน internal link ภายในระบบ
   */
  hideFromMenu?: boolean;
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
    description: 'ระบบสุขภาพอัจฉริยะ (ยืม-คืนอุปกรณ์, สุขภาพพนักงาน)',
    category: 'management'
  },
  {
    path: '/admin/elderly-school',
    label: 'โรงเรียนผู้สูงอายุ',
    icon: '🎓',
    description: 'แดชบอร์ดสุขภาพและกิจกรรมโรงเรียนผู้สูงอายุ',
    category: 'management'
  },
  {
    path: '/admin/elderly-schedule',
    label: 'ตั้งค่าวันเรียน (โรงเรียนผู้สูงอายุ)',
    icon: '🗓️',
    description: 'กำหนดวันเรียนครั้งที่ 1-16 ของแต่ละปีการศึกษา',
    category: 'management',
    hideFromMenu: true, // เข้าถึงผ่าน internal link ใน elderly-school
  },
  {
    path: '/admin/smart-school',
    label: 'smart-school',
    icon: '🏫',
    description: 'ระบบสำรวจการศึกษา/ทุนการศึกษา (ทะเบียนบุคคล + ใบสมัครรายปี)',
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
    path: '/admin/smart-light',
    label: 'เสาไฟสาธารณะ',
    icon: '💡',
    description: 'ทะเบียน+สำรวจเสาไฟสาธารณะ LED บนแผนที่ (กองช่าง)',
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
  {
    path: '/admin/elderly-cards',
    label: 'พิมพ์บัตร QR (โรงเรียนผู้สูงอายุ)',
    icon: '👴',
    description: 'พิมพ์บัตร QR สำหรับเช็คอินโรงเรียนผู้สูงอายุ',
    category: 'management',
    hideFromMenu: true, // เข้าถึงผ่าน internal link ใน elderly-school
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
    category: 'reports',
    hideFromMenu: true, // พักไว้ก่อน — หน้ายังพัง
  },
  {
    path: '/admin/analytics',
    label: 'สถิติและรายงาน',
    icon: '📉',
    description: 'ภาพรวมสถิติเรื่องร้องเรียน ประสิทธิภาพเจ้าหน้าที่ และความพึงพอใจ',
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
  
  // Settings — Configuration
  {
    path: '/admin/settings/organizations',
    label: 'ข้อมูลองค์กร',
    icon: '🏛️',
    description: 'จัดการข้อมูลองค์กรและสำนักงาน',
    category: 'settings'
  },
  {
    path: '/admin/settings/communities',
    label: 'ข้อมูลชุมชน',
    icon: '🏘️',
    description: 'จัดการข้อมูลชุมชนในพื้นที่',
    category: 'settings'
  },
  {
    path: '/admin/settings/geojson-map',
    label: 'แผนที่ GeoJSON',
    icon: '🗺️',
    description: 'จัดการและแสดงผล GeoJSON พื้นที่บริการบนแผนที่',
    category: 'settings'
  },

  // User
  {
    path: '/user/satisfaction',
    label: 'ประเมินความพึงพอใจ',
    icon: '⭐',
    description: 'ประเมินความพึงพอใจการใช้บริการ',
    category: 'user',
    hideFromMenu: true, // เข้าถึงผ่าน internal link ในระบบร้องเรียน
  },
];

// หน้าที่ superadmin เท่านั้นที่เข้าถึงได้
// ต้องตรงกับไฟล์จริงใน pages/admin/superadmin/
// ✓ index.jsx  → /admin/superadmin
// ✓ setup.jsx  → /admin/superadmin/setup
export const SUPERADMIN_ONLY_PAGES = [
  '/admin/superadmin',
  '/admin/superadmin/setup',
  '/admin/superadmin/audit-log',
];

// สิทธิ์เริ่มต้นตาม role — ใช้เมื่อ user ยังไม่มี allowedPages ใน Mongo (= ยังไม่ถูกตั้งค่า)
// นโยบาย: ว่าง = เห็นเฉพาะ "ชุดพื้นฐาน" จนกว่า superadmin จะติ๊กสิทธิ์เพิ่มรายคน
// (อย่าเพิ่มหน้าใหม่ลงชุด admin โดยอัตโนมัติ เว้นแต่ตั้งใจให้ทุกคนเห็นโดย default)
export const DEFAULT_PERMISSIONS: Record<Role, string[]> = {
  superadmin: ALL_PAGES.map(p => p.path), // superadmin เข้าถึงได้ทุกหน้า
  admin: [
    '/admin/dashboard',
    '/admin/my-tasks',
    '/admin/notifications',
    '/admin/smart-light',
    '/user/satisfaction',
  ],
  user: [
    '/user/satisfaction',
  ],
  guest: [],
};

// Preset "ผู้บริหาร (boss)" — เห็นทุกโมดูลยกเว้นการตั้งค่า
// ใช้เป็น "แหล่งความจริงเดียว" ให้ปุ่ม preset ในหน้า /admin/superadmin (superadmin กด
// apply ให้ user รายคน แล้วบันทึกลง allowedPages) — เพิ่มหน้าโมดูลใหม่ในหมวด management/
// reports/user เมื่อไร preset นี้จะรวมให้อัตโนมัติ
//
// /admin/pm25-settings อยู่หมวด management แต่เนื้อหาคือ "ตั้งค่าแหล่งข้อมูลฝุ่น"
// จึงถูกนับเป็นการตั้งค่าและตัดออกจาก preset นี้ (ไม่ให้ผู้บริหารเห็น)
export const EXECUTIVE_EXCLUDED_PATHS = ['/admin/pm25-settings'];

// รายการ path สำหรับ preset ผู้บริหาร = ทุกหน้าที่ category !== 'settings'
// และไม่อยู่ใน EXECUTIVE_EXCLUDED_PATHS
export function getExecutivePagePaths(): string[] {
  return ALL_PAGES
    .filter(p => p.category !== 'settings' && !EXECUTIVE_EXCLUDED_PATHS.includes(p.path))
    .map(p => p.path);
}

// path ที่ต้อง match แบบ exact เท่านั้น — ห้ามทำตัวเป็น prefix ครอบหน้าอื่น
// ('/admin' คือหน้า "ตั้งค่าหน้าจอ" — ถ้าปล่อยให้ prefix match จะกลายเป็น wildcard
// เปิดทุกหน้า /admin/* ซึ่งเป็น bug ที่เคยทำให้ admin ธรรมดาเห็นทุกหน้า)
const EXACT_MATCH_ONLY_PATHS = ['/admin'];

// ตรวจว่า pagePath อยู่ภายใต้สิทธิ์ allowedPath หรือไม่
// ใช้ตัวนี้เป็นที่เดียวทั้งระบบ (_app.tsx, LayoutAdmin, hasPermission, getAccessiblePages)
export function pathMatchesPermission(pagePath: string, allowedPath: string): boolean {
  if (pagePath === allowedPath) return true;
  if (EXACT_MATCH_ONLY_PATHS.includes(allowedPath)) return false;
  return pagePath.startsWith(allowedPath + '/');
}

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
    return userPermissions.some(p => pathMatchesPermission(pagePath, p));
  }

  // ถ้าไม่มี custom permissions ให้ใช้ default ตาม role (ชุดพื้นฐาน)
  const defaultPerms = DEFAULT_PERMISSIONS[userRole] || [];
  return defaultPerms.some(p => pathMatchesPermission(pagePath, p));
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
    allowedPaths.some(p => pathMatchesPermission(page.path, p))
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

