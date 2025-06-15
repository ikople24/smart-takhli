import React, { useEffect, useState } from "react";

export default function AddDataAdminPage() {
  const [oldData, setOldData] = useState([]);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem("adminOldDataPage");
    return saved ? parseInt(saved, 10) : 1;
  });
  const [selectedRow, setSelectedRow] = useState(null);
  const [submittedMappings, setSubmittedMappings] = useState(new Set());
  const [adminData, setAdminData] = useState([]);
  // Pagination state for adminData
  const [adminPage, setAdminPage] = useState(() => {
    const saved = localStorage.getItem("adminAssignedPage");
    return saved ? parseInt(saved, 10) : 1;
  });
  const adminItemsPerPage = 10;
  const adminTotalPages = Math.ceil(adminData.length / adminItemsPerPage);
  // Filter adminData by selectedRow.mappingId if present
  const filteredAdminData = selectedRow?.mappingId
    ? adminData.filter((item) => item.ref?.deta_smartapps === selectedRow.mappingId)
    : adminData;
  const paginatedAdminData = filteredAdminData.slice(
    (adminPage - 1) * adminItemsPerPage,
    adminPage * adminItemsPerPage
  );
  // เพิ่ม state สำหรับเลือกแถว admin
  const [selectedAdminRow, setSelectedAdminRow] = useState({});
  // Restore complaintId from localStorage if exists
  useEffect(() => {
    const savedComplaintId = localStorage.getItem("savedComplaintId");
    if (savedComplaintId) {
      setSelectedAdminRow((prev) => ({
        ...prev,
        complaintId: savedComplaintId,
      }));
    }
  }, []);
  useEffect(() => {
    fetch("/api/data-admin-takhli67")
      .then((res) => res.json())
      .then((data) => setAdminData(data))
      .catch((err) =>
        console.error("❌ Failed to fetch data_admin_takhli67:", err)
      );
  }, []);
  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(oldData.length / itemsPerPage));
  const paginatedData = oldData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    fetch("/api/data-old")
      .then((res) => res.json())
      .then((data) => {
        setOldData(
          data.sort((a, b) => {
            const toDate = (item) => {
              const thaiMonths = {
                มกราคม: "01",
                กุมภาพันธ์: "02",
                มีนาคม: "03",
                เมษายน: "04",
                พฤษภาคม: "05",
                มิถุนายน: "06",
                กรกฎาคม: "07",
                สิงหาคม: "08",
                กันยายน: "09",
                ตุลาคม: "10",
                พฤศจิกายน: "11",
                ธันวาคม: "12",
              };

              const day = String(item["วัน"] || "1").padStart(2, "0");
              const month = thaiMonths[item["เดือน"]?.trim()] || "01";
              const year = item["ปี"]
                ? String(parseInt(item["ปี"], 10) - 543)
                : "2000";
              return new Date(`${year}-${month}-${day}`);
            };
            return toDate(a) - toDate(b);
          })
        );
        if (data.length > 0) {
          const allKeys = Array.from(
            new Set(data.flatMap((item) => Object.keys(item)))
          );
          console.log("🧾 All unique keys:", allKeys);
        }
      })
      .catch((err) => console.error(err));

    // Fetch submitted mappings
    fetch("/api/test/submitted_mapping_log")
      .then((res) => res.json())
      .then((submitted) => {
        setSubmittedMappings(new Set(submitted.map((item) => item.mappingId)));
      })
      .catch((err) => console.error("Failed to fetch submitted mappings", err));

    // Restore currentPage and adminPage from localStorage
    const savedOldDataPage = localStorage.getItem("adminOldDataPage");
    if (savedOldDataPage) {
      setCurrentPage(parseInt(savedOldDataPage, 10));
    }
    const savedAdminAssignedPage = localStorage.getItem("adminAssignedPage");
    if (savedAdminAssignedPage) {
      setAdminPage(parseInt(savedAdminAssignedPage, 10));
    }
  }, []);

  // Save currentPage and adminPage to localStorage when they change
  useEffect(() => {
    localStorage.setItem("adminOldDataPage", currentPage);
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem("adminAssignedPage", adminPage);
  }, [adminPage]);

  return (
    <>
      <title>นำเข้าข้อมูล - Admin</title>
      <h1 className="text-2xl font-bold mb-4">จัดการนำเข้าข้อมูล Admin</h1>
      <div className="join mt-4 flex justify-center">
        <button
          className="join-item btn btn-sm"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage <= 1}
        >
          «
        </button>
        <span className="join-item btn btn-sm pointer-events-none">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="join-item btn btn-sm"
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage >= totalPages}
        >
          »
        </button>
      </div>
      {/* แสดงกราฟวงกลมความคืบหน้าการบันทึกข้อมูล */}
      {oldData.length > 0 && (
        <div className="w-full px-4 mb-4 flex justify-end">
          <div className="text-center">
            <div
              className="radial-progress bg-primary text-primary-content border-primary border-4"
              style={{
                "--value": Math.round(
                  (submittedMappings.size / oldData.length) * 100
                ),
              }}
              role="progressbar"
            >
              {Math.round((submittedMappings.size / oldData.length) * 100)}%
            </div>
            <div className="text-sm mt-1 text-gray-600">
              {submittedMappings.size}/{oldData.length} บันทึกแล้ว
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col lg:flex-row w-full">
        <div className="w-full lg:w-1/2 px-4">
          <div className=" text-2xl mb-4 font-semibold">ดึง data เก่า</div>
          {oldData.length > 0 && (
            <>
              <div className="mb-4 text-sm text-blue-600">
                <strong>หัวตาราง:</strong> mappingId, Comu_list, ประเภทปัญหา,
                ชื่อ-นามสกุล, location_in, เบอร์โทรผู้แจ้ง, รายละเอียดการแจ้ง,
                วันที่แจ้ง, รายการกดเลือก, Status_Manage, ภาพปัญหา1, ภาพปัญหา2
              </div>

              <div className="overflow-x-auto">
                <table className="table table-zebra text-sm min-w-[1024px]">
                  <thead>
                    <tr>
                      <th className="bg-base-200 text-left px-2 py-1">เลือก</th>
                      {[
                        "mappingId",
                        "Comu_list",
                        "ประเภทปัญหา",
                        "ชื่อ-นามสกุล",
                        "location_in",
                        "เบอร์โทรผู้แจ้ง",
                        "รายละเอียดการแจ้ง",
                        "วันที่แจ้ง",
                        "รายการกดเลือก",
                        "Status_Manage",
                        "ภาพปัญหา1",
                        "ภาพปัญหา2",
                      ].map((key) => (
                        <th
                          key={key}
                          className="bg-base-200 text-left px-2 py-1"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item, index) => (
                      <tr key={item._id || index}>
                        <td>
                          <button
                            disabled={submittedMappings.has(
                              item["mappingId"] ?? item["�� Row ID"]
                            )}
                            className="btn btn-xs btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() =>
                              setSelectedRow({
                                mappingId:
                                  item["mappingId"] ?? item["�� Row ID"],
                                community: item["Comu_list"],
                                category: item["ประเภทปัญหา"],
                                fullName: item["ชื่อ-นามสกุล"],
                                location: (() => {
                                  const [lat, lng] = (item["location_in"] ?? "")
                                    .split(",")
                                    .map(Number);
                                  return { lat: lat || 0, lng: lng || 0 };
                                })(),
                                phone: item["เบอร์โทรผู้แจ้ง"],
                                detail: item["รายละเอียดการแจ้ง"],
                                createdAt: (() => {
                                  const date = new Date(item["วันที่แจ้ง"]);
                                  return isNaN(date)
                                    ? ""
                                    : date.toISOString().slice(0, 16);
                                })(),
                                createdAtRaw: item["วันที่แจ้ง"],
                                completedAtRaw: item["วันที่ดำเนินการสำเร็จ"],
                                problems: item["รายการกดเลือก"],
                                status: item["Status_Manage"],
                                images: [
                                  item["ภาพปัญหา1"],
                                  item["ภาพปัญหา2"],
                                ].filter(Boolean),
                              })
                            }
                          >
                            เลือก
                          </button>
                          {submittedMappings.has(
                            item["mappingId"] ?? item["�� Row ID"]
                          ) && (
                            <span className="text-xs text-gray-400 ml-1">
                              (ส่งแล้ว)
                            </span>
                          )}
                        </td>
                        {[
                          "mappingId",
                          "Comu_list",
                          "ประเภทปัญหา",
                          "ชื่อ-นามสกุล",
                          "location_in",
                          "เบอร์โทรผู้แจ้ง",
                          "รายละเอียดการแจ้ง",
                          "วันที่แจ้ง",
                          "รายการกดเลือก",
                          "Status_Manage",
                          "ภาพปัญหา1",
                          "ภาพปัญหา2",
                        ].map((key) => (
                          <td key={key} className="px-2 py-1">
                            {String(item[key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="w-full lg:w-1/2 px-4 mt-8 lg:mt-0">
          <div className="text-xl font-semibold mb-4">นำเข้าข้อมูลApp ใหม่</div>
          <div className="mb-4 text-sm text-blue-600">
            <strong>หัวตาราง:</strong> �� Row ID ,community,category, fullName,
            location , phone, detail, createdAt, problems[], status, images[]
          </div>
          <div className="space-y-2">
            <div>
              <label className="text-sm">�� Row ID (ID Mapping)</label>
              <div className="bg-base-200 text-gray-500 px-2 py-1 rounded">
                {selectedRow?.mappingId || "ID Mapping"}
              </div>
            </div>
            <div>
              <label className="text-sm">community</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="community"
                value={selectedRow?.community || ""}
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, community: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">category</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="category"
                value={selectedRow?.category || ""}
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, category: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">fullName</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="fullName"
                value={selectedRow?.fullName || ""}
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, fullName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">location.lat</label>
              <input
                type="number"
                step="any"
                className="input input-bordered input-sm w-full"
                placeholder="latitude"
                value={selectedRow?.location?.lat ?? ""}
                onChange={(e) =>
                  setSelectedRow({
                    ...selectedRow,
                    location: {
                      ...selectedRow?.location,
                      lat: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm">location.lng</label>
              <input
                type="number"
                step="any"
                className="input input-bordered input-sm w-full"
                placeholder="longitude"
                value={selectedRow?.location?.lng ?? ""}
                onChange={(e) =>
                  setSelectedRow({
                    ...selectedRow,
                    location: {
                      ...selectedRow?.location,
                      lng: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className="text-sm">phone</label>
              <input
                type="tel"
                className="input input-bordered input-sm w-full"
                placeholder="phone"
                value={selectedRow?.phone || ""}
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">detail</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="detail"
                value={selectedRow?.detail || ""}
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, detail: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">
                createdAt{" "}
                {selectedRow?.createdAtRaw &&
                !isNaN(new Date(selectedRow.createdAtRaw))
                  ? `: (${new Date(selectedRow.createdAtRaw).toLocaleDateString(
                      "en-GB",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )})`
                  : ""}
              </label>
              {selectedRow?.createdAtRaw && (
                <div className="text-xs text-red-600 mb-1">
                  Raw: {selectedRow.createdAtRaw}
                </div>
              )}
              
              <input
                type="datetime-local"
                className="input input-bordered input-sm w-full"
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, createdAt: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">problems[]</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="problems[]"
                value={selectedRow?.problems || ""}
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, problems: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">status</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="status"
                value={selectedRow?.status || ""}
                onChange={(e) =>
                  setSelectedRow({ ...selectedRow, status: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm">images[]</label>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="images[]"
                value={selectedRow?.images?.join(", ") || ""}
                onChange={(e) =>
                  setSelectedRow({
                    ...selectedRow,
                    images: e.target.value.split(",").map((str) => str.trim()),
                  })
                }
              />
            </div>
          </div>
          <div className="pt-4">
            <button
              className="btn btn-success btn-sm"
              onClick={() => {
                if (!selectedRow) return alert("กรุณาเลือกแถวข้อมูลก่อน");

                const { createdAtRaw, mappingId, ...formDataWithoutId } =
                  selectedRow;

                // Convert createdAt from Thai Buddhist calendar (พ.ศ.) to Gregorian calendar (ค.ศ.) if needed
                formDataWithoutId.createdAt = (() => {
                  const raw = selectedRow.createdAt;
                  if (!raw) return "";
                  const dt = new Date(raw);
                  const year = dt.getFullYear();
                  if (year > 2400) dt.setFullYear(year - 543);
                  return dt.toISOString();
                })();
                // เพิ่ม mappingId เข้าไปใน formDataWithoutId
                formDataWithoutId.mappingId = mappingId;

                console.log("📝 Form data to be submitted:", formDataWithoutId);

                fetch("/api/submittedreports/submit-report", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(formDataWithoutId),
                })
                  .then((res) => res.json())
                  .then((data) => {
                    alert("บันทึกข้อมูลสำเร็จ");
                    console.log("🟢 บันทึกแล้ว:", data);
                    // Set complaintId to admin form after successful submission
                    const newComplaintId = data?.data?._id || data?.insertedId || "";
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      complaintId: newComplaintId,
                    }));
                    localStorage.setItem("savedComplaintId", newComplaintId);
                    // 🔄 ส่ง mappingId กับ _id ไปเก็บที่ test.submitted_mapping_log โดยตรง (ไม่ผ่าน API)
                    fetch("/api/mongo-direct-insert", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        collection: "submitted_mapping_log",
                        document: {
                          mappingId,
                          submit_id: data.data?._id || data.insertedId || null,
                          complaintId: data.complaintId || null,
                        },
                      }),
                    })
                      .then((res) => res.json())
                      .then((logRes) => {
                        console.log("📌 บันทึก Mapping สำเร็จ:", logRes);
                      })
                      .catch((logErr) => {
                        console.error("❌ บันทึก Mapping ล้มเหลว:", logErr);
                      });
                  })
                  .catch((err) => {
                    console.error("❌ บันทึกล้มเหลว:", err);
                    alert("เกิดข้อผิดพลาดในการบันทึก");
                  });
              }}
            >
              บันทึกข้อมูล
            </button>
          </div>
        </div>
      </div>

      <div className="divider mt-15">ส่วนล่าง</div>
      <div className="join mt-4 flex justify-center ">
        <button
          className="join-item btn btn-sm"
          onClick={() => setAdminPage((prev) => Math.max(prev - 1, 1))}
          disabled={adminPage <= 1}
        >
          «
        </button>
        <span className="join-item btn btn-sm pointer-events-none">
          Page {adminPage} of {adminTotalPages}
        </span>
        <button
          className="join-item btn btn-sm"
          onClick={() =>
            setAdminPage((prev) => Math.min(prev + 1, adminTotalPages))
          }
          disabled={adminPage >= adminTotalPages}
        >
          »
        </button>
      </div>
      <div className="w-full px-4 flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-1/2">
          <div className="bg-base-100 border border-base-300 rounded p-4">
            <div>
              <div className="text-xl font-semibold mb-4">
                ข้อมูลการดำเนินการ
              </div>
              <div className="mb-4 text-sm text-blue-600">
                <strong>ตาราง:</strong> data_admin_takhli67
              </div>
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="table table-zebra text-sm min-w-[768px]">
                <thead>
                  <tr>
                    <th className="bg-base-200 px-2 py-1 text-left">เลือก</th>
                    {[
                      "ref.deta_smartapps",
                      "รายการแก้ไข",
                      "Fix_detail",
                      "Fix_date",
                      "Fix_pic1",
                      "Fix_pic2",
                      "Fix_by_Admin",
                    ].map((key) => (
                      <th key={key} className="bg-base-200 px-2 py-1 text-left">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedAdminData.map((item, idx) => (
                    <tr key={item._id || idx}>
                      <td className="px-2 py-1">
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() =>
                            setSelectedAdminRow((prev) => ({
                              ...prev,
                              // complaintId: prev.complaintId, // preserve, do not overwrite
                              assignedAt: (() => {
                                const date = new Date(item.Fix_date);
                                return isNaN(date) ? "" : date.toISOString().slice(0, 16);
                              })(),
                              solution: item.รายการแก้ไข
                                ? item.รายการแก้ไข
                                    .split(/[,،؛]/)
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 0)
                                : [],
                              solutionImages: [
                                ...(item.Fix_pic1 ? [item.Fix_pic1.trim()] : []),
                                ...(item.Fix_pic2 ? [item.Fix_pic2.trim()] : []),
                              ],
                              completedAt: (() => {
                                const date = new Date(item.Fix_date);
                                return isNaN(date) ? "" : date.toISOString().slice(0, 16);
                              })(),
                              note: item.Fix_detail?.toString() || "",
                            }))
                          }
                        >
                          เลือก
                        </button>
                      </td>
                      <td className="px-2 py-1">
                        {item.ref?.deta_smartapps || "-"}
                      </td>
                      <td className="px-2 py-1">{item.รายการแก้ไข || "-"}</td>
                      <td className="px-2 py-1">{item.Fix_detail || "-"}</td>
                      <td className="px-2 py-1">{item.Fix_date || "-"}</td>
                      <td className="px-2 py-1">{item.Fix_pic1 || "-"}</td>
                      <td className="px-2 py-1">{item.Fix_pic2 || "-"}</td>
                      <td className="px-2 py-1">{item.Fix_by_Admin || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-1/2">
            <div className="bg-base-100 border border-base-300 rounded p-4 space-y-2 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-4">
              <div className="text-lg font-medium">ฟอร์มบันทึกผลการดำเนินการ</div>
              <div>
                <label className="text-sm">complaintId</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="complaintId"
                  value={selectedAdminRow?.complaintId || ""}
                  onChange={(e) =>
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      complaintId: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                {/* Quick select userId buttons */}
                <div className="flex gap-2 mb-1">
                  <button
                    className="btn btn-xs btn-outline"
                    onClick={() =>
                      setSelectedAdminRow((prev) => ({
                        ...prev,
                        userId: "684a9a0140c6ae493e5b3392",
                      }))
                    }
                  >
                    กองช่าง
                  </button>
                  <button
                    className="btn btn-xs btn-outline"
                    onClick={() =>
                      setSelectedAdminRow((prev) => ({
                        ...prev,
                        userId: "684e64b940c6ae493e5b3473",
                      }))
                    }
                  >
                    ส่วนกลาง
                  </button>
                </div>
                <label className="text-sm">userId</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="userId (MongoDB ObjectId)"
                  value={selectedAdminRow?.userId || ""}
                  onChange={(e) =>
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      userId: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm">Assigned At</label>
                <input
                  type="datetime-local"
                  className="input input-bordered input-sm w-full"
                  onChange={(e) =>
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      assignedAt: e.target.value,
                    }))
                  }
                  value={selectedAdminRow?.assignedAt || ""}
                />
              </div>
              <div>
                <label className="text-sm">Solution</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="คำอธิบายแนวทางการแก้ไข (คั่นด้วย ,)"
                  value={selectedAdminRow?.solution?.join(", ") || ""}
                  onChange={(e) =>
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      solution: e.target.value.split(",").map((s) => s.trim()),
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm">Solution Images</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="URL รูปภาพ (คั่นด้วย ,)"
                  value={selectedAdminRow?.solutionImages?.join(", ") || ""}
                  onChange={(e) =>
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      solutionImages: [e.target.value.trim()],
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm">Completed At</label>
                {selectedRow?.completedAtRaw && (
                <div className="text-xs text-green-600 mb-1">
                  Rawวันที่ปิดงาน: {selectedRow.completedAtRaw}
                </div>
              )}
                <input
                  type="datetime-local"
                  className="input input-bordered input-sm w-full"
                  onChange={(e) =>
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      completedAt: e.target.value,
                    }))
                  }
                  value={selectedAdminRow?.completedAt || ""}
                />
              </div>
              <div>
                <label className="text-sm">Note</label>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  placeholder="หมายเหตุ"
                  value={selectedAdminRow?.note || ""}
                  onChange={(e) =>
                    setSelectedAdminRow((prev) => ({
                      ...prev,
                      note: e.target.value,
                    }))
                  }
                />
              </div>
              {/* Save button for admin form */}
              <div className="pt-4">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => {
                    if (!selectedAdminRow || !selectedRow?.mappingId) {
                      return alert("กรุณาเลือกข้อมูลจากตารางด้านบนก่อน");
                    }

                    const formData = {
                      mappingId: selectedRow.mappingId,
                      complaintId: selectedAdminRow.complaintId,
                      userId: selectedAdminRow.userId,
                      assignedAt: (() => {
                        const raw = selectedAdminRow.assignedAt;
                        if (!raw) return null;
                        const dt = new Date(raw);
                        const year = dt.getFullYear();
                        if (year > 2400) dt.setFullYear(year - 543);
                        return isNaN(dt.getTime()) ? null : dt.toISOString();
                      })(),
                      completedAt: (() => {
                        const raw = selectedAdminRow.completedAt;
                        if (!raw) return null;
                        const dt = new Date(raw);
                        const year = dt.getFullYear();
                        if (year > 2400) dt.setFullYear(year - 543);
                        return isNaN(dt.getTime()) ? null : dt.toISOString();
                      })(),
                      solution: typeof selectedAdminRow.solution === "string"
                        ? selectedAdminRow.solution
                            .split(/[,،؛]/)
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0)
                        : Array.isArray(selectedAdminRow.solution)
                        ? selectedAdminRow.solution
                        : [],
                      solutionImages: typeof selectedAdminRow.solutionImages === "string"
                        ? selectedAdminRow.solutionImages.split(",").map((s) => s.trim()).filter(Boolean)
                        : Array.isArray(selectedAdminRow.solutionImages)
                        ? selectedAdminRow.solutionImages
                        : [],
                      note: selectedAdminRow.note?.toString() || "",
                    };

                    console.log("📝 Admin formData:", formData);

                    fetch("/api/assignments/create", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(formData),
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        alert("บันทึกผลการดำเนินการสำเร็จ");
                        console.log("✅ บันทึก admin row:", data);
                      })
                      .catch((err) => {
                        console.error("❌ บันทึกล้มเหลว:", err);
                        alert("เกิดข้อผิดพลาดในการบันทึกผลการดำเนินการ");
                      });
                  }}
                >
                  บันทึกผลการดำเนินการ
                </button>
              </div>
            </div>
        </div>
      </div>
    </>
  );
}
