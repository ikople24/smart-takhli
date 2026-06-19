import React, { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Gauge,
  HeartPulse,
  Info,
  Ruler,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import {
  CartesianGrid,
  Label,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type BmiCat = string;
type BpCat = string;

export type EnrichedVisit = {
  visitNo: number;
  checkinDate?: string | null;
  weightKg?: number | null;
  waistCm?: number | null;
  pulseBpm?: number | null;
  bp1Sys?: number | null;
  bp1Dia?: number | null;
  bp2Sys?: number | null;
  bp2Dia?: number | null;
  bmi?: number | null;
  bmiCategory?: BmiCat;
  bp1Category?: BpCat;
};

type Props = {
  fullName: string;
  yearBE: number;
  heightCm: number | null;
  visits: EnrichedVisit[];
  todayNote?: string;
};

type ColorScheme = {
  bar: string;
  dot: string;
  text: string;
  chip: string;
  ring: string;
  glow: string;
};

const BMI_LABEL: Record<string, string> = {
  underweight: "ผอม",
  normal: "ปกติ",
  overweight: "น้ำหนักเกิน",
  obese1: "อ้วน ระดับ 1",
  obese2: "อ้วน ระดับ 2",
  unknown: "—",
};

const BP_LABEL: Record<string, string> = {
  low: "ต่ำ",
  normal: "ปกติ",
  risk: "ควบคุม/เสี่ยง",
  high: "สูง",
  unknown: "—",
};

const BMI_COLOR: Record<string, ColorScheme> = {
  underweight: {
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    text: "text-sky-700",
    chip: "bg-sky-100 text-sky-700 border-sky-200",
    ring: "ring-sky-200",
    glow: "from-sky-50 to-white",
  },
  normal: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-200",
    glow: "from-emerald-50 to-white",
  },
  overweight: {
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-700",
    chip: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "ring-amber-200",
    glow: "from-amber-50 to-white",
  },
  obese1: {
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    text: "text-orange-700",
    chip: "bg-orange-100 text-orange-700 border-orange-200",
    ring: "ring-orange-200",
    glow: "from-orange-50 to-white",
  },
  obese2: {
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    text: "text-rose-700",
    chip: "bg-rose-100 text-rose-700 border-rose-200",
    ring: "ring-rose-200",
    glow: "from-rose-50 to-white",
  },
  unknown: {
    bar: "bg-gray-300",
    dot: "bg-gray-300",
    text: "text-gray-500",
    chip: "bg-gray-100 text-gray-600 border-gray-200",
    ring: "ring-gray-200",
    glow: "from-gray-50 to-white",
  },
};

const BP_COLOR: Record<string, ColorScheme> = {
  low: {
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    text: "text-sky-700",
    chip: "bg-sky-100 text-sky-700 border-sky-200",
    ring: "ring-sky-200",
    glow: "from-sky-50 to-white",
  },
  normal: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-200",
    glow: "from-emerald-50 to-white",
  },
  risk: {
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-700",
    chip: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "ring-amber-200",
    glow: "from-amber-50 to-white",
  },
  high: {
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    text: "text-rose-700",
    chip: "bg-rose-100 text-rose-700 border-rose-200",
    ring: "ring-rose-200",
    glow: "from-rose-50 to-white",
  },
  unknown: {
    bar: "bg-gray-300",
    dot: "bg-gray-300",
    text: "text-gray-500",
    chip: "bg-gray-100 text-gray-600 border-gray-200",
    ring: "ring-gray-200",
    glow: "from-gray-50 to-white",
  },
};

function formatBp(sys?: number | null, dia?: number | null) {
  if (sys == null || dia == null) return "—";
  return `${sys}/${dia}`;
}

function formatDateThai(iso?: string | null) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = Number(m[3]);
  const mo = Number(m[2]);
  const y = Number(m[1]) + 543;
  const months = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  return `${d} ${months[mo - 1]} ${String(y).slice(-2)}`;
}

