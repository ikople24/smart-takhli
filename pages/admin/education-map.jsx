// pages/admin/education-map.jsx
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import EducationSummary from '../../components/education/EducationSummary';
import EducationTable from '../../components/education/EducationTable';

// โหลด MapEducationPoints โดยปิด SSR
const MapEducationPoints = dynamic(() => import('@/components/education/MapEducationPoints'), {
  ssr: false,
});

export default function EducationMapPage() {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    fetch('/api/education/all')
      .then(res => res.json())
      .then(data => setPoints(data));
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">แผนที่ภาพรวมข้อมูลสำรวจทางการศึกษา</h2>
      <EducationSummary data={points} />
      <MapEducationPoints data={points} />
      <EducationTable data={points} onEdit={(item) => console.log('Edit item:', item)} />
    </div>
  );
}