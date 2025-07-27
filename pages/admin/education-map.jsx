// pages/admin/education-map.jsx
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

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
      <h2 className="text-xl font-bold mb-4">แผนที่จุดการลงทะเบียน</h2>
      <MapEducationPoints data={points} />
    </div>
  );
}