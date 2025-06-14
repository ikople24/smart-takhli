import React, { useEffect, useState } from "react";

export default function AddDataAdminPage() {
  const [oldData, setOldData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);
  const [submittedMappings, setSubmittedMappings] = useState(new Set());
  const [adminData, setAdminData] = useState([]);
  // Pagination state for adminData
  const [adminPage, setAdminPage] = useState(1);
  const adminItemsPerPage = 10;
  const adminTotalPages = Math.ceil(adminData.length / adminItemsPerPage);
  const paginatedAdminData = adminData.slice(
    (adminPage - 1) * adminItemsPerPage,
    adminPage * adminItemsPerPage
  );
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
                "มกราคม": "01",
                "กุมภาพันธ์": "02",
                "มีนาคม": "03",
                "เมษายน": "04",
                "พฤษภาคม": "05",
                "มิถุนายน": "06",
                "กรกฎาคม": "07",
                "สิงหาคม": "08",
                "กันยายน": "09",
                "ตุลาคม": "10",
                "พฤศจิกายน": "11",
                "ธันวาคม": "12",
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
  }, []);

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
                            disabled={submittedMappings.has(item["mappingId"] ?? item["�� Row ID"])}
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
                          {submittedMappings.has(item["mappingId"] ?? item["�� Row ID"]) && (
                            <span className="text-xs text-gray-400 ml-1">(ส่งแล้ว)</span>
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
                <div className="text-xs text-gray-500 mb-1">
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
        <div className="w-full lg:w-1/2 px-4 mt-8 lg:mt-0">
          <div className="text-xl font-semibold mb-4">ข้อมูลการดำเนินการ</div>
          <div className="mb-4 text-sm text-blue-600">
            <strong>ตาราง:</strong> data_admin_takhli67
          </div>
          <div className="join mt-4 flex justify-center">
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
                onClick={() => setAdminPage((prev) => Math.min(prev + 1, adminTotalPages))}
                disabled={adminPage >= adminTotalPages}
              >
                »
              </button>
            </div>
          <div className="overflow-x-auto mt-2">
            <table className="table table-zebra text-sm min-w-[768px]">
              <thead>
                <tr>
                  {[
                    "ref.deta_smartapps",
                    "ref.จากการแก้ไข",
                    "ref.Fix_detail",
                    "ref.Fix_date",
                    "ref.Fix_pic1",
                    "ref.Fix_by_Admin"
                  ].map((key) => (
                    <th key={key} className="bg-base-200 px-2 py-1 text-left">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedAdminData.map((item, idx) => (
                  <tr key={item._id || idx}>
                    <td className="px-2 py-1">{item.ref?.deta_smartapps || "-"}</td>
                    <td className="px-2 py-1">{item.รายการแก้ไข || "-"}</td>
                    <td className="px-2 py-1">{item.Fix_detail || "-"}</td>
                    <td className="px-2 py-1">{item.Fix_date || "-"}</td>
                    <td className="px-2 py-1">{item.Fix_pic1 || "-"}</td>
                    <td className="px-2 py-1">{item.Fix_by_Admin || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
          </div>
        </div>
    </>
  );
}
