import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import {
  Shield,
  Users,
  Search,
  Crown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Save,
  AlertTriangle,
  Building2,
  Briefcase,
  UserPlus
} from "lucide-react";
import { ALL_PAGES, getExecutivePagePaths } from "@/lib/permissions";

// App ID ปัจจุบัน (ดึงจาก env)
const CURRENT_APP_ID = process.env.NEXT_PUBLIC_APP_ID || "smart-takhli";

export default function SuperAdminPage() {
  const { user } = useUser();
  const router = useRouter();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState({});
  const [expandedUser, setExpandedUser] = useState(null);
  const [editedPages, setEditedPages] = useState({});
  const [showOnlyCurrentApp, setShowOnlyCurrentApp] = useState(true); // กรองเฉพาะ app ปัจจุบัน
  const [unregistered, setUnregistered] = useState([]); // มีบัญชี Clerk แต่ยังไม่มี doc ใน Mongo
  const [onboarding, setOnboarding] = useState({});

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

      // พนักงานใหม่: มีบัญชี Clerk แล้วแต่ยังไม่มี doc ใน Mongo → ยังใช้งานระบบไม่ได้
      const unregRes = await fetch('/api/permissions/clerk-unregistered');
      const unregData = await unregRes.json();
      setUnregistered(unregData.users || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // เพิ่มพนักงานใหม่เข้าระบบ = สร้าง Mongo doc (ผูก clerkId + appId ปัจจุบัน)
  // หลังจากนี้เขาจะเข้าระบบได้ และโผล่ในรายการด้านล่างให้ติ๊กสิทธิ์ต่อ
  const onboardUser = async (clerkUser) => {
    try {
      setOnboarding(prev => ({ ...prev, [clerkUser.clerkId]: true }));

      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: clerkUser.clerkId,
          name: clerkUser.name || clerkUser.email,
          role: 'admin',
          profileUrl: clerkUser.imageUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed');
      }

      Swal.fire({
        icon: 'success',
        title: 'เพิ่มเข้าระบบแล้ว',
        text: `${clerkUser.name || clerkUser.email} ใช้งาน ${CURRENT_APP_ID} ได้แล้ว — กำหนดสิทธิ์หน้าต่อได้ด้านล่าง`,
        timer: 2500,
        showConfirmButton: false,
      });

      await fetchUsers();
    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'เพิ่มไม่สำเร็จ', text: error.message });
    } finally {
      setOnboarding(prev => ({ ...prev, [clerkUser.clerkId]: false }));
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

  // Preset "ผู้บริหาร" — เห็นทุกโมดูลยกเว้นการตั้งค่า (ดู getExecutivePagePaths ใน lib/permissions)
  const applyExecutivePreset = (userId) => {
    setEditedPages(prev => ({
      ...prev,
      [userId]: getExecutivePagePaths()
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

  // กำหนด appId ให้ user
  const assignAppId = async (userData) => {
    try {
      setSaving(prev => ({ ...prev, [userData._id]: true }));
      
      const res = await fetch('/api/users/update-app-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData._id,
          appId: CURRENT_APP_ID,
        }),
      });

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'กำหนด App สำเร็จ',
          text: `${userData.name} ถูกกำหนดให้ใช้ ${CURRENT_APP_ID} แล้ว`,
          timer: 2000,
          showConfirmButton: false,
        });
        
        // Update local state
        setUsers(prev => prev.map(u => 
          u._id === userData._id 
            ? { ...u, appId: CURRENT_APP_ID } 
            : u
        ));
      } else {
        throw new Error('Failed');
      }
    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถกำหนด App ได้' });
    } finally {
      setSaving(prev => ({ ...prev, [userData._id]: false }));
    }
  };

  // กรอง users ตาม search และ appId
  const filteredUsers = users.filter(u => {
    // สำคัญ: อย่าใช้ (u.name?...  || u.department?...) ตรง ๆ เพราะถ้า user "ไม่มีทั้ง
    // name และ department" ผลจะเป็น undefined (falsy) → ถูกซ่อนถาวรแม้ search ว่าง
    // (เคสจริง: doc ที่สร้างข้ามแอปมาไม่มี name → หายไปจากรายการทั้งหมด)
    const q = searchTerm.trim().toLowerCase();
    const matchSearch = q === "" ||
      (u.name || "").toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      (u.clerkId || "").toLowerCase().includes(q);

    if (!showOnlyCurrentApp) return matchSearch;

    // กรองเฉพาะ user ที่มี appId ตรงกัน หรือยังไม่ได้กำหนด appId
    const userAppId = u.appId || "";
    return matchSearch && (userAppId === "" || userAppId === CURRENT_APP_ID);
  });

  // นับจำนวน user ที่ยังไม่ได้กำหนด appId
  const usersWithoutAppId = users.filter(u => !u.appId || u.appId === "").length;
  const usersWithCurrentApp = users.filter(u => u.appId === CURRENT_APP_ID).length;

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
              <Building2 className="w-8 h-8 text-emerald-400" />
              <div>
                <div className="text-2xl font-bold text-white">{usersWithCurrentApp}</div>
                <div className="text-sm text-emerald-200">{CURRENT_APP_ID}</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <div>
                <div className="text-2xl font-bold text-white">{usersWithoutAppId}</div>
                <div className="text-sm text-amber-200">ยังไม่กำหนด App</div>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{ALL_PAGES.length}</div>
                <div className="text-sm text-purple-200">หน้าทั้งหมด</div>
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
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyCurrentApp}
                  onChange={(e) => setShowOnlyCurrentApp(e.target.checked)}
                  className="checkbox checkbox-sm checkbox-primary"
                />
                <span className="text-white text-sm">เฉพาะ {CURRENT_APP_ID}</span>
              </label>
              <button
                onClick={fetchUsers}
                className="btn btn-outline border-white/30 text-white hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                รีเฟรช
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl p-4 mb-6">
          <p className="text-blue-200 text-sm mb-2">
            💡 <strong>วิธีใช้:</strong> กดลูกศรเพื่อขยายและเลือกหน้าที่อนุญาตให้แต่ละ user เข้าถึงได้ 
            จากนั้นกดบันทึก
          </p>
          <p className="text-amber-200 text-sm">
            🔒 <strong>ความปลอดภัย:</strong> User ที่มี badge &quot;ยังไม่กำหนด App&quot; จะ<strong>ไม่สามารถเข้าใช้งานได้</strong> 
            คุณต้องกด &quot;กำหนด App&quot; เพื่ออนุมัติให้ใช้งาน <strong>{CURRENT_APP_ID}</strong>
          </p>
        </div>

        {/* พนักงานใหม่: มีบัญชี Clerk แต่ยังไม่มี doc ใน Mongo → ยังเข้าระบบไม่ได้ */}
        {!loading && unregistered.length > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <h3 className="text-white font-semibold">
                พนักงานใหม่รอเพิ่มเข้าระบบ ({unregistered.length})
              </h3>
            </div>
            <p className="text-emerald-200/80 text-sm mb-4">
              มีบัญชี Clerk แล้วแต่ยังไม่มีข้อมูลในระบบ → ตอนนี้เข้าใช้งานไม่ได้ (ขึ้น &quot;ยังไม่ได้ลงทะเบียน&quot;)
              กด &quot;เพิ่มเข้าระบบ&quot; เพื่อสร้างข้อมูลและกำหนด App <strong>{CURRENT_APP_ID}</strong> ให้
            </p>

            <div className="space-y-2">
              {unregistered.map((cu) => (
                <div
                  key={cu.clerkId}
                  className="flex items-center justify-between gap-4 bg-white/5 rounded-xl p-3 border border-white/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {cu.imageUrl ? (
                      <img
                        src={cu.imageUrl}
                        alt={cu.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold">
                        {(cu.name || cu.email || '?').charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate">
                        {cu.name || '(ยังไม่ตั้งชื่อใน Clerk)'}
                      </div>
                      <div className="text-sm text-gray-400 truncate">{cu.email}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onboardUser(cu)}
                    disabled={onboarding[cu.clerkId]}
                    className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white border-0 shrink-0"
                  >
                    {onboarding[cu.clerkId] ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-1" />
                        เพิ่มเข้าระบบ
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
                        <div className="font-semibold text-white flex items-center gap-2">
                          {userData.name || (
                            <span className="italic text-amber-300">
                              (ยังไม่มีชื่อ) {userData.clerkId}
                            </span>
                          )}
                          {/* แสดงสถานะ appId */}
                          {userData.appId === CURRENT_APP_ID ? (
                            <span className="badge badge-sm bg-emerald-600 border-0 text-white">
                              {CURRENT_APP_ID}
                            </span>
                          ) : userData.appId ? (
                            <span className="badge badge-sm bg-orange-600 border-0 text-white">
                              {userData.appId}
                            </span>
                          ) : (
                            <span className="badge badge-sm bg-amber-600 border-0 text-white">
                              ยังไม่กำหนด App
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-300">
                          {userData.position} • {userData.department}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* ปุ่มกำหนด App สำหรับ user ที่ยังไม่ได้กำหนด */}
                      {(!userData.appId || userData.appId === "") && (
                        <button
                          onClick={(e) => { e.stopPropagation(); assignAppId(userData); }}
                          disabled={isSavingThis}
                          className="btn btn-xs bg-amber-600 hover:bg-amber-700 text-white border-0"
                        >
                          {isSavingThis ? (
                            <span className="loading loading-spinner loading-xs"></span>
                          ) : (
                            <>
                              <Building2 className="w-3 h-3 mr-1" />
                              กำหนด App
                            </>
                          )}
                        </button>
                      )}
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); applyExecutivePreset(userData._id); }}
                            title="เห็นทุกโมดูลยกเว้นการตั้งค่า"
                            className="btn btn-xs bg-amber-500 hover:bg-amber-600 text-white border-0"
                          >
                            <Briefcase className="w-3 h-3 mr-1" />
                            ผู้บริหาร
                          </button>
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
