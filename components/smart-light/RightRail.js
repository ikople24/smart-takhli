import { healthSummary } from "@/lib/smart-light/metrics";
import { SL } from "@/lib/smart-light/theme";
import HealthSummaryCard from "./HealthSummaryCard";
import StatusCards from "./StatusCards";
import OverdueCard from "./OverdueCard";
import GroupHeatmapCard from "./GroupHeatmapCard";

// แถบขวา (เดสก์ท็อป) — รวมการ์ดวิเคราะห์ทั้งหมด ซ่อนบนจอเล็กด้วย className จากหน้าเพจ
export default function RightRail({ summary, poles, groups, filterStatus, filterGroup, onFilterStatus, onSelectPole, onSelectGroup }) {
  const health = healthSummary(groups);
  return (
    <div style={{ width: 388, flex: "0 0 auto", borderLeft: `1px solid ${SL.line}`, background: SL.surface, padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <HealthSummaryCard health={health} />
      <StatusCards summary={summary} filterStatus={filterStatus} onFilter={onFilterStatus} />
      <OverdueCard poles={poles} onSelect={onSelectPole} />
      <GroupHeatmapCard groups={groups} filterGroup={filterGroup} onSelectGroup={onSelectGroup} />
    </div>
  );
}
