// lib/superadmin/usersOverview.ts
// Logic ล้วนของหน้า /admin/superadmin: merge ข้อมูล Clerk + Mongo แล้วคำนวณสถานะต่อคน
// — ไม่แตะ DB/Clerk เอง (endpoint เป็นคนป้อนข้อมูล) เพื่อให้เทสได้ตรง ๆ
//
// สถานะ 6 แบบ (ดู spec 2026-08-27-superadmin-user-management-design.md):
//   no_doc    มีบัญชี Clerk แต่ไม่มี Mongo doc → ยังลงทะเบียนไม่ได้
//   orphan    มี doc แต่บัญชี Clerk ถูกลบไปแล้ว
//   broken    doc ไม่มี name (stub — เช่นถูกสร้างข้ามแอปมาไม่สมบูรณ์)
//   no_app    doc ครบแต่ยังไม่กำหนด appId
//   active    appId = แอปปัจจุบัน
//   other_app appId เป็นของแอปพี่น้อง (อ่านอย่างเดียว)
//
// สถานะอิง Mongo appId (สิทธิ์ระดับโมดูล) ส่วน clerkBlocksApp เตือนกรณี Clerk allowedApps
// (ถ้าไม่ว่างจะตัดสิน app access ขาด) ไม่อนุญาตแอปนี้

export const STATUS = {
  NO_DOC: 'no_doc',
  ORPHAN: 'orphan',
  BROKEN: 'broken',
  NO_APP: 'no_app',
  ACTIVE: 'active',
  OTHER_APP: 'other_app',
} as const;

export type UserStatus = (typeof STATUS)[keyof typeof STATUS];

export interface ClerkLite {
  clerkId: string;
  name: string;
  email: string;
  imageUrl: string;
  clerkRole: string;
  allowedApps: string[];
  lastSignInAt: number | null;
}

