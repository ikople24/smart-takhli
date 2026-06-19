// หน้าวิเคราะห์สถิติและรายงาน — Phase 2
// ใช้ Recharts สำหรับแสดงกราฟ, LayoutAdmin สำหรับ layout

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UserGroupIcon,
  StarIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

// ---------- Types ----------

interface Summary {
  totalComplaints: number;
  statusBreakdown: Record<string, number>;
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  completionRate: number;
  avgSatisfaction: number | null;
  totalRatings: number;
  avgResolutionDays: number | null;
}

interface TrendPoint { date: string; count: number }
interface CategoryPoint { category: string; count: number }
interface StatusPoint { status: string; count: number }
interface OfficerPoint {
  name: string; total: number; completed: number;
  pending: number; completionRate: number; avgResolutionDays: number | null;
}
interface SatisfactionWeek { label: string; avgRating: number; count: number }
interface SatisfactionDist { [key: number]: number }

// ---------- Palette ----------

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#f97316'];
const STATUS_COLORS: Record<string, string> = {
  'เสร็จสิ้น': '#22c55e',
  'อยู่ระหว่างดำเนินการ': '#f59e0b',
  'รอการตรวจสอบ': '#06b6d4',
  'รอการอนุมัติ': '#a855f7',
  'ยกเลิก': '#ef4444',
};

// ---------- Helper Components ----------

function KpiCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>; color: string;
}) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-base-content/60">{title}</p>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ---------- Main Page ----------

type DaysOption = 7 | 30 | 90 | 180;

