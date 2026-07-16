import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import { Search, Calendar, User, Package, Eye, Star, Clock, CheckCircle, X, MapPin, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { COMMUNITIES } from '@/lib/takhliCommunities';
import {
  parseThaiDateLendString,
  toDatetimeLocalValue,
} from '@/lib/smartHealthBorrowDates';

const LocationPickerMap = dynamic(
  () => import('@/components/LocationPickerMap'),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
        กำลังโหลดแผนที่…
      </div>
    ),
  }
);

const BorrowReturnTable = ({ showOnlyUnevaluated = false }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuIcons, setMenuIcons] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, borrowing, returned
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [submittedFeedbacks, setSubmittedFeedbacks] = useState([]);
  const [feedbackData, setFeedbackData] = useState([]);
  const [geoEditOpen, setGeoEditOpen] = useState(false);
  const [geoCommunity, setGeoCommunity] = useState('');
  const [geoLocation, setGeoLocation] = useState(null);
  /** ใช้เปรียบเทียบว่าผู้ใช้ขยับแผนที่หรือไม่ — ไม่ส่ง location ใน PATCH ถ้ายังไม่เคยมี sm_location และไม่ได้ขยับแผนที่ */
  const [geoLocationSnapshot, setGeoLocationSnapshot] = useState(null);
  const [geoSaving, setGeoSaving] = useState(false);
  const [lendDateEditOpen, setLendDateEditOpen] = useState(false);
  const [lendDateLocal, setLendDateLocal] = useState('');
  const [lendDateSaving, setLendDateSaving] = useState(false);

  const refreshBorrowData = useCallback(async () => {
    const response = await axios.get('/api/smart-health/borrow-return');
    setData(response.data);
    setSelectedItem((prev) => {
      if (!prev) return null;
      const updated = response.data.find(
        (x) => String(x._id) === String(prev._id) || x.id_use_object === prev.id_use_object
      );
      return updated || prev;
    });
  }, []);

  useEffect(() => {
    const fetchSubmittedFeedbacks = async () => {
      try {
        const res = await axios.get('/api/smart-health/feedback-submitted');
        if (res.data && Array.isArray(res.data)) {
          setSubmittedFeedbacks(res.data.map(fb => fb.ob_type).filter(Boolean));
          setFeedbackData(res.data);
        }
      } catch (err) {
        console.error('Error fetching submitted feedbacks:', err);
        setSubmittedFeedbacks([]);
        setFeedbackData([]);
      }
    };
    fetchSubmittedFeedbacks();
  }, []);

  const { register, handleSubmit, reset } = useForm();

  const onSubmitFeedback = async (formData) => {
    if (!formData.satisfaction) {
      Swal.fire({
        icon: 'warning',
        title: 'กรุณาให้คะแนนความพึงพอใจ',
        text: 'กรุณาเลือกความพึงพอใจก่อนส่งแบบประเมิน',
      });
      return;
    }

    const payload = {
      ob_type: formData.ob_type || '',
      relation: formData.relation || '',
      satisfaction: formData.satisfaction || '',
      suggestion: formData.suggestion || '-',
    };

    if (!payload.ob_type || !payload.relation || !payload.satisfaction) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      });
      return;
    }

    try {
      const res = await axios.post('/api/smart-health/borrow-return', payload);
      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'ส่งแบบประเมินสำเร็จ',
          showConfirmButton: false,
          timer: 1500,
        });
        reset();
        setSelectedItem(null);
        // Re-fetch feedbacks
        const feedbackRes = await axios.get('/api/smart-health/feedback-submitted');
        if (feedbackRes.data && Array.isArray(feedbackRes.data)) {
          setSubmittedFeedbacks(feedbackRes.data.map(fb => fb.ob_type).filter(Boolean));
          setFeedbackData(feedbackRes.data);
        }
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถส่งแบบประเมินได้',
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        await refreshBorrowData();
      } catch (error) {
        console.error('Error fetching borrow-return data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshBorrowData]);

  useEffect(() => {
    const fetchMenuIcons = async () => {
      try {
        const res = await axios.get('/api/smart-health/menu-ob-health');
        setMenuIcons(res.data);
      } catch (err) {
        console.error('Error fetching menu icons:', err);
      }
    };
    fetchMenuIcons();
  }, []);

  useEffect(() => {
    setGeoEditOpen(false);
    setLendDateEditOpen(false);
  }, [selectedItem?._id]);

  const openLendDateEdit = () => {
    if (!selectedItem) return;
    const parsed = parseThaiDateLendString(selectedItem.date_lend);
    setLendDateLocal(toDatetimeLocalValue(parsed || new Date()));
    setLendDateEditOpen(true);
  };

  const handleSaveLendDate = async () => {
    if (!selectedItem?._id || !lendDateLocal?.trim()) return;
    setLendDateSaving(true);
    try {
      await axios.patch(
        `/api/smart-health/borrow-return?id=${encodeURIComponent(String(selectedItem._id))}`,
        { date_lend_iso: lendDateLocal.trim() }
      );
      await refreshBorrowData();
      setLendDateEditOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'บันทึกวันที่ยืมแล้ว',
        showConfirmButton: false,
        timer: 1200,
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: e.response?.data?.error || '',
      });
    } finally {
      setLendDateSaving(false);
    }
  };

  const openGeoEdit = () => {
    if (!selectedItem) return;
    const fromPerson = selectedItem.personCommunity || '';
    const override = selectedItem.sm_community || '';
    setGeoCommunity(String(override || fromPerson || selectedItem.resolvedCommunity || '').trim());
    const loc =
      selectedItem.sm_location?.lat != null && selectedItem.sm_location?.lng != null
        ? selectedItem.sm_location
        : selectedItem.personLocation?.lat != null && selectedItem.personLocation?.lng != null
          ? selectedItem.personLocation
          : null;
    const initialLoc = loc
      ? { lat: Number(loc.lat), lng: Number(loc.lng) }
      : { lat: 15.253914, lng: 100.351077 };
    setGeoLocation(initialLoc);
    setGeoLocationSnapshot({ ...initialLoc });
    setGeoEditOpen(true);
  };

  const handleSaveBorrowGeo = async () => {
    if (!selectedItem?._id) return;
    setGeoSaving(true);
    try {
      const hadSmLocation =
        selectedItem.sm_location?.lat != null && selectedItem.sm_location?.lng != null;
      const mapMoved =
        geoLocation &&
        geoLocationSnapshot &&
        (Math.abs(geoLocation.lat - geoLocationSnapshot.lat) > 1e-7 ||
          Math.abs(geoLocation.lng - geoLocationSnapshot.lng) > 1e-7);
      const payload = { community: geoCommunity.trim() || null };
      if (hadSmLocation || mapMoved) {
        payload.location = geoLocation;
      }
      await axios.patch(`/api/smart-health/borrow-return?id=${encodeURIComponent(String(selectedItem._id))}`, payload);
      await refreshBorrowData();
      setGeoEditOpen(false);
      Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', showConfirmButton: false, timer: 1200 });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e.response?.data?.error || '' });
    } finally {
      setGeoSaving(false);
    }
  };

  const handleClearBorrowSmLocation = async () => {
    if (!selectedItem?._id) return;
    setGeoSaving(true);
    try {
      await axios.patch(`/api/smart-health/borrow-return?id=${encodeURIComponent(String(selectedItem._id))}`, {
        location: null,
      });
      await refreshBorrowData();
      setGeoLocation({ lat: 15.253914, lng: 100.351077 });
      Swal.fire({ icon: 'success', title: 'ลบพิกัดรายการยืมแล้ว', showConfirmButton: false, timer: 1200 });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ' });
    } finally {
      setGeoSaving(false);
    }
  };

  const getIconUrl = (index_id_tk) => {
    const code = index_id_tk?.substring(0, 8);
    const match = menuIcons.find(menu => menu.id_code_th === code);
    return match?.image_icon || '';
  };

  const getObjectName = (index_id_tk) => {
    const code = index_id_tk?.substring(0, 8);
    const match = menuIcons.find(menu => menu.id_code_th === code);
    return match?.shot_name || '';
  };

  // Check if item is currently borrowed (no return date)
  const isBorrowing = (item) => {
    return !item.date_return || item.date_return === '-' || item.date_return === '';
  };

  // Sort and filter data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Sort by date_lend descending (newest first)
    result.sort((a, b) => {
      const ta = parseThaiDateLendString(a.date_lend)?.getTime() ?? 0;
      const tb = parseThaiDateLendString(b.date_lend)?.getTime() ?? 0;
      return tb - ta;
    });

    // Filter by type
    if (filterType) {
      result = result.filter(item => item.index_id_tk?.substring(0, 8) === filterType);
    }

    // Filter by status
    if (filterStatus === 'borrowing') {
      result = result.filter(item => isBorrowing(item));
    } else if (filterStatus === 'returned') {
      result = result.filter(item => !isBorrowing(item));
    }

    // Filter by search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.index_id_tk?.toLowerCase().includes(q) ||
        item.id_use_object?.toLowerCase().includes(q) ||
        item.id_personal_use?.includes(searchTerm) ||
        item.resolvedCommunity?.toLowerCase().includes(q) ||
        item.personFullName?.toLowerCase().includes(q)
      );
    }

    // Filter unevaluated if needed
    if (showOnlyUnevaluated) {
      result = result.filter(item => !submittedFeedbacks.includes(item.id_use_object));
    }

    return result;
  }, [data, filterType, filterStatus, searchTerm, showOnlyUnevaluated, submittedFeedbacks]);

  // Count stats
  const stats = useMemo(() => {
    const borrowing = data.filter(item => isBorrowing(item)).length;
    return {
      total: data.length,
      borrowing,
      returned: data.length - borrowing,
    };
  }, [data]);

  // Type counts for filter
  const typeCounts = useMemo(() => {
    const counts = {};
    data.forEach(item => {
      const code = item.index_id_tk?.substring(0, 8);
      if (code) {
        counts[code] = (counts[code] || 0) + 1;
      }
    });
    return counts;
  }, [data]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-2 text-gray-500">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ประวัติการยืม-คืนอุปกรณ์</h2>
          <p className="text-sm text-gray-500">
            ทั้งหมด {stats.total} รายการ | กำลังยืม {stats.borrowing} | คืนแล้ว {stats.returned}
            <span className="hidden sm:inline"> — วันเวลาในตารางเป็นปฏิทินไทย (พ.ศ.) เวลาไทย</span>
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filterStatus === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          ทั้งหมด ({stats.total})
        </button>
        <button
          onClick={() => setFilterStatus('borrowing')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filterStatus === 'borrowing'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          กำลังยืม ({stats.borrowing})
        </button>
        <button
          onClick={() => setFilterStatus('returned')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filterStatus === 'returned'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          คืนแล้ว ({stats.returned})
        </button>
      </div>

      {/* Search & Type Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหา Serial, รหัสอุปกรณ์..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Type Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilterType('')}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            filterType === ''
              ? 'bg-primary text-white shadow-md'
              : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
          }`}
        >
          ทั้งหมด
        </button>
        {menuIcons.map((icon) => {
          const code = icon.id_code_th;
          const count = typeCounts[code] || 0;
          if (count === 0) return null;

          return (
            <button
              key={code}
              onClick={() => setFilterType(filterType === code ? '' : code)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                filterType === code
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {icon.image_icon && (
                <Image src={icon.image_icon} alt="" width={16} height={16} className="object-contain" unoptimized />
              )}
              {icon.shot_name || code}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                filterType === code ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filteredData.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">ไม่พบรายการ</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? 'ลองค้นหาด้วยคำค้นอื่น' : 'ยังไม่มีประวัติการยืม-คืน'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                  #
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  อุปกรณ์
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  ผู้ยืม
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider max-w-[140px]">
                  ชุมชน (สรุป)
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    วันที่ยืม
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    วันที่คืน
                  </div>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((item, index) => {
                const borrowing = isBorrowing(item);
                const hasFeedback = submittedFeedbacks.includes(item.id_use_object);

                return (
                  <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {getIconUrl(item.index_id_tk) ? (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center p-1">
                            <Image
                              src={getIconUrl(item.index_id_tk)}
                              alt=""
                              width={32}
                              height={32}
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getObjectName(item.index_id_tk) || 'อุปกรณ์'}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {item.id_use_object}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-sm text-gray-600 font-mono block">
                            {item.id_personal_use
                              ? `${item.id_personal_use.slice(0, 3)}****${item.id_personal_use.slice(-4)}`
                              : '-'}
                          </span>
                          {item.personFullName && (
                            <span className="text-xs text-gray-500 truncate block max-w-[140px]" title={item.personFullName}>
                              {item.personFullName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-[140px]">
                      {item.resolvedCommunity ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-100 truncate max-w-full"
                          title={item.resolvedCommunity}
                        >
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.resolvedCommunity}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                          ยังไม่ระบุ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-900">{item.date_lend || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-900">
                        {item.date_return && item.date_return !== '-' ? item.date_return : '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {borrowing ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          กำลังยืม
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          <CheckCircle className="w-3 h-3" />
                          คืนแล้ว
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedItem(item);
                            setShowFeedbackForm(false);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!hasFeedback && !borrowing && (
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowFeedbackForm(true);
                            }}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="ให้คะแนน"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        {hasFeedback && (
                          <span className="p-2 text-green-500" title="ประเมินแล้ว">
                            <Star className="w-4 h-4 fill-current" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden ${
              geoEditOpen ? 'max-w-2xl max-h-[92vh] flex flex-col' : 'max-w-lg'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-3">
                {getIconUrl(selectedItem.index_id_tk) ? (
                  <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center p-2">
                    <Image
                      src={getIconUrl(selectedItem.index_id_tk)}
                      alt=""
                      width={40}
                      height={40}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {getObjectName(selectedItem.index_id_tk) || 'รายละเอียดการยืม'}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">{selectedItem.id_use_object}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setGeoEditOpen(false);
                  setSelectedItem(null);
                }}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className={`p-4 ${geoEditOpen ? 'overflow-y-auto flex-1 min-h-0' : ''}`}>
              {!showFeedbackForm ? (
                <>
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">Serial Number</div>
                      <div className="text-sm font-mono font-medium">{selectedItem.index_id_tk}</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">เลขบัตรประชาชน</div>
                      <div className="text-sm font-mono font-medium">
                        {selectedItem.id_personal_use
                          ? `${selectedItem.id_personal_use.slice(0, 3)}****${selectedItem.id_personal_use.slice(-4)}`
                          : '-'}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl sm:col-span-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-xs text-gray-500">วันที่ยืม</div>
                        {!lendDateEditOpen && (
                          <button
                            type="button"
                            onClick={openLendDateEdit}
                            className="text-xs font-medium text-primary hover:underline shrink-0"
                          >
                            แก้ไข
                          </button>
                        )}
                      </div>
                      {!lendDateEditOpen ? (
                        <div className="text-sm font-medium">
                          {selectedItem.date_lend || '-'}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <input
                            type="datetime-local"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                            value={lendDateLocal}
                            onChange={(e) => setLendDateLocal(e.target.value)}
                            disabled={lendDateSaving}
                          />
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => setLendDateEditOpen(false)}
                              disabled={lendDateSaving}
                              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveLendDate}
                              disabled={lendDateSaving || !lendDateLocal?.trim()}
                              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                            >
                              {lendDateSaving ? 'กำลังบันทึก…' : 'บันทึก'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <div className="text-xs text-gray-500 mb-1">วันที่คืน</div>
                      <div className="text-sm font-medium">
                        {selectedItem.date_return && selectedItem.date_return !== '-'
                          ? selectedItem.date_return
                          : <span className="text-amber-600">ยังไม่คืน</span>}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center mb-4">
                    {isBorrowing(selectedItem) ? (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-4 h-4" />
                        กำลังยืมอยู่
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle className="w-4 h-4" />
                        คืนแล้ว
                      </span>
                    )}
                  </div>

                  {/* ชุมชน / พิกัด สำหรับสรุปงบ (ไม่บังคับมีพิกัด — เลือกชุมชนได้ทันที) */}
                  <div className="rounded-xl border border-gray-200 bg-slate-50/80 p-3 mb-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        เขตชุมชน (สรุป / วางแผน)
                      </p>
                      {!geoEditOpen && (
                        <button
                          type="button"
                          onClick={openGeoEdit}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          แก้ไข
                        </button>
                      )}
                    </div>
                    {!geoEditOpen ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <span className="text-gray-500">ชุมชน:</span>
                          {selectedItem.resolvedCommunity ? (
                            <span className="font-medium text-gray-900">{selectedItem.resolvedCommunity}</span>
                          ) : (
                            <span className="text-amber-700">ยังไม่ระบุ — กดแก้ไขเพื่อเลือกจากรายชื่อชุมชน</span>
                          )}
                          {selectedItem.sm_community && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border text-gray-500">
                              ระบุในรายการยืม
                            </span>
                          )}
                          {!selectedItem.sm_community && selectedItem.personCommunity && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border text-gray-500">
                              จากทะเบียนบุคคล
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-gray-500">พิกัด:</span>
                          {selectedItem.resolvedLocation ? (
                            <>
                              <span className="font-mono text-xs text-gray-800">
                                {Number(selectedItem.resolvedLocation.lat).toFixed(5)},{' '}
                                {Number(selectedItem.resolvedLocation.lng).toFixed(5)}
                              </span>
                              <a
                                href={`https://www.google.com/maps?q=${selectedItem.resolvedLocation.lat},${selectedItem.resolvedLocation.lng}&z=16`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                เปิดแผนที่
                              </a>
                            </>
                          ) : (
                            <span className="text-gray-500 text-xs">ไม่มีพิกัด — ยังสรุปตามชุมชนได้</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">เลือกชุมชน (รายการที่มีในระบบ)</label>
                          <select
                            className="select select-bordered select-sm w-full max-w-md"
                            value={geoCommunity}
                            onChange={(e) => setGeoCommunity(e.target.value)}
                          >
                            <option value="">— ยังไม่ระบุ —</option>
                            {COMMUNITIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          ระบุพิกัดได้ภายหลังเพื่อแสดงบนแผนที่ หรือเว้นว่างได้ — การสรุปตามชุมชนใช้รายการที่เลือกด้านบน
                        </p>
                        {geoLocation && (
                          <LocationPickerMap initialLocation={geoLocation} onLocationChange={setGeoLocation} />
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={geoSaving}
                            onClick={handleSaveBorrowGeo}
                            className="btn btn-sm btn-primary"
                          >
                            {geoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            บันทึกชุมชนและพิกัด
                          </button>
                          <button type="button" disabled={geoSaving} onClick={() => setGeoEditOpen(false)} className="btn btn-sm btn-ghost">
                            ยกเลิก
                          </button>
                          {selectedItem.sm_location?.lat != null && (
                            <button
                              type="button"
                              disabled={geoSaving}
                              onClick={handleClearBorrowSmLocation}
                              className="btn btn-sm btn-outline btn-warning"
                            >
                              ลบพิกัดเฉพาะรายการนี้
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Feedback Status */}
                  {(() => {
                    const matchedFeedback = feedbackData.find(fb => fb.ob_type === selectedItem.id_use_object);
                    if (matchedFeedback) {
                      return (
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                          <div className="text-center">
                            <div className="text-sm text-gray-600 mb-2">ความพึงพอใจ</div>
                            <div className="flex items-center justify-center gap-1">
                              {[1, 2, 3].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-6 h-6 ${
                                    star <= matchedFeedback.satisfaction
                                      ? 'text-amber-400 fill-current'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              {matchedFeedback.suggestion && matchedFeedback.suggestion !== '-'
                                ? `"${matchedFeedback.suggestion}"`
                                : ''}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              ) : (
                /* Feedback Form */
                <form onSubmit={handleSubmit(onSubmitFeedback)} className="space-y-4">
                  <input type="hidden" value={selectedItem.id_use_object} {...register('ob_type')} />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ท่านมีส่วนเกี่ยวข้องอย่างไรกับการใช้อุปกรณ์
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          value="เป็นผู้ใช้อุปกรณ์"
                          {...register('relation')}
                          className="radio radio-primary"
                        />
                        <span className="text-sm">เป็นผู้ใช้อุปกรณ์</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          value="เป็นผู้ดูแล/ครอบครัว"
                          {...register('relation')}
                          className="radio radio-primary"
                        />
                        <span className="text-sm">มีคนในครอบครัวใช้/เป็นผู้ดูแล</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ความพึงพอใจในการใช้อุปกรณ์
                    </label>
                    <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 rounded-xl">
                      {[1, 2, 3].map((value) => (
                        <label key={value} className="cursor-pointer">
                          <input
                            type="radio"
                            value={value}
                            {...register('satisfaction')}
                            className="sr-only peer"
                          />
                          <Star className="w-10 h-10 text-gray-300 peer-checked:text-amber-400 peer-checked:fill-current hover:text-amber-300 transition-colors" />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ข้อเสนอแนะเพิ่มเติม
                    </label>
                    <textarea
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                      placeholder="หากไม่มีให้ใส่ - "
                      rows={3}
                      {...register('suggestion')}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowFeedbackForm(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
                    >
                      ส่งความคิดเห็น
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            {!showFeedbackForm && (
              <div className="flex gap-3 p-4 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => {
                    setGeoEditOpen(false);
                    setSelectedItem(null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-white transition-colors font-medium"
                >
                  ปิด
                </button>
                {!submittedFeedbacks.includes(selectedItem.id_use_object) && !isBorrowing(selectedItem) && (
                  <button
                    onClick={() => setShowFeedbackForm(true)}
                    className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4" />
                    ให้คะแนน
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BorrowReturnTable;