export interface MongoUserDoc {
  _id: string | { toString(): string };
  clerkId?: string;
  name?: string;
  position?: string;
  department?: string;
  role?: string;
  appId?: string;
  profileUrl?: string;
  profileImage?: string;
  allowedPages?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

export interface ClerkSdkUserLike {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  emailAddresses?: Array<{ emailAddress?: string | null }> | null;
  publicMetadata?: Record<string, unknown> | null;
  lastSignInAt?: number | null;
}

export interface OverviewUser {
  clerkId: string;
  mongoId: string;
  name: string;
  email: string;
  imageUrl: string;
  position: string;
  department: string;
  role: string;
  clerkRole: string;
  allowedApps: string[];
  appId: string;
  allowedPages: string[];
  lastSignInAt: number | null;
  status: UserStatus;
  isStub: boolean;
  clerkBlocksApp: boolean;
}

// undefined / null / string ว่าง / whitespace-only string = "ไม่มี"
const has = (v: unknown): boolean =>
  typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null;

// stub = doc ที่ถูกสร้างข้ามแอปมาไม่สมบูรณ์ — guard เดียวกันนี้ใช้ตัดสินว่า "ลบได้"
// ใน repair-user (action delete_stub) ห้ามผ่อนเงื่อนไข
export function isStubDoc(doc: MongoUserDoc | null | undefined): boolean {
  if (!doc) return false;
  const noPages = !Array.isArray(doc.allowedPages) || doc.allowedPages.length === 0;
  return !has(doc.name) && !has(doc.appId) && !has(doc.createdAt) && !has(doc.updatedAt) && noPages;
}

export function computeStatus(
  doc: MongoUserDoc | null | undefined,
  clerkFound: boolean,
  currentAppId: string,
  clerkAvailable = true
): UserStatus {
  if (!doc) return STATUS.NO_DOC;
  // orphan ตัดสินได้เฉพาะตอนข้อมูล Clerk เชื่อถือได้ และ doc มี clerkId ให้เช็ค
  if (clerkAvailable && has(doc.clerkId) && !clerkFound) return STATUS.ORPHAN;
  if (!has(doc.name)) return STATUS.BROKEN;
  if (!has(doc.appId)) return STATUS.NO_APP;
  if (doc.appId === currentAppId) return STATUS.ACTIVE;
  return STATUS.OTHER_APP;
}

// น้ำหนักการเรียง: ต้องดำเนินการก่อน → ใช้งานได้ → แอปอื่น
const SORT_WEIGHT: Record<UserStatus, number> = {
  [STATUS.BROKEN]: 0,
  [STATUS.ORPHAN]: 0,
  [STATUS.NO_DOC]: 1,
  [STATUS.NO_APP]: 1,
  [STATUS.ACTIVE]: 2,
  [STATUS.OTHER_APP]: 3,
};

const clerkBlocksApp = (c: ClerkLite | undefined, currentAppId: string): boolean =>
  !!c && c.clerkRole !== 'superadmin' && c.allowedApps.length > 0 &&
  !c.allowedApps.includes(currentAppId) && !c.allowedApps.includes('*');

export function buildUsersOverview(
  clerkUsers: ClerkLite[],
  mongoDocs: MongoUserDoc[],
  currentAppId: string,
  { clerkAvailable = true }: { clerkAvailable?: boolean } = {}
): OverviewUser[] {
  const byClerkId = new Map(clerkUsers.map((c) => [c.clerkId, c]));
  const seen = new Set<string>();

  const rows: OverviewUser[] = mongoDocs.map((doc) => {
    const c = has(doc.clerkId) ? byClerkId.get(doc.clerkId as string) : undefined;
    if (c) seen.add(c.clerkId);
    return {
      clerkId: doc.clerkId || '',
      mongoId: String(doc._id),
      name: (doc.name || c?.name || c?.email) || '',
      email: c?.email || '',
      imageUrl: (doc.profileUrl || doc.profileImage || c?.imageUrl) || '',
      position: doc.position || '',
      department: doc.department || '',
      role: doc.role || '',
      clerkRole: c?.clerkRole || '',
      allowedApps: c?.allowedApps || [],
      appId: doc.appId || '',
      allowedPages: Array.isArray(doc.allowedPages) ? (doc.allowedPages as string[]) : [],
      lastSignInAt: c?.lastSignInAt ?? null,
      status: computeStatus(doc, !!c, currentAppId, clerkAvailable),
      isStub: isStubDoc(doc),
      clerkBlocksApp: clerkBlocksApp(c, currentAppId),
    };
  });

  // บัญชี Clerk ที่ยังไม่มี doc — โผล่เป็นแถว no_doc (แทนกล่อง "พนักงานใหม่" เดิม)
  // guard: ถ้า Clerk ไม่เชื่อถือได้ห้ามสร้าง no_doc rows
  if (clerkAvailable) {
    for (const c of clerkUsers) {
      if (seen.has(c.clerkId)) continue;
      rows.push({
        clerkId: c.clerkId,
        mongoId: '',
        name: c.name || c.email,
        email: c.email,
        imageUrl: c.imageUrl,
        position: '',
        department: '',
        role: '',
        clerkRole: c.clerkRole,
        allowedApps: c.allowedApps,
        appId: '',
        allowedPages: [],
        lastSignInAt: c.lastSignInAt,
        status: STATUS.NO_DOC,
        isStub: false,
        clerkBlocksApp: clerkBlocksApp(c, currentAppId),
      });
    }
  }

  return rows.sort(
    (a, b) =>
      SORT_WEIGHT[a.status] - SORT_WEIGHT[b.status] ||
      a.name.localeCompare(b.name, 'th')
  );
}

// แปลง Clerk SDK user object → รูปแบบภายใน (เรียกจาก endpoint)
export function toClerkLite(u: ClerkSdkUserLike): ClerkLite {
  const meta = u.publicMetadata || {};
  const allowedApps = Array.isArray(meta.allowedApps) ? (meta.allowedApps as string[]) : [];
  const clerkRole = typeof meta.role === 'string' ? meta.role : '';
  return {
    clerkId: u.id,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
    email: u.emailAddresses?.[0]?.emailAddress || '',
    imageUrl: u.imageUrl || '',
    clerkRole,
    allowedApps,
    lastSignInAt: u.lastSignInAt ?? null,
  };
}