function pickLatest<T extends { [k: string]: unknown }>(list: T[], getter: (v: T) => number | null | undefined) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const v = getter(list[i]);
    if (v != null && !Number.isNaN(Number(v))) return list[i];
  }
  return null;
}

function delta(current?: number | null, previous?: number | null) {
  if (current == null || previous == null) return null;
  const d = Number(current) - Number(previous);
  if (Number.isNaN(d)) return null;
  return d;
}

function DeltaPill({ value, unit, invertColor = false }: { value: number | null; unit?: string; invertColor?: boolean }) {
  if (value == null || Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
        <Minus className="w-3 h-3" />
        คงที่
      </span>
    );
  }
  const up = value > 0;
  const good = invertColor ? !up : up;
  const color = good
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}
      {value.toFixed(1)}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

export default function ElderlyPersonalHealthSummary({
  fullName,
  yearBE,
  heightCm,
  visits,
  todayNote,
}: Props) {
  const sorted = useMemo(() => [...visits].sort((a, b) => a.visitNo - b.visitNo), [visits]);

  const latestWeight = useMemo(() => pickLatest(sorted, (v) => v.weightKg ?? null), [sorted]);
  const prevWeight = useMemo(() => {
    if (!latestWeight) return null;
    const idx = sorted.findIndex((v) => v.visitNo === latestWeight.visitNo);
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (sorted[i].weightKg != null) return sorted[i];
    }
    return null;
  }, [sorted, latestWeight]);

  const latestBmi = useMemo(() => pickLatest(sorted, (v) => v.bmi ?? null), [sorted]);
  const prevBmi = useMemo(() => {
    if (!latestBmi) return null;
    const idx = sorted.findIndex((v) => v.visitNo === latestBmi.visitNo);
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (sorted[i].bmi != null) return sorted[i];
    }
    return null;
  }, [sorted, latestBmi]);

  const latestBp = useMemo(
    () => pickLatest(sorted, (v) => (v.bp1Sys != null ? v.bp1Sys : null)),
    [sorted]
  );

  const latestWaist = useMemo(() => pickLatest(sorted, (v) => v.waistCm ?? null), [sorted]);
  const prevWaist = useMemo(() => {
    if (!latestWaist) return null;
    const idx = sorted.findIndex((v) => v.visitNo === latestWaist.visitNo);
    for (let i = idx - 1; i >= 0; i -= 1) {
      if (sorted[i].waistCm != null) return sorted[i];
    }
    return null;
  }, [sorted, latestWaist]);

  const bmiColor = BMI_COLOR[latestBmi?.bmiCategory || "unknown"] || BMI_COLOR.unknown;
  const bpColor = BP_COLOR[latestBp?.bp1Category || "unknown"] || BP_COLOR.unknown;

  const weightDelta = delta(latestWeight?.weightKg, prevWeight?.weightKg);
  const bmiDelta = delta(latestBmi?.bmi, prevBmi?.bmi);
  const waistDelta = delta(latestWaist?.waistCm, prevWaist?.waistCm);

  const totalWithData = sorted.filter(
    (v) => v.weightKg != null || v.waistCm != null || v.bp1Sys != null
  ).length;

  const initials = useMemo(() => {
    const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0].slice(0, 1);
    return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`;
  }, [fullName]);

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 shadow-xl ring-1 ring-white/10">
        <div className="absolute -top-12 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex items-start gap-4">
          <div className="shrink-0 h-14 w-14 rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur flex items-center justify-center text-xl font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> สรุปสุขภาพรายบุคคล
            </p>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5 leading-tight truncate">
              {fullName || "-"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/90">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> ปีการศึกษา พ.ศ. {yearBE}
              </span>
              {heightCm != null && (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5" /> สูง {heightCm} ซม.
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> มีข้อมูล {totalWithData} ครั้ง
              </span>
            </div>
          </div>
        </div>
        {todayNote && (
          <div className="relative mt-4 flex items-start gap-2 text-sm bg-white/15 rounded-2xl px-3 py-2 border border-white/20">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="leading-relaxed">{todayNote}</p>
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={<Gauge className="w-4 h-4" />}
          label="BMI ล่าสุด"
          value={latestBmi?.bmi != null ? Number(latestBmi.bmi).toFixed(1) : "—"}
          chip={latestBmi?.bmiCategory ? BMI_LABEL[latestBmi.bmiCategory] || latestBmi.bmiCategory : "ยังไม่มีข้อมูล"}
          color={bmiColor}
          trailing={
            bmiDelta != null ? (
              <DeltaPill value={Number(bmiDelta.toFixed(2))} invertColor />
            ) : null
          }
        />
        <KpiCard
          icon={<HeartPulse className="w-4 h-4" />}
          label="ความดันโลหิต"
          value={
            latestBp
              ? formatBp(latestBp.bp1Sys ?? latestBp.bp2Sys, latestBp.bp1Dia ?? latestBp.bp2Dia)
              : "—"
          }
          chip={latestBp?.bp1Category ? BP_LABEL[latestBp.bp1Category] || latestBp.bp1Category : "ยังไม่มีข้อมูล"}
          color={bpColor}
        />
        <KpiCard
          icon={<Scale className="w-4 h-4" />}
          label="น้ำหนักล่าสุด"
          value={latestWeight?.weightKg != null ? `${latestWeight.weightKg} กก.` : "—"}
          chip={
            latestWeight?.checkinDate
              ? `บันทึก ${formatDateThai(latestWeight.checkinDate)}`
              : latestWeight
                ? `ครั้งที่ ${latestWeight.visitNo}`
                : "ยังไม่มีข้อมูล"
          }
          color={BMI_COLOR.unknown}
          neutralChip
          trailing={
            weightDelta != null ? (
              <DeltaPill value={Number(weightDelta.toFixed(1))} unit="กก." invertColor />
            ) : null
          }
        />
        <KpiCard
          icon={<Ruler className="w-4 h-4" />}
          label="รอบเอวล่าสุด"
          value={latestWaist?.waistCm != null ? `${latestWaist.waistCm} ซม.` : "—"}
          chip={
            latestWaist?.checkinDate
              ? `บันทึก ${formatDateThai(latestWaist.checkinDate)}`
              : latestWaist
                ? `ครั้งที่ ${latestWaist.visitNo}`
                : "ยังไม่มีข้อมูล"
          }
          color={BMI_COLOR.unknown}
          neutralChip
          trailing={
            waistDelta != null ? (
              <DeltaPill value={Number(waistDelta.toFixed(1))} unit="ซม." invertColor />
            ) : null
          }
        />
      </div>

      {/* Trends - infographic line charts */}
      <TrendSection sorted={sorted} />

      {/* Visit history */}
      <div className="rounded-3xl bg-white ring-1 ring-gray-200/70 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-emerald-600" /> ประวัติตามครั้งที่มาเรียน
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              น้ำหนัก · รอบเอว · ชีพจร · ความดัน · BMI
            </p>
          </div>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">
            {sorted.length} ครั้ง
          </span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              ยังไม่มีข้อมูลการวัดในปีนี้
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((v) => {
                const bmiCat = v.bmiCategory || "unknown";
                const bpCat = v.bp1Category || "unknown";
                const bc = BMI_COLOR[bmiCat] || BMI_COLOR.unknown;
                const pc = BP_COLOR[bpCat] || BP_COLOR.unknown;
                return (
                  <li
                    key={v.visitNo}
                    className="relative px-5 py-4 transition-colors hover:bg-gray-50/80"
                  >
                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${bc.bar} opacity-80`} aria-hidden />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gray-900 text-white text-[11px] font-bold tabular-nums">
                            {v.visitNo}
                          </span>
                          {v.checkinDate && (
                            <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {formatDateThai(v.checkinDate)}
                            </span>
                          )}
                          {v.bmiCategory && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bc.chip}`}>
                              BMI {BMI_LABEL[bmiCat] || bmiCat}
                            </span>
                          )}
                          {v.bp1Category && v.bp1Category !== "unknown" && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pc.chip}`}>
                              BP {BP_LABEL[bpCat] || bpCat}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-[12px] text-gray-700">
                          <Metric icon={<Scale className="w-3.5 h-3.5 text-gray-400" />} label="น้ำหนัก" value={v.weightKg != null ? `${v.weightKg} กก.` : "—"} />
                          <Metric icon={<Ruler className="w-3.5 h-3.5 text-gray-400" />} label="รอบเอว" value={v.waistCm != null ? `${v.waistCm} ซม.` : "—"} />
                          <Metric icon={<HeartPulse className="w-3.5 h-3.5 text-gray-400" />} label="ชีพจร" value={v.pulseBpm != null ? `${v.pulseBpm}` : "—"} />
                          <Metric icon={<Gauge className="w-3.5 h-3.5 text-gray-400" />} label="BMI" value={v.bmi != null ? Number(v.bmi).toFixed(1) : "—"} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">ความดัน</p>
                        <p className="text-sm font-bold text-gray-900 tabular-nums mt-0.5">
                          {formatBp(v.bp1Sys, v.bp1Dia)}
                        </p>
                        {v.bp2Sys != null && (
                          <p className="text-[11px] text-gray-500 tabular-nums">
                            ครั้ง 2: {formatBp(v.bp2Sys, v.bp2Dia)}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  chip,
  color,
  neutralChip = false,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  chip: string;
  color: ColorScheme;
  neutralChip?: boolean;
  trailing?: React.ReactNode;
}) {
  const chipClass = neutralChip
    ? "bg-gray-100 text-gray-600 border-gray-200"
    : color.chip;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${color.glow} ring-1 ${color.ring} shadow-sm p-4`}>
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${color.text}`}>
          {icon}
          {label}
        </span>
        {trailing}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2 tabular-nums">{value}</p>
      <p className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex mt-2 ${chipClass}`}>
        {chip}
      </p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-800 tabular-nums">{value}</span>
    </span>
  );
}

/* ---------- Trend charts (line charts with value labels) ---------- */

type TrendDatum = {
  visitNo: number;
  label: string;
  weightKg: number | null;
  waistCm: number | null;
  sys: number | null;
  dia: number | null;
};

const WAIST_ALERT_CM = 90; // เกณฑ์เตือนรอบเอว (ผู้ใหญ่ไทยทั่วไป — ใช้เป็น visual cue)

/** Format value labels on charts — Recharts v3 passes ReactNode */
function formatLabelValue(value: React.ReactNode): React.ReactNode {
  if (value == null || value === "") return "";
  if (typeof value === "number" || typeof value === "string") return String(value);
  return "";
}

function TrendSection({ sorted }: { sorted: EnrichedVisit[] }) {
  const data: TrendDatum[] = useMemo(
    () =>
      sorted.map((v) => ({
        visitNo: v.visitNo,
        label: `ครั้งที่ ${v.visitNo}`,
        weightKg: v.weightKg != null ? Number(v.weightKg) : null,
        waistCm: v.waistCm != null ? Number(v.waistCm) : null,
        sys: v.bp1Sys != null ? Number(v.bp1Sys) : null,
        dia: v.bp1Dia != null ? Number(v.bp1Dia) : null,
      })),
    [sorted]
  );

  const hasBody = data.some((d) => d.weightKg != null || d.waistCm != null);
  const hasBp = data.some((d) => d.sys != null || d.dia != null);

  const maxWaist = Math.max(0, ...data.map((d) => d.waistCm ?? 0));
  const waistAlert = maxWaist >= WAIST_ALERT_CM;

  if (!hasBody && !hasBp) return null;

  return (
    <div className="rounded-3xl bg-white ring-1 ring-gray-200/70 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 via-white to-white border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> แนวโน้มสำคัญ
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">เส้นแนวโน้มตามครั้งที่มาเรียน</p>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {hasBody && <WeightWaistChart data={data} waistAlert={waistAlert} maxWaist={maxWaist} />}
        {hasBp && <BloodPressureChart data={data} />}
      </div>
    </div>
  );
}

function WeightWaistChart({
  data,
  waistAlert,
  maxWaist,
}: {
  data: TrendDatum[];
  waistAlert: boolean;
  maxWaist: number;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-extrabold text-gray-900">
            1. การเปลี่ยนแปลงของน้ำหนักและรอบเอว
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            หน่วย: น้ำหนัก (กก.) · รอบเอว (ซม.)
          </p>
        </div>
        {waistAlert && (
          <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 text-[11px] font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            รอบเอวสูงสุด {maxWaist} ซม.
          </div>
        )}
      </div>

      <div className="mt-3 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 24, bottom: 8, left: 4 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              width={32}
            >
              <Label value="" position="insideTopLeft" />
            </YAxis>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 14px rgba(15,23,42,0.08)",
                fontSize: 12,
              }}
              formatter={(value: number | string, name: string) => {
                if (name === "น้ำหนัก") return [`${value} กก.`, name];
                if (name === "รอบเอว") return [`${value} ซม.`, name];
                return [value, name];
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="weightKg"
              name="น้ำหนัก"
              stroke="#0d9488"
              strokeWidth={3}
              dot={{ r: 4, fill: "#0d9488", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive
            >
              <LabelList
                dataKey="weightKg"
                position="bottom"
                offset={10}
                style={{ fill: "#0f766e", fontSize: 11, fontWeight: 700 }}
                formatter={formatLabelValue}
              />
            </Line>
            <Line
              type="monotone"
              dataKey="waistCm"
              name="รอบเอว"
              stroke="#ea580c"
              strokeWidth={3}
              dot={{ r: 4, fill: "#ea580c", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive
            >
              <LabelList
                dataKey="waistCm"
                position="top"
                offset={10}
                style={{ fill: "#c2410c", fontSize: 11, fontWeight: 700 }}
                formatter={formatLabelValue}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BloodPressureChart({ data }: { data: TrendDatum[] }) {
  const maxSys = Math.max(0, ...data.map((d) => d.sys ?? 0));
  const highBp = maxSys >= 140;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-extrabold text-gray-900 flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-rose-600" /> 2. แนวโน้มความดันโลหิต
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            เกณฑ์ปกติ: ตัวบน &lt; 120 · ตัวล่าง &lt; 80
          </p>
        </div>
        {highBp && (
          <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 text-[11px] font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            ความดันตัวบนสูงสุด {maxSys}
          </div>
        )}
      </div>

      <div className="mt-3 h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 24, right: 24, bottom: 8, left: 4 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 14px rgba(15,23,42,0.08)",
                fontSize: 12,
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
            />
            <ReferenceLine
              y={120}
              stroke="#fca5a5"
              strokeDasharray="4 4"
              label={{ value: "120", position: "right", fill: "#ef4444", fontSize: 10 }}
            />
            <ReferenceLine
              y={80}
              stroke="#86efac"
              strokeDasharray="4 4"
              label={{ value: "80", position: "right", fill: "#16a34a", fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="sys"
              name="ความดันตัวบน"
              stroke="#ef4444"
              strokeWidth={3}
              strokeDasharray="6 4"
              dot={{ r: 4, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls
            >
              <LabelList
                dataKey="sys"
                position="top"
                offset={10}
                style={{ fill: "#b91c1c", fontSize: 11, fontWeight: 700 }}
                formatter={formatLabelValue}
              />
            </Line>
            <Line
              type="monotone"
              dataKey="dia"
              name="ความดันตัวล่าง"
              stroke="#16a34a"
              strokeWidth={3}
              strokeDasharray="6 4"
              dot={{ r: 4, fill: "#16a34a", stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls
            >
              <LabelList
                dataKey="dia"
                position="bottom"
                offset={10}
                style={{ fill: "#15803d", fontSize: 11, fontWeight: 700 }}
                formatter={formatLabelValue}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
