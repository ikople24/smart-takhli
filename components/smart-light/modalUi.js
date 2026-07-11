// เปลือกโมดัล + สไตล์ฟิลด์ร่วม ธีมม่วง — ให้ทุกฟอร์ม smart-light หน้าตาตรงบรีฟชุดเดียวกัน
// (อ้างอิง mockup "Smart Light.dc.html" — modal เพิ่มเสา/บันทึกสภาพ)
// เป็น presentational ล้วน ไม่มี logic ธุรกิจ — ฟอร์มแต่ละตัวส่ง handler/ปุ่มเข้ามาเอง
import { SL, SL_FONT_HEAD, SL_FONT_BODY } from "@/lib/smart-light/theme";

// label ของฟิลด์ (700 12px)
export const slLabel = {
  display: "block",
  font: `700 12px ${SL_FONT_BODY}`,
  color: SL.ink2,
  marginBottom: 6,
};

// input / select / textarea (ขอบ 1.5px, มุม 14)
export const slField = {
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  border: `1.5px solid ${SL.line}`,
  borderRadius: 14,
  padding: "11px 13px",
  font: `500 14px ${SL_FONT_BODY}`,
  color: SL.ink,
  outline: "none",
};

// กล่องอัปโหลดรูปเส้นประ
export const slDashed = {
  border: "1.5px dashed #DDD2FB",
  background: "#fff",
  borderRadius: 14,
  padding: "18px 14px",
  textAlign: "center",
  color: SL.ink2,
};

// ปุ่มยกเลิก (pill สีม่วงอ่อน)
export function SLCancelButton({ onClick, disabled, children = "ยกเลิก" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        cursor: disabled ? "default" : "pointer",
        background: SL.soft2,
        color: SL.primary,
        font: `700 13.5px ${SL_FONT_BODY}`,
        padding: "12px 22px",
        borderRadius: 16,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

// ปุ่มหลัก (ยืนยัน/บันทึก) — สีปรับได้ (เขียวเพิ่มเสา / ม่วงบันทึก)
export function SLPrimaryButton({ onClick, disabled, color = SL.primary, children }) {
  const shadowColor = color === "#16A34A" ? "rgba(22,163,74,.5)" : "rgba(124,58,237,.55)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 0,
        cursor: disabled ? "default" : "pointer",
        background: color,
        color: "#fff",
        font: `700 13.5px ${SL_FONT_BODY}`,
        padding: "12px 26px",
        borderRadius: 16,
        boxShadow: `0 12px 24px -10px ${shadowColor}`,
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

// เปลือกโมดัล: backdrop + กล่องพื้นผิวม่วงอ่อน + หัวม่วง (ไอคอน/หัวข้อ/คำโปรย/ปุ่ม ✕) + เนื้อหา + ฟุตเตอร์
// คง DaisyUI `modal modal-bottom sm:modal-middle` ไว้เพื่อพฤติกรรม bottom-sheet บนมือถือ
export function SLModalShell({
  icon,
  title,
  subtitle,
  onClose,
  disabled,
  maxWidth,
  bodyGap = 16,
  children,
  footer,
}) {
  const guardedClose = disabled ? undefined : onClose;
  return (
    <div className="modal modal-open modal-bottom sm:modal-middle" role="dialog">
      <div
        className="modal-box p-0 overflow-hidden flex flex-col"
        style={{ background: SL.surface, borderRadius: 26, maxWidth, maxHeight: "90vh" }}
      >
        {/* หัวม่วง */}
        <div
          style={{
            flex: "0 0 auto",
            background: SL.primary,
            color: "#fff",
            padding: "18px 22px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ font: `700 20px ${SL_FONT_HEAD}` }}>
              {icon ? `${icon} ` : ""}
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.85)", marginTop: 3 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={guardedClose}
            style={{
              flex: "0 0 auto",
              border: 0,
              cursor: disabled ? "default" : "pointer",
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background: "rgba(255,255,255,.15)",
              color: "#fff",
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* เนื้อหา */}
        <div
          style={{
            padding: "20px 22px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: bodyGap,
          }}
        >
          {children}
        </div>

        {/* ฟุตเตอร์ */}
        {footer && (
          <div
            style={{
              flex: "0 0 auto",
              padding: "14px 22px",
              borderTop: `1px solid ${SL.line}`,
              background: SL.surface,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            {footer}
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={guardedClose} />
    </div>
  );
}
