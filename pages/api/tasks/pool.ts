// pages/api/tasks/pool.ts
// GET /api/tasks/pool?groupBy=organization|category|priority&q=&community=&days=30|90|365|all&onlyStale=1
// เรื่องที่ยังไม่มีคนรับ (ไม่มี Assignment, ยังไม่ปิด) แยกคอลัมน์ + ป้าย + ปุ่มตามกองของเจ้าหน้าที่ (README หน้าจอ 2)
// สิทธิ์: ต้องเข้าหน้า /admin/task-pool ได้ (requirePage) · ไม่คืนชื่อ/เบอร์ผู้แจ้ง (repeatCount นับฝั่ง server)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getTaskSettings } from '@/lib/tasks/loadSettings';
import { loadPoolItems, loadWorkload, loadInProgressByDepartment } from '@/lib/tasks/loadPool';
import { POOL_GROUP_BY, poolAction, groupPool, staleSummary } from '@/lib/tasks/pool';
import { DEPARTMENTS, normalizeDepartment } from '@/lib/tasks/departments';
import { taskPermissions } from '@/lib/tasks/roles';
import type { GroupBy, PoolColumn, PoolItem } from '@/lib/tasks/types';
import { requirePage } from './_auth';

export const PAGE_PATH = '/admin/task-pool';
const DAY_OPTIONS = new Set([30, 90, 365]);

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const auth = await requirePage(req, PAGE_PATH);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.message });
  const { officer } = auth;

  const groupByRaw = String(req.query.groupBy ?? '');
  const groupBy = ((POOL_GROUP_BY as readonly string[]).includes(groupByRaw) ? groupByRaw : 'organization') as GroupBy;
  const q = String(req.query.q ?? '').trim();
  const community = String(req.query.community ?? '').trim();
  // default = ทั้งหมด (เจ้าของยืนยัน 2026-09-02: หน้านี้ต้องเห็นทุกเรื่อง) — ส่ง 30/90/365 มาเพื่อแคบเอง
  const daysRaw = String(req.query.days ?? 'all');
  const days = DAY_OPTIONS.has(Number(daysRaw)) ? Number(daysRaw) : null;
  const onlyStale = req.query.onlyStale === '1' || req.query.onlyStale === 'true';

  try {
    const now = new Date();
    const settings = await getTaskSettings();
    const isSuperAdmin = auth.isSuperAdmin;
    const officerDepartment = normalizeDepartment(officer.department);
    // หัวหน้ากอง = ติ๊กโดย superadmin (users.isDepartmentHead) หรือตำแหน่งเข้าเกณฑ์ (lib/tasks/roles.js)
    const perms = taskPermissions({ isSuperAdmin, user: officer });
    const canAssign = perms.canAssign;

    const [{ items: baseItems, olderOutsideWindow, communities }, workload, inProgressByDepartment] = await Promise.all([
      loadPoolItems({ settings, now, days }),
      loadWorkload(),
      loadInProgressByDepartment(),
    ]);

    const items = (baseItems as Array<Omit<PoolItem, 'action'>>).map((it) => ({
      ...it,
      action: poolAction(it, { officerDepartment, isSuperAdmin }) as PoolItem['action'],
    }));

    const nq = norm(q);
    const filtered = items.filter((it) => {
      if (onlyStale && !it.isStale) return false;
      if (community && it.community !== community) return false;
      if (nq) {
        const hay = [it.code, it.title, it.category, it.community, it.department].map(norm).join(' ');
        if (!hay.includes(nq)) return false;
      }
      return true;
    });

    // กองที่มีงานกำลังดำเนินการ → มีคอลัมน์เสมอ (ไม่งั้นกองที่รับงานหมดแล้วหายไปทั้ง tab — ผู้ใช้งง)
    const columns = groupPool(filtered, groupBy, { officerDepartment, settings, activeDepartments: Object.keys(inProgressByDepartment) }) as PoolColumn[];
    const stale = { ...staleSummary(filtered), olderOutsideWindow };

    return res.status(200).json({
      success: true,
      now: now.toISOString(),
      officer: {
        id: String(officer._id),
        name: officer.name ?? '',
        department: officerDepartment,
        rawDepartment: officer.department ?? '',
        canAssign,
        isSuperAdmin,
        isHead: perms.isHead,
      },
      settings,
      filters: { groupBy, q, community, days, onlyStale },
      items: filtered,
      columns,
      stale,
      total: items.length,
      communities,
      departments: DEPARTMENTS.map((d) => ({ name: d.name, short: d.short })),
      workload,
      inProgressByDepartment,
    });
  } catch (err) {
    console.error('[tasks] pool failed:', err);
    return res.status(500).json({ success: false, error: 'โหลดกองงานรอรับไม่สำเร็จ' });
  }
}
