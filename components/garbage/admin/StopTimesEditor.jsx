import { formatThaiTime, parseThaiTime } from '@/lib/garbage/time';
import { distributeStopTimes } from '@/lib/garbage/stopEditing';
import { labelCls, ghostBtnCls } from '@/components/ui/adminTheme';

/**
 * ตั้งเวลารายจุดของงาน — value เป็นอาเรย์ { seq, atMin } ของ "จุดที่เก็บในวันนี้"
 * อยู่ในลิสต์ = เก็บ · ไม่อยู่ = ไม่เก็บ · อยู่แต่ atMin เป็น null = เก็บแต่ยังไม่ระบุเวลา
 * ปุ่ม "กระจายเวลาเท่ากัน" จำเป็นเพราะสาย R1 มี 22 จุด กรอกมือทีละช่องคือทรมาน
 */
export default function StopTimesEditor({ route, value, onChange, startMin, endMin }) {
  const bySeq = new Map(value.map((v) => [v.seq, v.atMin]));

  const toggleServed = (seq, on) => {
    const next = value.filter((v) => v.seq !== seq);
    if (on) next.push({ seq, atMin: null });
    next.sort((a, b) => a.seq - b.seq);
    onChange(next);
  };

  const setOne = (seq, text) => {
    const min = parseThaiTime(text);
    const next = value.filter((v) => v.seq !== seq);
    // ยังเก็บอยู่แม้ล้างเวลา — ต่างจาก "ไม่เก็บ" ที่ต้องเอาติ๊กออก
    next.push({ seq, atMin: min });
    next.sort((a, b) => a.seq - b.seq);
    onChange(next);
  };

  const spread = () => {
    if (startMin == null || endMin == null) return;
    // กระจายให้เฉพาะจุดที่ติ๊กว่าเก็บ ไม่ใช่ทุกจุดของสาย
    const served = value.map((v) => v.seq).sort((a, b) => a - b);
    if (served.length === 0) return;
    const times = distributeStopTimes(served.length, startMin, endMin);
    // ช่วงเวลาถอยหลัง (สิ้นสุดก่อนเริ่ม) ทำให้ distributeStopTimes คืนอาเรย์ว่าง — อย่าไปอ่าน index
    if (times.length !== served.length) return;
    onChange(served.map((seq, i) => ({ seq, atMin: times[i].atMin })));
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
        ติ๊กเฉพาะจุดที่เก็บในวันนี้ · เว้นช่องเวลาไว้ได้ถ้ายังไม่ทราบ (จะขึ้นว่า &ldquo;ยังไม่ระบุเวลา&rdquo;)
      </p>
      <ol className="space-y-1 max-h-64 overflow-y-auto">
        {route.stops.map((s) => (
          <li key={s.seq} className="flex items-center gap-2">
            <input type="checkbox" checked={bySeq.has(s.seq)}
              aria-label={`เก็บ ${s.name} ในวันนี้`}
              onChange={(e) => toggleServed(s.seq, e.target.checked)} />
            <span className="w-6 text-right text-[12px] text-[#8A8398]">{s.seq}.</span>
            <span className="flex-1 text-[12.5px] truncate" title={s.name}>{s.name}</span>
            <input
              className="w-24 rounded-[10px] border border-[#E7E2F2] px-2 py-1 text-[12.5px] disabled:bg-[#F1F1F4]"
              placeholder={bySeq.has(s.seq) ? '4.00' : 'ไม่เก็บ'}
              disabled={!bySeq.has(s.seq)}
              aria-label={`เวลาถึง ${s.name}`}
              defaultValue={bySeq.get(s.seq) != null ? formatThaiTime(bySeq.get(s.seq)).replace(' น.', '') : ''}
              key={`${s.seq}-${bySeq.get(s.seq) ?? 'empty'}-${bySeq.has(s.seq)}`}
              onBlur={(e) => setOne(s.seq, e.target.value)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
