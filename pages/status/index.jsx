//page/status/index.jsx
import CardModalDetail from "@/components/CardModalDetail";
import { useEffect, useState, useMemo } from "react";
import useComplaintStore from "@/stores/useComplaintStore";
import CompletedCard from "@/components/CardCompleted";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import PageHeader from "@/components/PageHeader";
import TimeFilter from "@/components/TimeFilter";

const StatusPage = () => {
  const { complaints, fetchComplaints, isLoading } = useComplaintStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all');
  const itemsPerPage = 8; // แสดง 4 การ์ดต่อแถว (2x2 grid)
  const [modalData, setModalData] = useState(null);
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    fetchComplaints("ดำเนินการเสร็จสิ้น").then(() => {
      //console.log("✅ Complaints (done):", complaints);
    });
  }, []);

  // Fetch assignments for all complaints to get accurate completion dates
  useEffect(() => {
    const fetchAllAssignments = async () => {
      const assignmentPromises = complaints.map(async (complaint) => {
        try {
          const res = await fetch(`/api/assignments/by-complaint?complaintId=${complaint._id}`);
          const json = await res.json();
          if (json.success && json.data.length > 0) {
            return { complaintId: complaint._id, assignment: json.data[0] };
          }
        } catch (error) {
          console.error("Error fetching assignment for complaint:", complaint._id, error);
        }
        return { complaintId: complaint._id, assignment: null };
      });

      const results = await Promise.all(assignmentPromises);
      const assignmentsMap = {};
      results.forEach(({ complaintId, assignment }) => {
        assignmentsMap[complaintId] = assignment;
      });
      setAssignments(assignmentsMap);
    };

    if (complaints.length > 0) {
      fetchAllAssignments();
    }
  }, [complaints]);

  // Filter complaints based on time filter - ใช้การคำนวณเดียวกับ CompletedCard
  const filteredComplaints = useMemo(() => {
    if (selectedTimeFilter === 'all') {
      return complaints;
    }
    
    return complaints.filter(complaint => {
      // คำนวณระยะเวลาการประมวลผล (จากวันที่แจ้งปัญหาไปยังวันที่เสร็จสิ้น)
      // ใช้การคำนวณเดียวกับ CompletedCard component
      const startDate = new Date(complaint.createdAt); // วันที่แจ้งปัญหา (timestamp)
      
      // ใช้การคำนวณเดียวกับ CompletedCard: assignment?.completedAt || updatedAt || timestamp
      const assignment = assignments[complaint._id];
      const completionDate = new Date(
        assignment?.completedAt || complaint.completedAt || complaint.updatedAt || complaint.createdAt
      );
      
      const processingTimeHours = Math.floor((completionDate - startDate) / (1000 * 60 * 60));
      
      // ปรับการกรองตามช่วงเวลาที่ไม่ซ้อนทับกัน
      switch (selectedTimeFilter) {
        case '24h':
          return processingTimeHours <= 24; // ภายใน 24 ชม.
        case '2d':
          return processingTimeHours > 24 && processingTimeHours <= 48; // มากกว่า 1 วัน แต่ไม่เกิน 2 วัน
        case '3d':
          return processingTimeHours > 48 && processingTimeHours <= 72; // มากกว่า 2 วัน แต่ไม่เกิน 3 วัน
        case '7d':
          return processingTimeHours > 72 && processingTimeHours <= 168; // มากกว่า 3 วัน แต่ไม่เกิน 7 วัน
        case '15d':
          return processingTimeHours > 168 && processingTimeHours <= 360; // มากกว่า 7 วัน แต่ไม่เกิน 15 วัน
        case 'over15d':
          return processingTimeHours > 360; // มากกว่า 15 วันขึ้นไป
        default:
          return true; // 'all' case
      }
    });
  }, [complaints, selectedTimeFilter, assignments]);

  const paginatedComplaints = [...filteredComplaints]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTimeFilter]);

  return (
    <>
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <PageHeader
          icon="✅"
          title="รายงานการดำเนินการที่เสร็จสิ้น"
          subtitle="แสดงรายการปัญหาที่ได้รับการแก้ไขเรียบร้อยแล้ว"
        >
          {/* Time Filter */}
          <div className="mt-4">
            <TimeFilter
              selectedFilter={selectedTimeFilter}
              onFilterChange={setSelectedTimeFilter}
              className="justify-center"
            />
          </div>
        </PageHeader>

        {/* Loading State */}
        {isLoading && (
          <LoadingSpinner 
            size="lg" 
            text="กำลังโหลดรายการที่เสร็จสิ้น..." 
          />
        )}

        {/* Empty State */}
        {!isLoading && filteredComplaints.length === 0 && (
          <EmptyState
            icon="✅"
            title={selectedTimeFilter === 'all' ? "ยังไม่มีรายการที่เสร็จสิ้น" : "ไม่พบรายการในช่วงเวลาที่เลือก"}
            description={
              selectedTimeFilter === 'all' 
                ? "รายการปัญหาที่ได้รับการแก้ไขจะแสดงที่นี่"
                : "ลองเปลี่ยนช่วงเวลาหรือเลือก 'ทั้งหมด' เพื่อดูรายการทั้งหมด"
            }
          />
        )}

        {/* Complaints Grid */}
        {!isLoading && filteredComplaints.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-4 w-full">
              {paginatedComplaints.map((item, index) => (
                <div key={index} className="h-full">
                  <div onClick={() => setModalData(item)} className="cursor-pointer h-full flex flex-col">
                    <div className="flex-1">
                      <CompletedCard
                        complaintMongoId={item._id}
                        title={item.category}
                        timestamp={item.createdAt}
                        beforeImage={item.images?.[0]}
                        afterImage={item.images?.[1]}
                        problems={item.problems}
                        updatedAt={item.completedAt}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 mb-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredComplaints.length}
                currentItemsCount={paginatedComplaints.length}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      <CardModalDetail
        modalData={modalData}
        onClose={() => setModalData(null)}
      />
    </>
  );
};

export default StatusPage;
