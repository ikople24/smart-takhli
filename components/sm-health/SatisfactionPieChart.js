import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'รถเข็น', value: 18 },
  { name: 'เตียง', value: 6 },
  { name: 'วอล์คเกอร์ (สี่ขา)', value: 6 },
  { name: 'ไม้เท้าสามขา', value: 30 },
  { name: 'สามล้อโยกมือ', value: 12 },
];

const COLORS = ['#1E40AF', '#A855F7', '#EA580C', '#22C55E', '#0EA5E9'];

export default function SatisfactionPieChart() {

  const renderCustomizedLabel = ({ percent }) => `${(percent * 100).toFixed(0)}%`;

  return (
    <div className="w-full min-h-[28rem] p-4 rounded-xl shadow bg-white overflow-hidden mt-2 mb-2">
      <h2 className="text-center text-xl font-semibold mb-4">ความพึงพอใจแยกประเภท</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            labelLine={false}
            label={renderCustomizedLabel}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} คะแนน`} />
          <Legend formatter={(value, entry, index) => `${value} ${data[index].value} คะแนน`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
