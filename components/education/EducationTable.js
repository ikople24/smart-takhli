import React from 'react';
import Image from 'next/image';
import { FaEdit } from 'react-icons/fa';

export default function EducationTable({ data, onEdit }) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-2 font-semibold text-gray-700">ข้อมูลผู้ขอรับสิทธิ</div>
      <ul role="list" className="divide-y divide-gray-200">
        {data.map((item) => (
          <li key={item._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <div className="flex items-center gap-4">
              <Image
                className="h-12 w-12 rounded-full object-cover border"
                src={item.imageUrl?.[0] || '/default-avatar.png'}
                alt={item.name || 'avatar'}
                width={48}
                height={48}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{`${item.prefix || ''}${item.name}`}</p>
                <p className="text-xs text-gray-500">{item.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(item)}
                className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition"
              >
                <FaEdit />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}