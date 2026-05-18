import { useEffect, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import CardModalDetail from '@/components/CardModalDetail';

export default function SatisfactionCommentsPanel({
  complaints = [],
  contentExpanded = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalComplaint, setModalComplaint] = useState(null);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/satisfaction/recent-comments?limit=8');
        const json = await res.json();
        if (json.success) {
          setItems(json.data || []);
        }
      } catch (error) {
        console.error('Error fetching satisfaction comments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, []);

  const resolveComplaint = (item) => {
    const id = item.complaintId?.toString();
    if (!id) return null;

    const fromStore = complaints.find((c) => c._id?.toString() === id);
    if (fromStore) return fromStore;

    if (item.complaint) return item.complaint;

    return null;
  };

  const openComplaintModal = (item) => {
    const complaint = resolveComplaint(item);
    if (complaint) {
      setModalComplaint(complaint);
    }
  };

  const contentMaxClass = contentExpanded ? 'max-h-[400px]' : 'max-h-48';

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800">ความคิดเห็น</h3>
          </div>
          {!loading && (
            <span className="text-xs text-gray-500">{items.length} รายการ</span>
          )}
        </div>

        <div className={`transition-all duration-300 ease-out overflow-hidden ${contentMaxClass}`}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-sm text-amber-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
              <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">ยังไม่มีความคิดเห็น</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {items.map((item) => {
                const complaint = resolveComplaint(item);
                const title =
                  complaint?.detail?.slice(0, 60) ||
                  complaint?.category ||
                  'เรื่องร้องเรียน';
                const canOpen = !!complaint;

                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => openComplaintModal(item)}
                    disabled={!canOpen}
                    className={`w-full text-left rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 transition-colors ${
                      canOpen
                        ? 'hover:bg-amber-50 hover:border-amber-200 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${
                              star <= item.rating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                            })
                          : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
                      {item.comment}
                    </p>
                    {complaint && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate">
                        {title}
                        {complaint.detail && complaint.detail.length > 60 ? '…' : ''}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <CardModalDetail
        modalData={modalComplaint}
        onClose={() => setModalComplaint(null)}
      />
    </>
  );
}
