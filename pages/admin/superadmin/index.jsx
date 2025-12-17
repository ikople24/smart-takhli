import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import { 
  Shield, 
  Users, 
  Search, 
  Crown,
  User as UserIcon,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Save
} from "lucide-react";

// รายการหน้าทั้งหมดที่สามารถจำกัดได้
const ALL_PAGES = [
  { path: '/admin', label: 'ตั้งค่าหน้าจอ', icon: '🛠' },
  { path: '/admin/register-user', label: 'จัดการผู้ใช้งาน', icon: '👥' },
  { path: '/admin/manage-complaints', label: 'จัดการเรื่องร้องเรียน', icon: '📋' },
  { path: '/admin/dashboard', label: 'แดชบอร์ด', icon: '📊' },
  { path: '/admin/smart-health', label: 'smart-health', icon: '🟣' },
  { path: '/admin/smart-health-delivery', label: 'smart-health ส่งของ', icon: '📦' },
  { path: '/admin/smart-health-return', label: 'smart-health รับคืน', icon: '↩️' },
  { path: '/admin/education-map', label: 'smart-school', icon: '🏫' },
  { path: '/admin/manage-activities', label: 'จัดการกิจกรรม', icon: '📅' },
  { path: '/admin/feedback-analysis', label: 'วิเคราะห์ความคิดเห็น', icon: '📈' },
  { path: '/user/satisfaction', label: 'ประเมินความพึงพอใจ', icon: '⭐' },
];

export default function SuperAdminPage() {
  const { user } = useUser();
  const router = useRouter();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState({});
  const [expandedUser, setExpandedUser] = useState(null);
  const [editedPages, setEditedPages] = useState({});

  const isSuperAdmin = user?.publicMetadata?.role === 'superadmin';

  useEffect(() => {
    if (user && !isSuperAdmin) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่มีสิทธิ์เข้าถึง',
        text: 'เฉพาะ Super Admin เท่านั้น',
        confirmButtonText: 'กลับหน้าหลัก',
      }).then(() => router.replace('/'));
    }
  }, [user, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) fetchUsers();
  }, [isSuperAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      // ดึงจาก MongoDB โดยตรง (รวม allowedPages)
      const res = await fetch('/api/users/get-all-users-local');
      const data = await res.json();
      const usersList = Array.isArray(data) ? data : (data.users || []);
      setUsers(usersList);
      
      // Initialize edited pages - ถ้ายังไม่มี allowedPages ให้เป็นทุกหน้า (default)
      const pagesMap = {};
      usersList.forEach(u => {
        pagesMap[u._id] = u.allowedPages || ALL_PAGES.map(p => p.path);
      });
      setEditedPages(pagesMap);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePage = (userId, pagePath) => {
    setEditedPages(prev => {
      const current = prev[userId] || [];
      if (current.includes(pagePath)) {
        return { ...prev, [userId]: current.filter(p => p !== pagePath) };
      } else {
        return { ...prev, [userId]: [...current, pagePath] };
      }
    });
  };

  const selectAllPages = (userId) => {
    setEditedPages(prev => ({
      ...prev,
      [userId]: ALL_PAGES.map(p => p.path)
    }));
  };

  const clearAllPages = (userId) => {
    setEditedPages(prev => ({
      ...prev,
      [userId]: []
    }));
  };

  const saveUserPages = async (userData) => {
    try {
      setSaving(prev => ({ ...prev, [userData._id]: true }));
      
      // บันทึกลง MongoDB
      const res = await fetch('/api/users/update-allowed-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData._id,
          allowedPages: editedPages[userData._id] || [],
        }),
      });

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          text: `อัปเดตหน้าที่อนุญาตสำหรับ ${userData.name} แล้ว`,
          timer: 2000,
          showConfirmButton: false,
        });
        
        // Update local state
        setUsers(prev => prev.map(u => 
          u._id === userData._id 
            ? { ...u, allowedPages: editedPages[userData._id] } 
            : u
        ));
      } else {
        throw new Error('Failed');
      }
    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถบันทึกได้' });
    } finally {
      setSaving(prev => ({ ...prev, [userData._id]: false }));
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading loading-spinner loading-lg text-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-lg">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Super Admin</h1>
              <p className="text-purple-200">จัดการหน้าที่อนุญาตสำหรับแต่ละ User</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-white">{users.length}</div>
                <div className="text-sm text-blue-200">ผู้ใช้ทั้งหมด</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-emerald-400" />
              <div>
                <div className="text-2xl font-bold text-white">{ALL_PAGES.length}</div>
                <div className="text-sm text-emerald-200">หน้าทั้งหมด</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Refresh */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/20">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาผู้ใช้..."
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={fetchUsers}
              className="btn btn-outline border-white/30 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl p-4 mb-6">
          <p className="text-blue-200 text-sm">
            💡 <strong>วิธีใช้:</strong> กดลูกศรเพื่อขยายและเลือกหน้าที่อนุญาตให้แต่ละ user เข้าถึงได้ 
            จากนั้นกดบันทึก
          </p>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading loading-spinner loading-lg text-purple-400"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((userData) => {
              const isSavingThis = saving[userData._id];
              const isExpanded = expandedUser === userData._id;
              const userPages = editedPages[userData._id] || [];

              return (
                <div
                  key={userData._id}
                  className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden"
                >
                  {/* User Row */}
                  <div 
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5"
                    onClick={() => setExpandedUser(isExpanded ? null : userData._id)}
                  >
                    <div className="flex items-center gap-4">
                      {userData.profileUrl ? (
                        <img
                          src={userData.profileUrl}
                          alt={userData.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/30"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                          {userData.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white">{userData.name}</div>
                        <div className="text-sm text-gray-300">
                          {userData.position} • {userData.department}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-purple-300 text-sm">
                        {userPages.length}/{ALL_PAGES.length} หน้า
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded: Page Permissions */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 bg-black/20">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-white font-medium">หน้าที่อนุญาต</h4>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); selectAllPages(userData._id); }}
                            className="btn btn-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            เลือกทั้งหมด
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); clearAllPages(userData._id); }}
                            className="btn btn-xs bg-red-600 hover:bg-red-700 text-white border-0"
                          >
                            <X className="w-3 h-3 mr-1" />
                            ล้างทั้งหมด
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                        {ALL_PAGES.map(page => {
                          const isAllowed = userPages.includes(page.path);
                          return (
                            <button
                              key={page.path}
                              onClick={(e) => { e.stopPropagation(); togglePage(userData._id, page.path); }}
                              className={`p-2 rounded-lg text-left text-sm transition-all ${
                                isAllowed
                                  ? 'bg-emerald-600/30 border border-emerald-500/50 text-white'
                                  : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                              }`}
                            >
                              <span className="mr-2">{page.icon}</span>
                              {page.label}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); saveUserPages(userData); }}
                        disabled={isSavingThis}
                        className="btn btn-sm bg-purple-600 hover:bg-purple-700 text-white border-0"
                      >
                        {isSavingThis ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          <Save className="w-4 h-4 mr-1" />
                        )}
                        บันทึก
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl">ไม่พบผู้ใช้</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
