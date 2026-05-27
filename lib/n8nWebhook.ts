// lib/n8nWebhook.ts
// ส่ง event data ไปยัง n8n instance ผ่าน Webhook node
// Phase 2: n8n Integration
//
// ENV vars ที่ต้องตั้งใน .env.local:
//   N8N_WEBHOOK_URL      — URL ของ n8n Webhook node (เช่น https://n8n.example.com/webhook/smart-takhli)
//   N8N_WEBHOOK_SECRET   — secret สำหรับ authenticate request (ใส่ใน n8n Webhook auth header)
//
// ตัวอย่าง n8n workflow:
//   Webhook → Switch (by event) → ส่ง LINE / email / Slack / บันทึก Google Sheet

const N8N_URL = process.env.N8N_WEBHOOK_URL || '';
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET || '';

// ---------- Event types ----------

export type N8nEvent =
  | 'complaint.created'
  | 'complaint.status_changed'
  | 'complaint.assigned'
  | 'assignment.completed'
  | 'satisfaction.submitted'
  | 'user.registered';

export interface N8nPayload<T = unknown> {
  event: N8nEvent;
  appId: string;
  timestamp: string;
  data: T;
}

// ---------- Complaint payloads ----------

export interface ComplaintCreatedData {
  complaintId: string;
  fullName: string;
  category: string;
  detail: string;
  community?: string;
  location?: { lat: number; lng: number };
}

export interface ComplaintStatusChangedData {
  complaintId: string;
  fullName: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
}

export interface ComplaintAssignedData {
  complaintId: string;
  officerName: string;
  officerId: string;
  assignedAt: string;
}

export interface AssignmentCompletedData {
  assignmentId: string;
  complaintId: string;
  officerName: string;
  completedAt: string;
  resolutionDays: number;
}

export interface SatisfactionSubmittedData {
  complaintId: string;
  rating: number;
  comment?: string;
}

// ---------- Core trigger function ----------

/**
 * ส่ง event ไปยัง n8n webhook
 * — fire-and-forget: ถ้าล้มเหลวจะ log และ return false (ไม่โยน error)
 * — ถ้า N8N_WEBHOOK_URL ไม่ได้ตั้งค่า จะ skip อัตโนมัติ
 */
export async function triggerN8n<T>(
  event: N8nEvent,
  data: T
): Promise<boolean> {
  if (!N8N_URL) {
    // ไม่ได้ configure — skip gracefully
    return false;
  }

  const payload: N8nPayload<T> = {
    event,
    appId: process.env.NEXT_PUBLIC_APP_ID || 'smart-takhli',
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    const res = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_SECRET ? { 'x-webhook-secret': N8N_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      // timeout ไม่เกิน 5 วินาที ไม่อยากให้ block API response
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`[n8n] Webhook failed: ${res.status} ${await res.text()}`);
      return false;
    }

    console.log(`[n8n] Event "${event}" sent successfully`);
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      console.warn(`[n8n] Webhook timed out for event "${event}"`);
    } else {
      console.error(`[n8n] Webhook error for event "${event}":`, err);
    }
    return false;
  }
}

// ---------- Convenience wrappers ----------

export const n8n = {
  complaintCreated: (data: ComplaintCreatedData) =>
    triggerN8n('complaint.created', data),

  complaintStatusChanged: (data: ComplaintStatusChangedData) =>
    triggerN8n('complaint.status_changed', data),

  complaintAssigned: (data: ComplaintAssignedData) =>
    triggerN8n('complaint.assigned', data),

  assignmentCompleted: (data: AssignmentCompletedData) =>
    triggerN8n('assignment.completed', data),

  satisfactionSubmitted: (data: SatisfactionSubmittedData) =>
    triggerN8n('satisfaction.submitted', data),
};
