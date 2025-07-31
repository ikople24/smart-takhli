// components/education/EducationSummary.js
import React from 'react';
import { FaBaby, FaSchool, FaUniversity, FaUserGraduate, FaQuestion } from 'react-icons/fa';

export default function EducationSummary({ data }) {
  const summary = data.reduce((acc, curr) => {
    const level = curr.educationLevel || 'ไม่ระบุ';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  const levelInfo = {
    'อนุบาล': { icon: <FaBaby className="text-pink-500 text-xl" />, order: 1 },
    'ประถม': { icon: <FaSchool className="text-yellow-500 text-xl" />, order: 2 },
    'มัธยมต้น': { icon: <FaSchool className="text-green-500 text-xl" />, order: 3 },
    'มัธยมปลาย': { icon: <FaSchool className="text-blue-500 text-xl" />, order: 4 },
    'ปวช.': { icon: <FaUserGraduate className="text-indigo-500 text-xl" />, order: 5 },
    'ปวส.': { icon: <FaUserGraduate className="text-purple-500 text-xl" />, order: 6 },
    'ปริญญาตรี': { icon: <FaUniversity className="text-red-500 text-xl" />, order: 7 },
    'ไม่ระบุ': { icon: <FaQuestion className="text-gray-500 text-xl" />, order: 8 },
  };

  const sortedLevels = Object.entries(summary).sort(
    ([a], [b]) => (levelInfo[a]?.order || 99) - (levelInfo[b]?.order || 99)
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
      {sortedLevels.map(([level, count], index) => (
        <div
          key={index}
          className="flex flex-col items-center justify-center border-2 border-blue-200 rounded-xl shadow-sm py-2 px-1 text-center bg-white text-xs"
        >
          <div>{levelInfo[level]?.icon}</div>
          <div className="text-gray-600 mt-1">{level}</div>
          <div className="font-semibold text-blue-600">{count} ราย</div>
        </div>
      ))}
    </div>
  );
}