import React, { useState } from 'react';
import CommunitySelector from './CommunitySelector';
import ReporterInput from './ReporterInput';
import ListButtonComplaint from './ListButtonComplaint';

const ComplaintFormModal = ({ selectedLabel, onClose }) => {
  const [selectedCommunity, setSelectedCommunity] = useState('');
  const [prefix, setPrefix] = useState('นาย');
  const [fullName, setFullName] = useState('');

  const handleCommunitySelect = (community) => {
    setSelectedCommunity(community);
  };

  if (!selectedLabel) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center transition-all">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md transform transition-all duration-300 opacity-0 scale-95 animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-semibold text-gray-800">
            ฟอร์มสำหรับ: {selectedLabel}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm"
          >
            ✕
          </button>
        </div>
        <form className="space-y-3">
          <CommunitySelector
            selected={selectedCommunity}
            onSelect={handleCommunitySelect}
          />
          <ListButtonComplaint category={selectedLabel} />
          <ReporterInput
            prefix={prefix}
            setPrefix={setPrefix}
            fullName={fullName}
            setFullName={setFullName}
          />
        <div className="flex mb-4 gap-2">
          <button type="clear" className="bg-gray-100 text-black px-4 py-2 rounded">
            ยกเลิก
          </button>
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            ส่งเรื่อง
          </button>
        </div>
        </form>
      </div>
    </div>
  );
};

export default ComplaintFormModal;