// bottom-sheet รายละเอียดเสา — เปิดเมื่อแตะหมุด แสดงข้อมูลเต็ม + ประวัติสำรวจ
// มือถือ: modal ชิดล่าง / จอใหญ่: กลางจอ (DaisyUI modal-bottom sm:modal-middle)
import Image from "next/image";
import { POLE_STATUS, LAMP_TYPE } from "@/lib/smart-light/constants";
import { googleMapsDirectionsUrl } from "@/lib/smart-light/geo";
import { SL, SL_FONT_HEAD } from "@/lib/smart-light/theme";

function formatThaiDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }) {
  const s = POLE_STATUS[status] || POLE_STATUS.unknown;
  return (
    <span
      className="badge text-white border-0"
      style={{ backgroundColor: s.color }}
    >
      {s.label}
    </span>
  );
}

export default function PoleBottomSheet({ pole, loading, onClose, onSurvey, onEdit }) {
  if (!pole) return null;
  return (
    <div
      role="dialog"
      className="fixed z-[1000] inset-x-0 bottom-0 lg:inset-auto lg:left-4 lg:bottom-4 lg:w-80"
      style={{
        background: "#fff",
        border: `1px solid ${SL.line}`,
        borderRadius: 22,
        boxShadow: "0 26px 54px -26px rgba(33,27,46,.55)",
        padding: 16,
        maxHeight: "70vh",
        overflowY: "auto",
      }}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 style={{ font: `800 16px ${SL_FONT_HEAD}`, color: SL.ink }}>{pole.code}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
              <span
                className="badge border-0"
                style={{ background: SL.soft2, color: SL.primaryDark }}
              >
                🏘️ {pole.group}
              </span>
              <StatusBadge status={pole.status} />
              <span style={{ color: SL.muted }}>
                {(LAMP_TYPE[pole.lampType] || LAMP_TYPE.unknown).label}
              </span>
            </div>
          </div>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
        </div>

        {pole.photoUrl && (
          <div className="mt-3">
            <Image
              src={pole.photoUrl}
              alt={`รูปเสา ${pole.code}`}
              width={640}
              height={360}
              className="rounded-lg w-full h-40 object-cover"
            />
          </div>
        )}

        <div className="mt-3 space-y-1 text-sm text-gray-600">
          {pole.note && <p>📝 {pole.note}</p>}
          <p>
            🕐 สำรวจล่าสุด: {formatThaiDateTime(pole.lastSurveyedAt)}
            {pole.lastSurveyedBy ? ` โดย ${pole.lastSurveyedBy}` : ""}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            className="btn border-0"
            style={{ background: SL.primary, color: "#fff" }}
            onClick={() => onSurvey(pole)}
          >
            🔦 บันทึกสภาพ
          </button>
          <button
            className="btn"
            style={{ border: `1px solid ${SL.line}`, background: "#fff", color: SL.ink2 }}
            onClick={() => onEdit(pole)}
          >
            ✏️ แก้ไขข้อมูล
          </button>
          <a
            className="btn"
            style={{ border: `1px solid ${SL.line}`, background: "#fff", color: SL.ink2 }}
            href={googleMapsDirectionsUrl(pole.lat, pole.lng)}
            target="_blank"
            rel="noopener noreferrer"
          >
            🧭 นำทาง
          </a>
        </div>

        {/* ประวัติสำรวจ (โหลดเต็มจาก GET /poles/:id) */}
        <div className="mt-4">
          <p className="font-semibold text-sm mb-2">ประวัติการสำรวจ</p>
          {loading ? (
            <p className="text-sm text-gray-400">กำลังโหลด…</p>
          ) : !pole.surveys || pole.surveys.length === 0 ? (
            <p className="text-sm text-gray-400">ยังไม่มีประวัติสำรวจ</p>
          ) : (
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {[...pole.surveys].reverse().map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-sm border-b border-gray-100 pb-2">
                  <StatusBadge status={s.status} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{s.note || "-"}</p>
                    <p className="text-xs text-gray-400">
                      {formatThaiDateTime(s.surveyedAt)} · {s.surveyedBy || "-"}
                    </p>
                  </div>
                  {s.photoUrl && (
                    <a href={s.photoUrl} target="_blank" rel="noopener noreferrer">
                      <Image
                        src={s.photoUrl}
                        alt="รูปสำรวจ"
                        width={48}
                        height={48}
                        className="rounded object-cover w-12 h-12"
                      />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
