import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { uploadToCloudinary } from "@/utils/uploadToCloudinary";

const ImageUploads = ({ onChange }) => {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const handleFiles = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    const combinedFiles = [...files, ...selectedFiles].slice(0, 3);
    setFiles(combinedFiles);

    const newPreviews = [];
    const uploadedUrls = [];

    for (const file of combinedFiles) {
      const previewUrl = URL.createObjectURL(file);
      newPreviews.push({ file, url: previewUrl });

      try {
        const cloudUrl = await uploadToCloudinary(file);
        uploadedUrls.push(cloudUrl);
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    setPreviews(newPreviews);
    onChange?.(uploadedUrls);
  };

  const removeImage = (index) => {
    const newPreviews = [...previews];
    const newFiles = [...files];

    URL.revokeObjectURL(previews[index].url);
    newPreviews.splice(index, 1);
    newFiles.splice(index, 1);

    setPreviews(newPreviews);
    setFiles(newFiles);
    onChange?.(newFiles);
  };

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text text-sm font-medium text-gray-800">
          แนบรูปภาพ (หลายภาพได้)
        </span>
      </label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="file-input file-input-info bg-blue-50 text-blue-900 w-full"
      />
      <p className="text-xs text-gray-500 mt-1">
        รองรับไฟล์ภาพ .jpg, .png ขนาดไม่เกิน 5MB
      </p>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {previews.map((p, index) => (
            <div key={index} className="relative group">
              <img
                src={p.url}
                alt={`preview-${index}`}
                className="w-full h-24 object-cover rounded border"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-600 transition"
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
