import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { promptFont } from './ActivityFeedCard';

// กล่องความคิดเห็นสไตล์วารสาร — ใช้ใต้บทความใน /activities เท่านั้น
// ไม่แสดงข้อมูลกิจกรรมซ้ำ (ชื่อ/วันที่/สถิติ อยู่ในบทความด้านบนแล้ว)

interface Activity {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface Feedback {
  _id: string;
  grade: string;
  comment: string;
  emotionLevel: number;
  category: string;
  createdAt: string;
}

interface ActivityFeedbackPanelProps {
  selectedActivity: Activity;
  onSubmitted?: () => void;
}

const GRADES = ['ประถมศึกษา', 'มัธยมศึกษาตอนต้น', 'มัธยมศึกษาตอนปลาย', 'อุดมศึกษา'];
const CATEGORIES = ['ทั่วไป', 'สุขภาพ', 'การศึกษา', 'สิ่งแวดล้อม', 'การคมนาคม', 'สวัสดิการสังคม', 'สันทนาการ', 'อื่นๆ'];

const Stars = ({ value, size = 'text-sm' }: { value: number; size?: string }) => (
  <span className={`${size} tracking-tight text-amber-400`} aria-label={`คะแนน ${value} จาก 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={i <= value ? '' : 'text-slate-200'}>★</span>
    ))}
  </span>
);

const ActivityFeedbackPanel = ({ selectedActivity, onSubmitted }: ActivityFeedbackPanelProps) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emotionLevel, setEmotionLevel] = useState(0);
  const [grade, setGrade] = useState('');
  const [category, setCategory] = useState('ทั่วไป');
  const [comment, setComment] = useState('');

  const activityId = selectedActivity._id;

  const fetchFeedbacks = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/student-feedback?page=${p}&limit=5&activityId=${activityId}`);
        const data = await res.json();
        if (data.success) {
          setFeedbacks(data.data);
          setPage(p);
          setTotalPages(data.pagination?.totalPages || 1);
        }
      } catch (e) {
        console.error('Error fetching feedbacks:', e);
      } finally {
        setLoading(false);
      }
    },
    [activityId]
  );

  useEffect(() => {
    setShowForm(false);
    setEmotionLevel(0);
    setGrade('');
    setCategory('ทั่วไป');
    setComment('');
    fetchFeedbacks(1);
  }, [fetchFeedbacks]);

  // เขียนได้เฉพาะช่วงที่กิจกรรมกำลังดำเนินการ (กติกาเดิมของระบบ)
  const now = new Date();
  const canWrite =
    now >= new Date(selectedActivity.startDate) && now <= new Date(selectedActivity.endDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emotionLevel || !grade || !comment.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'กรอกไม่ครบ',
        text: 'กรุณาให้คะแนน เลือกระดับการศึกษา และเขียนความคิดเห็น',
        confirmButtonText: 'ตกลง',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/student-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, grade, category, comment: comment.trim(), emotionLevel }),
      });
      const result = await res.json();
      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: 'ขอบคุณสำหรับความคิดเห็น!',
          confirmButtonText: 'ตกลง',
        });
        setShowForm(false);
        setEmotionLevel(0);
        setGrade('');
        setComment('');
        fetchFeedbacks(1);
        onSubmitted?.();
      } else {
        await Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: result.message, confirmButtonText: 'ตกลง' });
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      await Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่', confirmButtonText: 'ตกลง' });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900';

  return (
    <div className="mt-8 rounded-xl border border-slate-900/10 bg-white">
      {/* หัวกล่อง: ชื่อคอลัมน์ + ปุ่มเขียน */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
        <h3 className={`${promptFont.className} flex items-center gap-2 text-lg font-semibold text-slate-900`}>
          <span className="inline-block h-4 w-1.5 rounded-sm bg-amber-400" />
          เสียงจากผู้เข้าร่วม
        </h3>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className={`${promptFont.className} rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700`}
          >
            {showForm ? 'ปิดฟอร์ม' : '✎ เขียนความคิดเห็น'}
          </button>
        ) : (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
            ปิดรับความคิดเห็น (นอกช่วงกิจกรรม)
          </span>
        )}
      </div>

      {/* ฟอร์ม inline — ผูกกับกิจกรรมนี้โดยตรง ไม่ต้องเลือกกิจกรรมซ้ำ */}
      {showForm && canWrite && (
        <form
          onSubmit={handleSubmit}
          className="border-b border-dashed border-slate-200 bg-slate-50/60 px-5 py-5 sm:px-6"
          style={{ animation: 'fadeIn .3s ease-out both' }}
        >
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ความพึงพอใจของคุณ</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEmotionLevel(i)}
                  className={`text-3xl transition-transform hover:scale-110 ${
                    i <= emotionLevel ? 'text-amber-400' : 'text-slate-300'
                  }`}
                  aria-label={`${i} ดาว`}
                >
                  ★
                </button>
              ))}
              {emotionLevel > 0 && (
                <span className="ml-2 text-sm font-medium text-slate-600 tabular-nums">{emotionLevel}/5</span>
              )}
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">ระดับการศึกษา</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputClass} required>
                <option value="" disabled>— เลือก —</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">หมวดหมู่</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">ความคิดเห็น</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="เล่าความประทับใจหรือข้อเสนอแนะต่อกิจกรรมนี้..."
              className={inputClass}
              required
            />
            <p className="mt-1 text-right text-xs text-slate-400 tabular-nums">{comment.length}/500</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`${promptFont.className} rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50`}
          >
            {submitting ? 'กำลังส่ง...' : 'ส่งความคิดเห็น'}
          </button>
        </form>
      )}

      {/* รายการความคิดเห็น */}
      <div className="px-5 py-4 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="loading loading-spinner loading-md"></div>
          </div>
        ) : feedbacks.length > 0 ? (
          <>
            <ul className="divide-y divide-dashed divide-slate-200">
              {feedbacks.map((fb, i) => (
                <li key={fb._id} className="py-4" style={{ animation: 'fadeIn .4s ease-out both', animationDelay: `${i * 60}ms` }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Stars value={fb.emotionLevel} />
                      <span className="text-xs text-slate-500">{fb.grade}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(fb.createdAt).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{fb.comment}</p>
                  <span className="mt-2 inline-block rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500">
                    {fb.category}
                  </span>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className={`${promptFont.className} mt-2 flex items-center justify-center gap-4 border-t border-slate-200 pt-4 text-sm`}>
                <button
                  type="button"
                  onClick={() => fetchFeedbacks(page - 1)}
                  disabled={page === 1}
                  className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40"
                >
                  ← ก่อนหน้า
                </button>
                <span className="text-xs text-slate-400 tabular-nums">หน้า {page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => fetchFeedbacks(page + 1)}
                  disabled={page === totalPages}
                  className="font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40"
                >
                  ถัดไป →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-2xl">💬</p>
            <p className="mt-2 text-sm text-slate-500">
              ยังไม่มีความคิดเห็น{canWrite ? ' — เป็นคนแรกที่บอกเล่าความประทับใจ' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeedbackPanel;
