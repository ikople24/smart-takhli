import { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const ReporterInfoMap = dynamic(() => import('./ReporterInfoMap'), { ssr: false });

export default function ComplaintDetailModal({ complaint, isOpen, onClose, assignments, menu, assignedUsers, onOpenUpdateModal }) {
  const [assignment, setAssignment] = useState(null);
  const [reporterInfo, setReporterInfo] = useState(null);
  const [assignedUser, setAssignedUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (complaint && isOpen) {
      // Find assignment for this complaint
      const foundAssignment = assignments?.find(a => a.complaintId === complaint._id);
      setAssignment(foundAssignment || null);

      // Fetch reporter info
      if (complaint._id) {
        setLoading(true);
        fetch(`/api/submittedreports/personal-info/${complaint._id}`)
          .then(res => res.json())
          .then(data => {
            setReporterInfo(data);
            setLoading(false);
          })
          .catch(err => {
            console.error("Error fetching reporter info:", err);
            setLoading(false);
          });
      }

      // Get assigned user info from props if available
      if (foundAssignment?.userId && assignedUsers) {
        const user = assignedUsers[foundAssignment.userId];
        if (user) {
          setAssignedUser(user);
        } else {
          // Fallback to API call if not in props
          fetch(`/api/users/get-by-id?userId=${foundAssignment.userId}`)
            .then(res => res.json())
            .then(data => {
              if (data.success && data.user) {
                setAssignedUser(data.user);
              }
            })
            .catch(err => {
              console.error("Error fetching assigned user:", err);
            });
        }
      }
    }
  }, [complaint, isOpen, assignments, assignedUsers]);

  if (!isOpen || !complaint) return null;

  const getStatusBadge = (status) => {
    const statusConfig = {
      "อยู่ระหว่างดำเนินการ": { color: "badge-warning", text: "กำลังดำเนินการ" },
      "ดำเนินการเสร็จสิ้น": { color: "badge-success", text: "เสร็จสิ้น" },
      "รอการมอบหมาย": { color: "badge-info", text: "รอการมอบหมาย" }
    };
    
    const config = statusConfig[status] || { color: "badge-neutral", text: status };
    return <span className={`badge ${config.color}`}>{config.text}</span>;
  };

  const getCategoryIcon = (category) => {
    return menu?.find(m => m.Prob_name === category)?.Prob_pic || null;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'ไม่ระบุ';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'ไม่ระบุ';
    
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysSinceUpdate = (updatedAt) => {
    const days = Math.floor((new Date() - new Date(updatedAt)) / (1000 * 60 * 60 * 24));
    if (days === 0) return "วันนี้";
    if (days === 1) return "เมื่อวาน";
    return `${days} วันที่แล้ว`;
  };

  const isValidImageUrl = (url) => {
    if (!url) return false;
    return url.startsWith('http') || url.startsWith('/');
  };

  // ฟังก์ชันซ่อนนามสกุลของเจ้าหน้าที่
  const hideLastName = (fullName) => {
    if (!fullName) return 'ไม่ระบุ';
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length <= 1) {
      // ถ้ามีแค่ชื่อเดียว ให้แสดงชื่อเดิม
      return fullName;
    }
    // แสดงชื่อตัว + xxxxxx แทนนามสกุล
    return nameParts.slice(0, -1).join(' ') + ' xxxxxx';
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">รายละเอียดเรื่องร้องเรียน</h2>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Basic Info */}
          <div className="space-y-4">
            {/* Status and Category */}
            <div className="flex items-center gap-3">
              {getStatusBadge(complaint.status)}
              <div className="flex items-center gap-2">
                {getCategoryIcon(complaint.category) && (
                  <Image
                    src={getCategoryIcon(complaint.category)}
                    alt={complaint.category}
                    width={24}
                    height={24}
                    className="w-6 h-6 object-contain"
                  />
                )}
                <span className="font-medium">{complaint.category}</span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">หัวข้อ</h3>
              <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">
                {complaint.detail}
              </p>
            </div>

            {/* Images */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">ภาพปัญหา</h3>
              {Array.isArray(complaint.images) && complaint.images.filter(image => isValidImageUrl(image)).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {complaint.images.filter(image => isValidImageUrl(image)).map((image, index) => (
                    <div key={index} className="relative group">
                      <Image
                        src={image}
                        alt={`ภาพปัญหา ${index + 1}`}
                        width={400}
                        height={128}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 border border-gray-200"
                        onClick={() => window.open(image, '_blank')}
                        onError={(e) => {
                          e.target.src = '/default-icon.png'; // fallback image
                          e.target.alt = 'ไม่สามารถโหลดภาพได้';
                          e.target.className = 'w-full h-32 object-contain rounded-lg cursor-pointer transition-all duration-200 border border-gray-200';
                        }}
                        title="คลิกเพื่อดูขนาดใหญ่"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-2">📷</div>
                  <p className="text-gray-500 text-sm">ไม่มีภาพปัญหา</p>
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">วันที่สร้าง</h3>
                <p className="text-sm text-gray-600">{formatDate(complaint.createdAt)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">อัปเดตล่าสุด</h3>
                <p className="text-sm text-gray-600">
                  {formatDate(complaint.updatedAt)}
                  <br />
                  <span className="text-xs text-gray-500">
                    ({getDaysSinceUpdate(complaint.updatedAt)})
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Assignment and Reporter Info */}
          <div className="space-y-4">
            {/* Assignment Status */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">สถานะการมอบหมาย</h3>
              {assignment ? (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-success">มอบหมายแล้ว</span>
                      <span className="text-sm text-gray-600">
                        {assignment.assignedAt ? formatDate(assignment.assignedAt) : 
                         assignment.createdAt ? formatDate(assignment.createdAt) : 'ไม่ระบุ'}
                      </span>
                    </div>
                    <button
                      className="btn btn-sm btn-info"
                      onClick={() => {
                        onClose();
                        if (onOpenUpdateModal && assignment) {
                          onOpenUpdateModal(assignment);
                        }
                      }}
                    >
                      ✏️ อัพเดท
                    </button>
                  </div>

                  {/* Assigned User Information */}
                  {assignedUser && (
                    <div className="mb-3 p-2 bg-white rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700">เจ้าหน้าที่ที่รับมอบหมาย:</p>
                        {assignedUser.phone && (
                          <button
                            className="btn btn-xs btn-success"
                            onClick={() => window.open(`tel:${assignedUser.phone}`, '_self')}
                          >
                            📞 โทรหา
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">👤 ชื่อ:</span>
                          <span className="text-sm font-medium">{hideLastName(assignedUser.name) || 'ไม่ระบุ'}</span>
                        </div>
                        {assignedUser.position && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">💼 ตำแหน่ง:</span>
                            <span className="text-sm font-medium">{assignedUser.position}</span>
                          </div>
                        )}
                        {assignedUser.department && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">🏢 แผนก:</span>
                            <span className="text-sm font-medium">{assignedUser.department}</span>
                          </div>
                        )}
                        {assignedUser.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">📞 เบอร์โทร:</span>
                            <span className="text-sm font-medium">{assignedUser.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {assignment.note && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700">หมายเหตุ:</p>
                      <p className="text-sm text-gray-600">{assignment.note}</p>
                    </div>
                  )}

                  {assignment.solution && assignment.solution.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-medium text-gray-700">วิธีการแก้ไข:</p>
                      <div className="flex flex-wrap gap-1">
                        {assignment.solution.map((solution, index) => (
                          <span key={index} className="badge badge-outline badge-sm">
                            {solution}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {complaint?.status === "ดำเนินการเสร็จสิ้น" && complaint?.updatedAt && (
                    <div>
                      <p className="text-sm font-medium text-green-700">เสร็จสิ้นเมื่อ:</p>
                      <p className="text-sm text-green-600">{formatDate(complaint.updatedAt)}</p>
                    </div>
                  )}

                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">ภาพหลังแก้ไข:</p>
                    {assignment.solutionImages && assignment.solutionImages.filter(image => isValidImageUrl(image)).length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {assignment.solutionImages.filter(image => isValidImageUrl(image)).map((image, index) => (
                          <div key={index} className="relative group">
                            <Image
                              src={image}
                              alt={`ภาพหลังแก้ไข ${index + 1}`}
                              width={300}
                              height={80}
                              className="w-full h-20 object-cover rounded cursor-pointer transition-all duration-200 hover:scale-105 border border-gray-200"
                              onClick={() => window.open(image, '_blank')}
                              onError={(e) => {
                                e.target.src = '/default-icon.png';
                                e.target.alt = 'ไม่สามารถโหลดภาพได้';
                                e.target.className = 'w-full h-20 object-contain rounded cursor-pointer transition-all duration-200 border border-gray-200';
                              }}
                              title="คลิกเพื่อดูขนาดใหญ่"
                            />

                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <div className="text-gray-400 text-2xl mb-1">📸</div>
                        <p className="text-gray-500 text-xs">ไม่มีภาพหลังแก้ไข</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="badge badge-neutral">ยังไม่มอบหมาย</span>
                  <p className="text-sm text-gray-500 mt-2">ยังไม่มีเจ้าหน้าที่รับมอบหมายงานนี้</p>
                </div>
              )}
            </div>

            {/* Reporter Information */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">ข้อมูลผู้แจ้ง</h3>
              {loading ? (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ) : reporterInfo ? (
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">ชื่อ:</span>
                        <span className="text-sm text-gray-900 ml-2">{reporterInfo.fullName}</span>
                      </div>
                      {reporterInfo.phone && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => window.open(`tel:${reporterInfo.phone}`, '_self')}
                        >
                          📞 โทรหา
                        </button>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">เบอร์โทร:</span>
                      <span className="text-sm text-gray-900 ml-2">{reporterInfo.phone}</span>
                    </div>
                    {reporterInfo.address && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">ที่อยู่:</span>
                        <span className="text-sm text-gray-900 ml-2">{reporterInfo.address}</span>
                      </div>
                    )}
                    {reporterInfo.community && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">ชุมชน:</span>
                        <span className="text-sm text-gray-900 ml-2">{reporterInfo.community}</span>
                      </div>
                    )}
                    {reporterInfo.location && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">พิกัด:</span>
                        <span className="text-sm text-gray-900 ml-2 font-mono">
                          {reporterInfo.location.lat?.toFixed(6)}, {reporterInfo.location.lng?.toFixed(6)}
                        </span>
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500">แผนที่:</span>
                            <button
                              className="btn btn-xs btn-outline btn-info"
                              onClick={() => window.open(`https://www.google.com/maps?q=${reporterInfo.location.lat},${reporterInfo.location.lng}&z=15`, '_blank')}
                            >
                              🗺️ เปิดใน Google Maps
                            </button>
                          </div>
                          <ReporterInfoMap location={reporterInfo.location} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">ไม่พบข้อมูลผู้แจ้ง</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </dialog>
  );
}
