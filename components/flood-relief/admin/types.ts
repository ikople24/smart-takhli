// components/flood-relief/admin/types.ts — รูปข้อมูลจาก API แอดมิน (lib/flood-relief/adminView.ts)
export type AdminRequest = {
  id: string;
  ticket: string;
  type: string;
  urgency: string;
  status: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  landmark: string;
  peopleCount: number | null;
  reporterName: string;
  phone: string;
  communityName: string | null;
  zoneId: string | null;
  zoneName: string | null;
  zoneLevel: string | null;
  zoneLabel: string | null;
  assignedTeamId: string | null;
  assignedAt: string | null;
  dispatchedAt: string | null;
  onSiteAt: string | null;
  doneAt: string | null;
  cancelledAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  waitingMinutes: number;
  isOverdue: boolean;
  lineLinked: boolean;
};

export type AdminRequestDetail = AdminRequest & {
  detail: string;
  images: string[];
  notes: Array<{ by: string; at: string; text: string }>;
  timeline: Array<{ at: string; event: string; by: string }>;
};

export type FloodKpi = {
  criticalPending: number;
  newUnassigned: number;
  inProgress: number;
  doneToday: number;
  avgMinutesToSite: number | null;
  teamsBusy: number;
  teamsTotal: number;
};

export type AdminTeam = {
  id: string;
  name: string;
  department: string;
  equipment: string;
  status: "idle" | "busy";
  lat: number | null;
  lng: number | null;
  distanceKm: number | null;
};

export type Me = { name: string; canRewind: boolean; isSuperAdmin: boolean };
