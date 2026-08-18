// components/citizen/home/Sparkline.tsx
// เส้นแนวโน้มจิ๋วสำหรับการ์ดสถิติ — เส้น 2px + จุดปลายที่ค่าล่าสุด (วงแหวนขาว)
// จุดปลายวาดเป็น HTML overlay เพราะ svg ถูกยืดด้วย preserveAspectRatio="none"
// (ถ้าวาด circle ใน svg จะถูกยืดเป็นวงรี)
const W = 100;
const H = 28;
const PAD = 4;

export default function Sparkline({
  points,
  color,
  className = "",
  label,
}: {
  points: number[];
  color: string;
  className?: string;
  label?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (points.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - 2 * PAD);
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  const lastY = y(points[points.length - 1]);

  return (
    <div className={`relative ${className}`} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white"
        style={{ background: color, right: `${(PAD / W) * 100}%`, top: `${(lastY / H) * 100}%` }}
      />
    </div>
  );
}
