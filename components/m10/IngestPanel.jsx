import { useState } from "react";

const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const now = new Date();
const CUR_BE = now.getFullYear() + 543;
const CUR_MONTH = now.getMonth() + 1; // 1-12
// ปีย้อนหลัง 4 ปี ถึงปีปัจจุบัน (พ.ศ.)
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CUR_BE - i);

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * อัปโหลดด้วย XMLHttpRequest ไม่ใช่ fetch — fetch อ่านความคืบหน้าขาส่งไม่ได้ในเบราว์เซอร์
 * (มีแต่ขาดาวน์โหลด) ส่วน xhr.upload.onprogress ให้ไบต์ที่ส่งไปแล้วจริง ๆ
 */
function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* เซิร์ฟเวอร์ไม่ได้ตอบ JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `อัปโหลดล้มเหลว (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"));
    xhr.ontimeout = () => reject(new Error("หมดเวลาเชื่อมต่อ"));
    xhr.send(formData);
  });
}

export default function IngestPanel() {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [year, setYear] = useState(CUR_BE);
  const [month, setMonth] = useState(CUR_MONTH);
  const [phase, setPhase] = useState("idle"); // idle | uploading | processing
  const [sent, setSent] = useState(0);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const period = `${year}-${String(month).padStart(2, "0")}`;
  const busy = phase !== "idle";
  const percent = total > 0 ? Math.round((sent / total) * 100) : 0;

  async function handleUpload(e) {
    e.preventDefault();
    setError(""); setResult(null);
    if (!file) { setError("กรุณาเลือกไฟล์ ZIP"); return; }

    setPhase("uploading"); setSent(0); setTotal(file.size);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("period", period);
      if (password) fd.append("password", password);

      const data = await uploadWithProgress("/api/m10-ingest/upload", fd, (loaded, size) => {
        setSent(loaded); setTotal(size);
        // ส่งครบแล้วแต่ยังไม่ตอบกลับ = เซิร์ฟเวอร์กำลังแตกไฟล์/ประมวลผล ซึ่งวัดเป็น % ไม่ได้
        if (loaded >= size) setPhase("processing");
      });
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setPhase("idle"); }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-4">นำเข้าข้อมูลมาตรา 10 (รายเดือน)</h2>
      <form onSubmit={handleUpload} className="card bg-base-100 shadow p-4 space-y-4">
        <div>
          <label className="label"><span className="label-text">เดือนของข้อมูล</span></label>
          <div className="flex gap-2 items-center">
            <select className="select select-bordered" value={month} disabled={busy} onChange={(e) => setMonth(Number(e.target.value))}>
              {TH_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="select select-bordered w-32" value={year} disabled={busy} onChange={(e) => setYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>พ.ศ. {y}</option>)}
            </select>
            <span className="text-xs opacity-50 font-mono">({period})</span>
          </div>
        </div>
        <div>
          <label className="label"><span className="label-text">ไฟล์ ZIP จากกรมที่ดิน</span></label>
          <input
            type="file"
            accept=".zip"
            disabled={busy}
            className="file-input file-input-bordered w-full"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(""); }}
          />
          <p className="text-xs opacity-60 mt-1">
            อัปโหลดไฟล์ต้นฉบับได้เลยไม่ต้องแตกไฟล์ — <strong>ห้ามแก้ชื่อหัวคอลัมน์</strong> เพราะระบบอ่านตามชื่อในไฟล์ดิบ
            {file && <> · ขนาดไฟล์ {mb(file.size)}</>}
          </p>
        </div>
        <div>
          <label className="label"><span className="label-text">รหัสเปิดไฟล์ (ถ้าไฟล์ใส่รหัสไว้)</span></label>
          <input
            type="password"
            autoComplete="off"
            disabled={busy}
            className="input input-bordered w-full"
            placeholder="เว้นว่างถ้าไฟล์ไม่ได้ใส่รหัส"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {busy && (
          <div className="space-y-1">
            <progress
              className={`progress w-full ${phase === "processing" ? "progress-warning" : "progress-primary"}`}
              /* ช่วงประมวลผลไม่รู้ความคืบหน้า → ปล่อยเป็นแถบวิ่ง (ไม่ใส่ value) */
              {...(phase === "uploading" ? { value: percent, max: 100 } : {})}
            />
            <p className="text-sm">
              {phase === "uploading"
                ? <>กำลังอัปโหลด <strong>{percent}%</strong> <span className="opacity-60">({mb(sent)} / {mb(total)})</span></>
                : <>อัปโหลดครบแล้ว — <strong>กำลังแตกไฟล์และประมวลผลบนเซิร์ฟเวอร์</strong> <span className="opacity-60">(ขั้นนี้บอกเปอร์เซ็นต์ไม่ได้ อย่าปิดหน้านี้)</span></>}
            </p>
          </div>
        )}

        <button className="btn btn-primary" disabled={busy}>
          {phase === "uploading" ? `กำลังอัปโหลด ${percent}%` : phase === "processing" ? "กำลังประมวลผล..." : "อัปโหลดและประมวลผล"}
        </button>
      </form>
      {error && <div className="alert alert-error mt-4">{error}</div>}
      {result && result.skipped && (
        <div className="alert alert-info mt-4">เดือนนี้ (ไฟล์นี้) นำเข้าแล้ว — ไม่มีการเปลี่ยนแปลง</div>
      )}
      {result && !result.skipped && (
        <div className="mt-4 space-y-3">
          <div className="stats shadow w-full">
            <div className="stat"><div className="stat-title">Transactions</div><div className="stat-value text-primary">{result.counts.transactions}</div></div>
            <div className="stat"><div className="stat-title">Geometry matched</div><div className="stat-value">{result.counts.geometryMatched}</div></div>
            <div className="stat"><div className="stat-title">Quarantine</div><div className="stat-value text-warning">{result.counts.rejects}</div></div>
          </div>
          <p className="text-sm opacity-70">รายการที่กระทบกรรมสิทธิ์รอการยืนยันที่แท็บ &quot;คิวยืนยัน&quot;</p>
        </div>
      )}
    </div>
  );
}
