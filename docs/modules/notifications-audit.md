# การแจ้งเตือน / Audit log

## แจ้งเตือนในแอป

- หน้า: `/admin/notifications` · กระดิ่ง: `components/NotificationBell.tsx`
- API: `pages/api/notifications/*` · Model: `models/Notification.js`

## Audit log

- หน้า: `/admin/superadmin/audit-log` (superadmin เท่านั้น)
- API: `pages/api/audit/*` · Model: `models/AuditLog.js` · Lib: `lib/auditLogger.ts`

## แจ้งเตือนภายนอก (optional — ไม่ตั้ง env ก็ skip gracefully)

- **LINE OA**: `lib/lineMessaging.ts`, `lib/lineNotify.ts`,
  webhook ขาเข้า `pages/api/integrations/line-webhook.ts`
  - env: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_ID`,
    `LINE_ADMIN_USER_IDS`, `NEXT_PUBLIC_LINE_OA_URL`
- **n8n**: env `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`
- **LIFF**: `lib/liff.ts` (`@line/liff`)
