// แปลงข้อความที่กล้องในหน้าเว็บอ่านได้จาก QR → token บัตรสมาชิก หรือรหัส PS-xxxx
// ใช้ฝั่ง client — ห้าม import memberCode.js/publicToken.js (มี mongoose/crypto)
// ความถูกต้องของ token ให้ API ตรวจอีกชั้น (GET /api/recycle/members?token=)
const TOKEN_IN_LINK = /\/recycle\/m\/([A-Za-z0-9]{12})(?:[/?#]|$)/;
const MEMBER_CODE = /^PS-?(\d{1,6})$/i;

export function parseScannedCard(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const link = s.match(TOKEN_IN_LINK);
  if (link) return { token: link[1] };
  const code = s.match(MEMBER_CODE);
  if (code) return { code: `PS-${code[1].padStart(4, "0")}` };
  return null;
}
