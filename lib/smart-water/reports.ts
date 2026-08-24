import type { Document } from 'mongodb';
import { pipes } from './db';

export type GroupBy = 'material' | 'road' | 'year' | 'status';

export interface LengthReportOptions {
  groupBy?: GroupBy;
  roadName?: string;
  material?: string;
  includeAbandoned?: boolean;
}

export function buildLengthPipeline(opts: LengthReportOptions): Document[] {
  const match: Document = { deletedAt: null };
  if (!opts.includeAbandoned) match.status = { $ne: 'abandoned' };
  if (opts.roadName) match.roadName = opts.roadName;
  if (opts.material) match.material = opts.material;

  let id: Document;
  switch (opts.groupBy) {
    case 'road':
      id = { roadName: '$roadName' };
      break;
    case 'year':
      id = { installedYear: '$installedYear' };
      break;
    case 'status':
      id = { status: '$status' };
      break;
    default:
      id = {
        material: '$material',
        diameterValue: '$diameter.value',
        unit: '$diameter.unit',
        code: '$code',
      };
  }

  return [
    { $match: match },
    {
      $group: {
        _id: id,
        totalM: { $sum: '$lengthM' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        group: '$_id',
        totalM: { $round: ['$totalM', 2] },
        totalKm: { $round: [{ $divide: ['$totalM', 1000] }, 3] },
        count: 1,
      },
    },
    { $sort: { totalM: -1 } },
  ];
}

export async function runLengthReport(opts: LengthReportOptions) {
  const col = await pipes();
  const rows = await col.aggregate(buildLengthPipeline(opts)).toArray();
  const grandTotalM = rows.reduce((s, r) => s + (r.totalM || 0), 0);
  return {
    rows,
    grandTotalM: Number(grandTotalM.toFixed(2)),
    grandTotalKm: Number((grandTotalM / 1000).toFixed(3)),
    generatedAt: new Date().toISOString(),
  };
}
