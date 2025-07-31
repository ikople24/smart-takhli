import React, { useState, useEffect } from 'react';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';

const FeedbackAnalysis = () => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isLoaded && (!user || user.publicMetadata?.role !== 'admin')) {
      router.push('/');
      return;
    }

    if (user?.publicMetadata?.role === 'admin') {
      fetchAnalysisData();
    }
  }, [user, isLoaded, router]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/student-feedback/analyze');
      if (!response.ok) {
        throw new Error('Failed to fetch analysis data');
      }
      const data = await response.json();
      console.log('Analysis data received:', data);
      setAnalysisData(data);
    } catch (error) {
      console.error('Error fetching analysis data:', error);
      setError('ไม่สามารถโหลดข้อมูลการวิเคราะห์ได้');
    } finally {
      setLoading(false);
    }
  };

  const getEmotionEmoji = (level) => {
    if (level >= 4.5) return '😊';
    if (level >= 3.5) return '🙂';
    if (level >= 2.5) return '😐';
    return '😞';
  };

  const getEmotionText = (level) => {
    if (level >= 4.5) return 'พอใจมาก';
    if (level >= 3.5) return 'พอใจ';
    if (level >= 2.5) return 'ปานกลาง';
    return 'ไม่พอใจ';
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-100 w-full min-w-[320px]">
        
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
        
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-100 w-full min-w-[320px]">
        
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">❌</div>
            <p className="text-gray-600">{error}</p>
            <button 
              onClick={fetchAnalysisData}
              className="btn btn-primary mt-4"
            >
              ลองใหม่
            </button>
          </div>
        </div>
       
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 w-full min-w-[320px]">
      
      <main className="flex-1 pb-16 px-4 pt-4 flex flex-col gap-4 w-full overflow-x-hidden">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 การวิเคราะห์ความคิดเห็นนักเรียน</h1>
          <p className="text-gray-600">สถิติและข้อมูลการวิเคราะห์ความคิดเห็นจากนักเรียนและนักศึกษา</p>
        </div>

        {analysisData && (
          <div className="space-y-8">
            {/* สรุปสถิติ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">ความคิดเห็นทั้งหมด</p>
                    <p className="text-2xl font-bold text-gray-900">{analysisData.totalComments || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-100 text-green-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">ความคิดเห็นที่จัดกลุ่ม</p>
                    <p className="text-2xl font-bold text-gray-900">{analysisData.groupedComments || 0}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">คะแนนเฉลี่ย</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analysisData.averageEmotionLevel ? analysisData.averageEmotionLevel.toFixed(1) : '0.0'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md border">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">อัตราการจัดกลุ่ม</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analysisData.groupingPercentage ? analysisData.groupingPercentage.toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* กลุ่มความคิดเห็นที่คล้ายกัน */}
            <div className="bg-white rounded-lg shadow-md border">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-800">🎯 กลุ่มความคิดเห็นที่คล้ายกัน</h2>
                <p className="text-gray-600 mt-1">ความคิดเห็นที่มีเนื้อหาคล้ายกันถูกจัดกลุ่มไว้ด้วยกัน</p>
              </div>
              <div className="p-6">
                {analysisData.similarGroups && analysisData.similarGroups.length > 0 ? (
                  <div className="space-y-4">
                    {analysisData.similarGroups.slice(0, 10).map((group, index) => (
                      <div key={group.id} className="bg-gray-50 p-4 rounded-lg border">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-semibold text-gray-800">กลุ่มที่ {index + 1}</h3>
                          <span className="text-sm text-gray-500">({group.comments.length} ความคิดเห็น)</span>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-gray-700 font-medium">ความคิดเห็นหลัก:</p>
                          <p className="text-gray-600 italic">"{group.mainComment}"</p>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {group.commonEmotionLevels && group.commonEmotionLevels.map((level, idx) => (
                            <span key={idx} className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center gap-1">
                              <span>{getEmotionEmoji(level.level)}</span>
                              <span>{getEmotionText(level.level)} ({level.count})</span>
                            </span>
                          ))}
                          {group.commonCategories && group.commonCategories.map((category, idx) => (
                            <span key={idx} className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                              {category.category} ({category.count})
                            </span>
                          ))}
                        </div>

                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                            ดูความคิดเห็นทั้งหมด ({group.comments.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {group.comments && group.comments.map((comment, idx) => (
                              <div key={idx} className="bg-white p-3 rounded border-l-4 border-blue-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">{getEmotionEmoji(comment.emotionLevel)}</span>
                                  <span className="text-sm text-gray-500">{comment.grade}</span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(comment.createdAt).toLocaleDateString('th-TH')}
                                  </span>
                                </div>
                                <p className="text-gray-700 text-sm">{comment.comment}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-400 text-4xl mb-4">📝</div>
                    <p className="text-gray-600">ยังไม่มีข้อมูลการวิเคราะห์</p>
                  </div>
                )}
              </div>
            </div>

            {/* สถิติคำที่ใช้บ่อย */}
            {analysisData.wordFrequency && Array.isArray(analysisData.wordFrequency) && analysisData.wordFrequency.length > 0 && (
              <div className="bg-white rounded-lg shadow-md border">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold text-gray-800">📈 คำที่ใช้บ่อย</h2>
                  <p className="text-gray-600 mt-1">คำที่นักเรียนใช้บ่อยในการแสดงความคิดเห็น</p>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap gap-2">
                    {analysisData.wordFrequency.slice(0, 20).map((word, index) => (
                      <span 
                        key={index} 
                        className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full"
                        style={{ fontSize: `${Math.max(12, 14 + word.count)}px` }}
                      >
                        {word.word} ({word.count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* สถิติตามเวลา */}
            {analysisData.timeStats && typeof analysisData.timeStats === 'object' && Object.keys(analysisData.timeStats).length > 0 && (
              <div className="bg-white rounded-lg shadow-md border">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold text-gray-800">⏰ สถิติตามเวลา</h2>
                  <p className="text-gray-600 mt-1">การกระจายของความคิดเห็นตามช่วงเวลา</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(analysisData.timeStats).map(([period, count]) => (
                      <div key={period} className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-lg font-bold text-gray-800">{count}</p>
                        <p className="text-sm text-gray-600">{period}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ปุ่ม Refresh */}
        <div className="mt-8 text-center">
          <button 
            onClick={fetchAnalysisData}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                กำลังโหลด...
              </>
            ) : (
              '🔄 รีเฟรชข้อมูล'
            )}
          </button>
        </div>
      </div>
      </main>
      
    </div>
  );
};

export default FeedbackAnalysis; 