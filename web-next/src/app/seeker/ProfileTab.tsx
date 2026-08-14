"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import OnboardingForm from "./OnboardingForm";
import { MILITARY_STATUS_LABELS, SKILL_LEVELS, LANGUAGE_LEVELS } from "@/lib/constants";
import { normalizeEntries, formatEntries } from "@/lib/profileFields";
import ProfileCompletionBar from "@/components/ProfileCompletionBar";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import CVPreview from "@/components/CVPreview";

const EDUCATION_LABELS: Record<string, string> = {
  none: "بدون مؤهل دراسي",
  literacy: "محو أمية",
  primary: "ابتدائية",
  preparatory: "إعدادية",
  secondary: "ثانوية عامة / دبلوم",
  bachelor: "بكالوريوس/ليسانس",
  master: "ماجستير",
  phd: "دكتوراه",
};

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  remote: "عن بعد",
  freelance: "فريلانس",
  no_preference: "لا يوجد تفضيل",
};

type Props = {
  data: any;
  onUpdated: (newData: any) => void;
};

export default function ProfileTab({ data, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    window.print();
    const handleAfterPrint = () => setPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [printing]);

  if (editing) {
    return (
      <OnboardingForm
        initialData={data}
        onSaved={(newData) => onUpdated(newData)}
        onDone={() => setEditing(false)}
      />
    );
  }

  const skills = normalizeEntries(data.skills);
  const languages = normalizeEntries(data.languages);
  const completion = calculateProfileCompletion(data);

  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto", padding: "30px 20px" }}>
      <h2 style={{ marginBottom: 16 }}>بروفايلك متسجل ✅</h2>

      <ProfileCompletionBar percent={completion} />

      <div style={{ border: "1px solid #14213D22", borderRadius: 10, padding: 20 }}>
        {data.photoURL && (
          <img src={data.photoURL} alt="صورتك الشخصية" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%", marginBottom: 14 }} />
        )}
        <Row label="الاسم" value={data.fullName} />
        <Row label="رقم الموبايل" value={data.phone} />
        <Row label="البريد الإلكتروني" value={data.email} />
        <Row label="المحافظة" value={data.governorate} />
        <Row label="المدينة" value={data.city} />
        <Row label="المسمى الوظيفي" value={data.jobTitle} />
        <Row label="التخصص" value={data.specialization} />
        <Row label="سنوات الخبرة" value={data.yearsOfExperience?.toString()} />
        <Row label="المؤهل الدراسي" value={EDUCATION_LABELS[data.educationLevel] || data.educationLevel} />
        <Row label="نوع الدوام" value={JOB_TYPE_LABELS[data.jobType] || data.jobType} />
        {data.showSalaryToEmployers && data.expectedSalary && (
          <Row label="الراتب المتوقع" value={`${data.expectedSalary} جنيه`} />
        )}
        {skills.length > 0 && <Row label="المهارات" value={formatEntries(skills, SKILL_LEVELS)} />}
        {languages.length > 0 && <Row label="اللغات" value={formatEntries(languages, LANGUAGE_LEVELS)} />}
        {data.gender === "male" && data.militaryStatus && (
          <Row label="حالة التجنيد" value={MILITARY_STATUS_LABELS[data.militaryStatus] || data.militaryStatus} />
        )}
        {data.bio && <Row label="نبذة عنك" value={data.bio} />}
        {data.cvFileURL && (
          <div style={{ marginTop: 10 }}>
            <a href={data.cvFileURL} target="_blank" rel="noopener noreferrer" style={{ color: "#14213D" }}>
              📄 عرض السيرة الذاتية
            </a>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
        <button
          onClick={() => setEditing(true)}
          style={{
            padding: "12px 24px",
            background: "#14213D",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          تعديل البروفايل
        </button>
        <button
          onClick={() => setPrinting(true)}
          style={{
            padding: "12px 24px",
            background: "transparent",
            color: "#14213D",
            border: "1px solid #14213D",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          📄 اعمل CV احترافي واحفظه
        </button>
      </div>

      {/* بنعمل الطباعة portal لـdocument.body عشان يبقى sibling مباشر للهيدر والفوتر، مش
          متداخل جوه شجرة الصفحة العادية — لو فضل جوه شجرة الصفحة، إخفاء باقي العناصر
          بـvisibility بيسيب مساحتهم محجوزة في التخطيط ويطلع صفحة فاضية زيادة وقت الطباعة. */}
      {printing && typeof document !== "undefined" && createPortal(
        <div className="cv-print-view">
          <CVPreview data={data} skills={skills} languages={languages} />
        </div>,
        document.body
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10, fontSize: 14 }}>
      <span style={{ fontWeight: 700 }}>{label}: </span>
      <span>{value}</span>
    </div>
  );
}
