import { useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { Crown, Key, User, CheckCircle, AlertCircle } from "lucide-react";
import Swal from "sweetalert2";

export default function SuperAdminSetupPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  
  const [secretKey, setSecretKey] = useState("");
  const [targetClerkId, setTargetClerkId] = useState("");
  const [loading, setLoading] = useState(false);
  const [useCurrentUser, setUseCurrentUser] = useState(true);

  const isSuperAdmin = user?.publicMetadata?.role === 'superadmin';

  const handleSetup = async () => {
    const clerkIdToUse = useCurrentUser ? user?.id : targetClerkId;
    
    if (!clerkIdToUse) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณากรอก Clerk ID หรือเลือกใช้บัญชีปัจจุบัน',
      });
      return;
    }

    if (!isSuperAdmin && !secretKey) {
      Swal.fire({
        icon: 'error',
        title: 'ต้องใส่ Secret Key',
        text: 'สำหรับการตั้งค่าครั้งแรก ต้องใส่ SUPERADMIN_SECRET',
      });
      return;
    }

    try {
      setLoading(true);
      
      const token = await getToken();
      const res = await fetch('/api/permissions/make-superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetClerkId: clerkIdToUse,
          secretKey: secretKey,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'สำเร็จ!',
          text: 'ตั้งค่า Super Admin เรียบร้อยแล้ว',
          confirmButtonText: 'ไปหน้า Super Admin',
        });
        
        // Refresh to get new role
        window.location.href = '/admin/superadmin';
      } else {
        throw new Error(data.message || 'Failed to set superadmin');
      }
    } catch (error) {
      console.error("Error:", error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error.message || 'ไม่สามารถตั้งค่า Super Admin ได้',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-purple-900">
        <div className="loading loading-spinner loading-lg text-white"></div>
      </div>
    );
  }

  // If already superadmin, show different UI
  if (isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">คุณเป็น Super Admin แล้ว</h1>
            <p className="text-purple-200 mb-6">คุณสามารถจัดการผู้ใช้และสิทธิ์ได้ที่หน้า Super Admin</p>
            
            <div className="space-y-4">
              <button
                onClick={() => router.push('/admin/superadmin')}
                className="btn w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0"
              >
                <Crown className="w-5 h-5 mr-2" />
                ไปหน้า Super Admin
              </button>
              
              <div className="divider text-white/50">หรือ</div>
              
              <div className="bg-white/5 rounded-xl p-4">
                <h3 className="text-white font-medium mb-3">ตั้งค่าผู้ใช้อื่นเป็น Super Admin</h3>
                <input
                  type="text"
                  placeholder="Clerk ID ของผู้ใช้"
                  className="input w-full bg-white/10 border-white/20 text-white placeholder-gray-400 mb-3"
                  value={targetClerkId}
                  onChange={(e) => setTargetClerkId(e.target.value)}
                />
                <button
                  onClick={() => {
                    setUseCurrentUser(false);
                    handleSetup();
                  }}
                  disabled={loading || !targetClerkId}
                  className="btn w-full bg-purple-600 hover:bg-purple-700 text-white border-0"
                >
                  {loading ? (
                    <span className="loading loading-spinner"></span>
                  ) : (
                    <>
                      <User className="w-5 h-5 mr-2" />
                      ตั้งค่าเป็น Super Admin
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-xl mx-auto">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">ตั้งค่า Super Admin</h1>
            <p className="text-purple-200">
              สำหรับการตั้งค่า Super Admin คนแรกของระบบ
            </p>
          </div>

          {/* Warning */}
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-amber-200 text-sm">
                <p className="font-medium mb-1">สำคัญ!</p>
                <p>
                  การตั้งค่านี้ต้องใช้ <code className="bg-black/30 px-1 rounded">SUPERADMIN_SECRET</code> 
                  ที่ตั้งค่าใน environment variables
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Use Current User */}
            <label className="flex items-center gap-3 p-4 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={useCurrentUser}
                onChange={(e) => setUseCurrentUser(e.target.checked)}
              />
              <div>
                <div className="text-white font-medium">ใช้บัญชีปัจจุบัน</div>
                <div className="text-sm text-gray-400">
                  {user?.fullName} ({user?.id})
                </div>
              </div>
            </label>

            {/* Target Clerk ID */}
            {!useCurrentUser && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text text-white flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Clerk ID ของผู้ใช้
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="user_xxxxx..."
                  className="input w-full bg-white/10 border-white/20 text-white placeholder-gray-400"
                  value={targetClerkId}
                  onChange={(e) => setTargetClerkId(e.target.value)}
                />
              </div>
            )}

            {/* Secret Key */}
            <div className="form-control">
              <label className="label">
                <span className="label-text text-white flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Super Admin Secret Key
                </span>
              </label>
              <input
                type="password"
                placeholder="กรอก SUPERADMIN_SECRET"
                className="input w-full bg-white/10 border-white/20 text-white placeholder-gray-400"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSetup}
              disabled={loading}
              className="btn w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 mt-6"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner"></span>
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <Crown className="w-5 h-5 mr-2" />
                  ตั้งค่าเป็น Super Admin
                </>
              )}
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-4 bg-white/5 rounded-xl">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              วิธีการตั้งค่า
            </h3>
            <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
              <li>เพิ่ม <code className="bg-black/30 px-1 rounded">SUPERADMIN_SECRET</code> ใน <code className="bg-black/30 px-1 rounded">.env.local</code></li>
              <li>กรอก Secret Key ที่ตั้งไว้</li>
              <li>เลือกบัญชีที่ต้องการตั้งเป็น Super Admin</li>
              <li>กดปุ่มตั้งค่า</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