export default function AnalyticsPage() {
  const [days, setDays] = useState<DaysOption>(30);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [categories, setCategories] = useState<CategoryPoint[]>([]);
  const [statuses, setStatuses] = useState<StatusPoint[]>([]);
  const [officers, setOfficers] = useState<OfficerPoint[]>([]);
  const [satisfactionTrend, setSatisfactionTrend] = useState<SatisfactionWeek[]>([]);
  const [satisfactionDist, setSatisfactionDist] = useState<SatisfactionDist>({});

  const fetchAll = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const [sumRes, trendRes, catRes, offRes, satRes] = await Promise.all([
        fetch('/api/analytics/summary'),
        fetch(`/api/analytics/complaints-trend?days=${d}`),
        fetch(`/api/analytics/category?days=${d}`),
        fetch(`/api/analytics/officers?days=${d}`),
        fetch(`/api/analytics/satisfaction?days=${d}`),
      ]);

      const [sumData, trendData, catData, offData, satData] = await Promise.all([
        sumRes.json(), trendRes.json(), catRes.json(), offRes.json(), satRes.json(),
      ]);

      if (sumData.success) setSummary(sumData.summary);
      if (trendData.success) setTrend(trendData.trend);
      if (catData.success) {
        setCategories(catData.breakdown);
        setStatuses(catData.statusBreakdown);
      }
      if (offData.success) setOfficers(offData.officers);
      if (satData.success) {
        setSatisfactionTrend(satData.weeklyTrend);
        setSatisfactionDist(satData.distribution);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(days); }, [days, fetchAll]);

  const dayOptions: { label: string; value: DaysOption }[] = [
    { label: '7 วัน', value: 7 },
    { label: '30 วัน', value: 30 },
    { label: '90 วัน', value: 90 },
    { label: '180 วัน', value: 180 },
  ];

  const distData = [1, 2, 3, 4, 5].map((star) => ({
    star: `${star}⭐`,
    count: satisfactionDist[star] ?? 0,
  }));

  return (
    <>
      {/* Date range selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-primary" />
          รายงานช่วง {days} วันที่ผ่านมา
        </h2>
        <div className="join">
          {dayOptions.map((opt) => (
            <button
              key={opt.value}
              className={`join-item btn btn-sm ${days === opt.value ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="เรื่องร้องเรียนทั้งหมด"
              value={summary?.totalComplaints ?? 0}
              sub="ตลอดทุกช่วงเวลา"
              icon={ClipboardDocumentListIcon}
              color="bg-primary/10 text-primary"
            />
            <KpiCard
              title="งานเสร็จสิ้น"
              value={`${summary?.completionRate ?? 0}%`}
              sub={`${summary?.completedAssignments ?? 0} / ${summary?.totalAssignments ?? 0} งาน`}
              icon={CheckCircleIcon}
              color="bg-success/10 text-success"
            />
            <KpiCard
              title="ความพึงพอใจเฉลี่ย"
              value={summary?.avgSatisfaction ? `${summary.avgSatisfaction} / 5` : '-'}
              sub={`จาก ${summary?.totalRatings ?? 0} การประเมิน`}
              icon={StarIcon}
              color="bg-warning/10 text-warning"
            />
            <KpiCard
              title="เวลาแก้ไขเฉลี่ย"
              value={summary?.avgResolutionDays != null ? `${summary.avgResolutionDays} วัน` : '-'}
              sub="นับจากวันที่มอบหมาย"
              icon={ClockIcon}
              color="bg-info/10 text-info"
            />
          </div>

          {/* Row 1: Complaint trend + Status pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Complaint Trend - ยาว 2/3 */}
            <div className="lg:col-span-2 card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-primary" />
                  ปริมาณเรื่องร้องเรียนรายวัน
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.slice(5)} // MM-DD
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: number) => [v, 'เรื่อง']}
                      labelFormatter={(l: string) => `วันที่ ${l}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      name="จำนวนเรื่อง"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Pie - 1/3 */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h3 className="font-semibold mb-4">สถานะเรื่องร้องเรียน</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statuses}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={false}
                    >
                      {statuses.map((entry, idx) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status] || COLORS[idx % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'เรื่อง']} />
                    <Legend
                      formatter={(value: string) => (
                        <span style={{ fontSize: 11 }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Category bar + Satisfaction area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category breakdown */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h3 className="font-semibold mb-4">เรื่องร้องเรียนตามหมวดหมู่</h3>
                {categories.length === 0 ? (
                  <p className="text-center text-base-content/40 py-8 text-sm">ไม่มีข้อมูลในช่วงนี้</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categories} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="category"
                        tick={{ fontSize: 11 }}
                        width={120}
                      />
                      <Tooltip formatter={(v: number) => [v, 'เรื่อง']} />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="จำนวน" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Satisfaction trend */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h3 className="font-semibold mb-4">แนวโน้มความพึงพอใจรายสัปดาห์</h3>
                {satisfactionTrend.length === 0 ? (
                  <p className="text-center text-base-content/40 py-8 text-sm">ไม่มีข้อมูลในช่วงนี้</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={satisfactionTrend}>
                      <defs>
                        <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          name === 'avgRating' ? `${v} ⭐` : v,
                          name === 'avgRating' ? 'คะแนนเฉลี่ย' : 'จำนวน',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="avgRating"
                        stroke="#f59e0b"
                        fill="url(#satGrad)"
                        strokeWidth={2}
                        name="avgRating"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Officer performance */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <UserGroupIcon className="w-4 h-4 text-primary" />
                ประสิทธิภาพเจ้าหน้าที่ (Top 10)
              </h3>
              {officers.length === 0 ? (
                <p className="text-center text-base-content/40 py-8 text-sm">ไม่มีข้อมูลในช่วงนี้</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={officers}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" fill="#22c55e" name="เสร็จสิ้น" stackId="a" />
                      <Bar dataKey="pending" fill="#f59e0b" name="รอดำเนิน" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Officer table */}
                  <div className="overflow-x-auto mt-4">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>เจ้าหน้าที่</th>
                          <th className="text-right">รับทั้งหมด</th>
                          <th className="text-right">เสร็จ</th>
                          <th className="text-right">อัตราสำเร็จ</th>
                          <th className="text-right">เฉลี่ย (วัน)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {officers.map((o) => (
                          <tr key={o.name}>
                            <td className="font-medium">{o.name}</td>
                            <td className="text-right">{o.total}</td>
                            <td className="text-right">{o.completed}</td>
                            <td className="text-right">
                              <span className={`badge badge-sm ${
                                o.completionRate >= 80 ? 'badge-success' :
                                o.completionRate >= 50 ? 'badge-warning' : 'badge-error'
                              }`}>
                                {o.completionRate}%
                              </span>
                            </td>
                            <td className="text-right">
                              {o.avgResolutionDays != null ? `${o.avgResolutionDays} วัน` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 4: Satisfaction distribution */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <StarIcon className="w-4 h-4 text-warning" />
                การกระจายคะแนนความพึงพอใจ
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={distData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="star" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number) => [v, 'ครั้ง']} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="จำนวน" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* No data hint */}
          {summary?.totalComplaints === 0 && (
            <div className="alert alert-info">
              <ExclamationTriangleIcon className="w-5 h-5" />
              <span>ยังไม่มีข้อมูลในระบบ — กราฟจะแสดงผลเมื่อมีเรื่องร้องเรียนเข้ามา</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
