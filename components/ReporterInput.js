import React from "react";

const ReporterInput = ({
  prefix,
  setPrefix,
  fullName,
  setFullName,
  address,
  setAddress,
}) => {
  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-medium text-gray-800">ผู้แจ้ง</label>
      <div className="flex gap-2">
        <select
          className="select select-bordered bg-blue-100 text-blue-900 border-blue-300 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        >
          <option value="นาย" className="text-blue-700">
            นาย
          </option>
          <option value="นาง" className="text-blue-700">
            นาง
          </option>
          <option value="น.ส." className="text-blue-700">
            น.ส.
          </option>
        </select>
        <input
          type="text"
          className="input input-bordered flex-1 bg-blue-50 text-blue-900 border-blue-300 placeholder:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="ชื่อ-นามสกุล"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="flex flex-col space-y-2 mt-2">
        <label className="text-sm font-medium text-gray-800">ที่อยู่</label>
        <textarea
          className="textarea w-full bg-blue-50 text-blue-900 border-blue-300 placeholder:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="ระบุที่อยู่"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        ></textarea>
      </div>
      
    </div>
  );
};

export default ReporterInput;
