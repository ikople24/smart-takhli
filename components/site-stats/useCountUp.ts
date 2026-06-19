import { useEffect, useRef, useState } from "react";

// นับเลขจากค่าก่อนหน้า → target ด้วย requestAnimationFrame (ease-out)
// re-animate ทุกครั้งที่ target เปลี่ยน (รองรับ online ที่อัปเดตเป็นช่วง)
export function useCountUp(target: number, durationMs = 1200, start = true) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, durationMs]);

  return value;
}
