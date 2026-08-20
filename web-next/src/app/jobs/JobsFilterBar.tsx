"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GOVERNORATES, SPECIALIZATION_OPTIONS } from "@/lib/constants";
import { JOB_TYPE_LABELS } from "@/lib/jobCardStyles";

const inputStyle: React.CSSProperties = {
  flex: "2 1 220px",
  padding: 10,
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = { ...inputStyle, flex: "1 1 150px" };

export default function JobsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");

  // بنعدّل الـURL مباشرة (مش form عادي) عشان الصفحة تفضل قابلة للفهرسة والمشاركة — كل
  // فلترة بتبقى رابط مستقل بدل ما تتخزن في state داخلي بس.
  function applyFilters(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `/jobs?${qs}` : "/jobs");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters({ q });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        padding: 16,
        background: "#fff",
        border: "1px solid #14213D22",
        borderRadius: 14,
        marginBottom: 20,
      }}
    >
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="دوّر عن وظيفة (مثال: محاسب، مبيعات...)"
        style={inputStyle}
      />
      <select
        value={searchParams.get("governorate") || ""}
        onChange={(e) => applyFilters({ governorate: e.target.value })}
        style={selectStyle}
      >
        <option value="">كل المحافظات</option>
        {GOVERNORATES.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
      <select
        value={searchParams.get("jobType") || ""}
        onChange={(e) => applyFilters({ jobType: e.target.value })}
        style={selectStyle}
      >
        <option value="">كل أنواع الدوام</option>
        {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <select
        value={searchParams.get("specialization") || ""}
        onChange={(e) => applyFilters({ specialization: e.target.value })}
        style={selectStyle}
      >
        <option value="">كل التخصصات</option>
        {SPECIALIZATION_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button
        type="submit"
        style={{
          flex: "1 1 100px",
          padding: 10,
          border: "none",
          borderRadius: 8,
          background: "#14213D",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        🔍 بحث
      </button>
    </form>
  );
}
