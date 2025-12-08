import Image from "next/image";
import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { uploadToCloudinary } from "@/utils/uploadToCloudinary";

const ImageUploads = ({ onChange, onUploadingChange }) => {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // แจ้ง parent component เมื่อสถานะการอัปโหลดเปลี่ยน
  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  const handleFiles = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      if (previews.length >= 3) {
        const confirmReplace = window.confirm("คุณอัปโหลดครบ 3 ภาพแล้ว ต้องการแทนที่ภาพแรกหรือไม่?");
        if (confirmReplace) {
          const file = selectedFiles[0];
          try {
            const cloudUrl = await uploadToCloudinary(file);
            const updatedPreviews = [...previews];
            updatedPreviews[0] = cloudUrl;
            setPreviews(updatedPreviews);
            onChange?.(updatedPreviews);
          } catch (err) {
            console.error("Upload error:", err);
          }
        }
        return;
      }

      const remainingSlots = 3 - previews.length;
      const filesToAdd = selectedFiles.slice(0, remainingSlots);
      const newPreviews = [...previews];
      const newFiles = [...files];

      for (const file of filesToAdd) {
        try {
          const cloudUrl = await uploadToCloudinary(file);
          if (cloudUrl) {
            newPreviews.push(cloudUrl);
            newFiles.push(file);
          }
        } catch (err) {
          console.error("Upload error:", err);
        }
      }

      setPreviews(newPreviews);
      setFiles(newFiles);
      onChange?.(newPreviews);
    } finally {
      setIsUploading(false);
      // Reset input เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้
      e.target.value = '';
    }
  };

  const removeImage = (index) => {
    const newPreviews = [...previews];
    newPreviews.splice(index, 1);
    
    const newFiles = [...files];
    newFiles.splice(index, 1);

    setPreviews(newPreviews);
    setFiles(newFiles);
    onChange?.(newPreviews);
  };

  return (
    <div className="form-control">
      <div className="w-full flex items-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2">
        <label className={`btn btn-sm bg-blue-600 hover:bg-blue-700 text-white border-none ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
              กำลังอัปโหลด...
            </>
          ) : (
            'เลือกรูป'
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
            disabled={isUploading}
          />
        </label>
        <span className="ml-4 text-sm text-gray-600">
          {isUploading 
            ? "กรุณารอสักครู่..." 
            : previews.length > 0 
              ? `${previews.length} ไฟล์ที่อัปโหลดแล้ว` 
              : "ยังไม่ได้แนบรูป"}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        รองรับไฟล์ภาพ .jpg, .png ขนาดไม่เกิน 5MB
      </p>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {previews.map((p, index) => (
            <div key={index} className="relative group">
              <Image
                src={p}
                alt={`preview-${index}`}
                width={300}
                height={96}
                className="w-full h-24 object-cover rounded border border-gray-300 p-1 bg-white shadow-sm"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                disabled={isUploading}
                className={`absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600 transition ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="ลบภาพ"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploads;
