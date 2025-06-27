import React, { useEffect } from "react";
import Image from "next/image";
import { useHealthMenuStore } from "@/stores/useHealthMenuStore";
import { z } from "zod";
import Swal from "sweetalert2";
import LocationConfirm from "@/components/LocationConfirm";
import { useState } from "react";

export default function SpecialFormModal({ formData, setFormData, onClose }) {
  const { menu, fetchMenu } = useHealthMenuStore();

  // 🗺️  location state & toggle
  const [useCurrent, setUseCurrent] = useState(false);
  const [location, setLocation]   = useState(null);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const formSchema = z.object({
    name: z.string().min(1, "กรุณากรอกชื่อ"),
    phone: z.string().length(10, "เบอร์โทรต้องมี 10 หลัก"),
    equipment: z.string().min(1, "กรุณาเลือกอุปกรณ์"),
    reason: z.string().min(1, "กรุณากรอกเหตุผล"),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
  });

  return (
    <div className="fixed inset-0 bg-white/10 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 relative">
        <button
          className="absolute top-2 right-2 text-gray-500"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 className="text-lg font-semibold text-center text-pink-600">
          ลงทะเบียนกายอุปกรณ์
        </h2>

        <ul className="steps w-full justify-center mb-4 text-[10px] flex-wrap text-center leading-tight whitespace-nowrap overflow-x-auto px-1">
          <li className={`step ${formData.name ? "step-primary" : ""}`}>
            กรอกชื่อ
          </li>
          <li className={`step ${formData.phone ? "step-primary" : ""}`}>
            กรอกเบอร์โทร
          </li>
          <li className={`step ${formData.equipment ? "step-primary" : ""}`}>
            เลือกอุปกรณ์
          </li>
          <li className={`step ${formData.reason ? "step-primary" : ""}`}>
            เหตุผล
          </li>
          <li className={`step ${location ? "step-primary" : ""}`}>พิกัด</li>
        </ul>
        <label className="font-extrabold text-sm text-gray-600">
          ขั้นตอนที่ 1: ชื่อ-นามสกุล
        </label>
        <input
          type="text"
          placeholder="ชื่อ-นามสกุล"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`input input-bordered w-full ${
            formData.name ? "border-green-500" : ""
          }`}
        />

        <label className="font-extrabold text-sm text-gray-600">
          ขั้นตอนที่ 2: เบอร์โทร
        </label>
        <div className="flex gap-[2px] justify-center">
          {[...Array(10)].map((_, i) => (
            <input
              key={i}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className={`input input-bordered w-6 text-center text-xs p-0 ${
                formData.phone?.[i] ? "border-green-500" : ""
              }`}
              value={formData.phone?.[i] || ""}
              onChange={(e) => {
                const newChar = e.target.value.replace(/\D/, "");
                const updated = (formData.phone || "").split("");
                updated[i] = newChar;
                setFormData({ ...formData, phone: updated.join("") });

                if (newChar && e.target.nextElementSibling) {
                  e.target.nextElementSibling.focus();
                }
              }}
            />
          ))}
        </div>

        <label className="font-extrabold text-sm text-gray-600">
          ขั้นตอนที่ 3: อุปกรณ์ที่ต้องการ
        </label>
        <div className="flex flex-wrap gap-2 justify-center">
          {menu.map((item, index) => (
            <button
              key={item._id || item.label || index}
              className={`btn btn-sm rounded-full ${
                formData.equipment === item.label
                  ? "btn-success"
                  : "btn-outline"
              }`}
              onClick={() =>
                setFormData({ ...formData, equipment: item.label })
              }
              type="button"
            >
              <Image
                src={item.image_icon}
                alt={item.label || "icon"}
                width={24}
                height={24}
                className="mr-1"
              />
              {item.label}
            </button>
          ))}
        </div>

        <label className="font-extrabold text-sm text-gray-600">
          ขั้นตอนที่ 4: เหตุผลและความจำเป็น
        </label>
        <textarea
          placeholder="เหตุผลและความจำเป็น"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          className={`textarea textarea-bordered w-full ${
            formData.reason ? "border-green-500" : ""
          }`}
        />

        <label className="font-extrabold text-sm text-gray-600">
          ขั้นตอนที่ 5: ระบุพิกัด
        </label>
        <LocationConfirm
          useCurrent={useCurrent}
          onToggle={setUseCurrent}
          location={location}
          setLocation={setLocation}
          formSubmitted={false}
        />

        <div className="flex gap-2">
          <button
            className="btn btn-secondary flex-1"
            onClick={() => {
              setFormData({ name: "", phone: "", equipment: "", reason: "" });
              setLocation(null);
              setUseCurrent(false);
            }}
            type="button"
          >
            ล้างข้อมูล
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={async () => {
              const dataToValidate = { ...formData, location };
              if (!location) {
                Swal.fire({
                  icon: "warning",
                  title: "ข้อมูลไม่ครบ",
                  text: "ขั้นตอนที่ 5: กรุณาระบุตำแหน่งที่ตั้งของคุณ",
                });
                return;
              }

              const result = formSchema.safeParse(dataToValidate);
              if (!result.success) {
                const msg = result.error.errors
                  .map((err) => err.message)
                  .join("\n");
                Swal.fire({
                  icon: "warning",
                  title: "ข้อมูลไม่ครบ",
                  text: msg,
                });
                return;
              }

              try {
                const res = await fetch("/api/smart-health/ob-registration", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...formData, location, status: "รับคำร้อง" }),
                });

                if (res.ok) {
                  Swal.fire({
                    icon: "success",
                    title: "ส่งข้อมูลสำเร็จ",
                    text: "ขอบคุณสำหรับการลงทะเบียน",
                  });
                  await fetch("https://primary-production-a1769.up.railway.app/webhook/sm-health", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...formData, location, status: "รับคำร้อง" }),
                  });
                  onClose();
                  setFormData({ name: "", phone: "", equipment: "", reason: "" });
                  setLocation(null);
                  setUseCurrent(false);
                } else {
                  const data = await res.json();
                  Swal.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาด",
                    text: data.message || "ไม่สามารถส่งข้อมูลได้",
                  });
                }
              } catch (err) {
                console.error(err);
                Swal.fire({
                  icon: "error",
                  title: "เครือข่ายผิดพลาด",
                  text: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
                });
              }
            }}
            type="button"
          >
            ส่งคำร้อง
          </button>
        </div>
      </div>
    </div>
  );
}
