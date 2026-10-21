// modal บันทึก/แก้ผลวัดรายครั้งของ 1 คน — ใช้ทั้งแท็บการมาเรียน (คนที่ยังไม่มา) และโปรไฟล์ในทะเบียน
import React, { useEffect, useState } from "react";
import { parseBpText, parseNumberField, formatThaiDate } from "@/lib/elderly-school/followUp";
import { postJson } from "./useElderlyData";
import { ElderlyModal, Notice, btnCls, primaryBtnCls, inputCls, labelCls } from "./elderlyTheme";

function bpText(s, d) {
  return s && d ? `${s}/${d}` : "";
}

export default function VisitEditModal({ open, onClose, onSaved, person, yearBE, visitNo, visit, dateISO }) {
  const [form, setForm] = useState({ weightKg: "", waistCm: "", pulseBpm: "", bp1: "", bp2: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const v = visit || {};
    setForm({
      weightKg: v.weightKg ?? "",
      waistCm: v.waistCm ?? "",
      pulseBpm: v.pulseBpm ?? "",
      bp1: bpText(v.bp1Sys, v.bp1Dia),
      bp2: bpText(v.bp2Sys, v.bp2Dia),
    });
    setError("");
  }, [open, visit]);

  const save = async () => {
    const weightKg = parseNumberField(form.weightKg);
    const waistCm = parseNumberField(form.waistCm);
    const pulseBpm = parseNumberField(form.pulseBpm);
    if ([weightKg, waistCm, pulseBpm].includes(undefined)) {
      setError("น้ำหนัก รอบเอว และชีพจร ต้องเป็นตัวเลข");
      return;
    }
    const b1 = parseBpText(form.bp1);
    const b2 = parseBpText(form.bp2);
    if ((form.bp1.trim() && b1.sys === null) || (form.bp2.trim() && b2.sys === null)) {
      setError("ความดันต้องเป็นรูปแบบ ตัวบน/ตัวล่าง เช่น 120/80");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // POST = upsert ตาม person + ปี + ครั้งที่ (ทั้งสร้างใหม่และแก้ของเดิม)
      await postJson("/api/elderly-school/visits", {
        personId: person.personId,
        yearBE,
        visitNo,
        weightKg,
        waistCm,
        pulseBpm,
        bp1Sys: b1.sys,
        bp1Dia: b1.dia,
        bp2Sys: b2.sys,
        bp2Dia: b2.dia,
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, extra = {}) => (
    <label className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <input
        className={inputCls}
        value={form[key]}
        onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
        {...extra}
      />
    </label>
  );

  return (
    <ElderlyModal
      open={open}
      onClose={onClose}
      title={`ผลวัดครั้งที่ ${visitNo} · ${person?.fullName || ""}`}
      subtitle={`ปี ${yearBE}${dateISO ? ` · วันเรียน ${formatThaiDate(dateISO)}` : " · ยังไม่ตั้งวันเรียนของครั้งนี้"}`}
      footer={
        <>
          <button type="button" className={btnCls} onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving}>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Notice tone="see">{error}</Notice>}
        <div className="grid grid-cols-3 gap-3">
          {field("weightKg", "น้ำหนัก (กก.)", { inputMode: "decimal" })}
          {field("waistCm", "รอบเอว (ซม.)", { inputMode: "decimal" })}
          {field("pulseBpm", "ชีพจร", { inputMode: "numeric" })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("bp1", "ความดันรอบ 1", { placeholder: "120/80" })}
          {field("bp2", "ความดันรอบ 2", { placeholder: "120/80" })}
        </div>
      </div>
    </ElderlyModal>
  );
}
