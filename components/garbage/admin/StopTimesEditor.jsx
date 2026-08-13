import { formatThaiTime, parseThaiTime } from '@/lib/garbage/time';
import { distributeStopTimes } from '@/lib/garbage/stopEditing';
import { labelCls, ghostBtnCls } from '@/components/ui/adminTheme';

/**
 * ตั้งเวลารายจุดของงาน — value เป็นอาเรย์ { seq, atMin } เฉพาะจุดที่มีเวลา
 * ปุ่ม "กระจายเวลาเท่ากัน" จำเป็นเพราะสาย R1 มี 22 จุด กรอกมือทีละช่องคือทรมาน
 */
export default function StopTimesEditor({ route, value, onChange, startMin, endMin }) {
  const bySeq = new Map(value.map((v) => [v.seq, v.atMin]));

  const setOne = (seq, text) => {
    const min = parseThaiTime(text);
    const next = value.filter((v) => v.seq !== seq);
    if (min != null) next.push({ seq, atMin: min });
    next.sort((a, b) => a.seq - b.seq);
    onChange(next);
  };

  const spread = () => {
    if (startMin == null || endMin == null) return;
    onChange(distributeStopTimes(route.stops.length, startMin, endMin));
  };

  return (
    <div className="rounded-[14px] border border-[#E7E2F2] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={labelCls + ' mb-0'}>เวลาถึงแต่ละจุด ({route.stops.length} จุด)</span>
        <button type="button" className={ghostBtnCls} onClick={spread}
          disabled={startMin == null || endMin == null}
          title={startMin == null || endMin == null ? 'ต้องกรอกเวลาเริ่มและสิ้นสุดก่อน' : ''}>
          กระจายเวลาเท่ากัน
        </button>
      </div>
      <p className="text-[11.5px] text-[#8A8398]">
        เว้นว่างได้ถ้ายังไม่ทราบเวลา — จุดที่ไม่มีเวลาจะแสดงเป็น &ldquo;—&rdquo; บนหน้าประชาชน
      </p>
      <ol className="space-y-1 max-h-64 overflow-y-auto">
        {route.stops.map((s) => (
          <li key={s.seq} className="flex items-center gap-2">
            <span className="w-6 text-right text-[12px] text-[#8A8398]">{s.seq}.</span>
            <span className="flex-1 text-[12.5px] truncate" title={s.name}>{s.name}</span>
            <input
              className="w-24 rounded-[10px] border border-[#E7E2F2] px-2 py-1 text-[12.5px]"
              placeholder="4.00"
              aria-label={`เวลาถึง ${s.name}`}
              defaultValue={bySeq.has(s.seq) ? formatThaiTime(bySeq.get(s.seq)).replace(' น.', '') : ''}
              key={`${s.seq}-${bySeq.get(s.seq) ?? 'empty'}`}
              onBlur={(e) => setOne(s.seq, e.target.value)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
