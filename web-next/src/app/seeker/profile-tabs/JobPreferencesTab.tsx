"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { SPECIALIZATION_OPTIONS, EXPERIENCE_LEVELS } from "@/lib/constants";
import KeywordsPicker from "@/components/KeywordsPicker";
import { h3Style, descStyle, gridStyle, labelStyle, inputStyle, saveBtnStyle, savedMsgStyle } from "./sharedStyles";

type Props = {
  initialData: any;
  onSaved: (partial: any) => void;
  isNewProfile?: boolean;
};

export default function JobPreferencesTab({ initialData, onSaved, isNewProfile }: Props) {
  const [jobTitle, setJobTitle] = useState("");
  const [specSelect, setSpecSelect] = useState("");
  const [specOther, setSpecOther] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [jobType, setJobType] = useState("");
  const [jobLevel, setJobLevel] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [showSalary, setShowSalary] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setJobTitle(initialData.jobTitle || "");
    const savedSpec = initialData.specialization || "";
    if (savedSpec && !SPECIALIZATION_OPTIONS.includes(savedSpec)) {
      setSpecSelect("other");
      setSpecOther(savedSpec);
    } else {
      setSpecSelect(savedSpec);
    }
    setYearsOfExperience(initialData.yearsOfExperience?.toString() || "");
    setEducationLevel(initialData.educationLevel || "");
    setJobType(initialData.jobType || "");
    setJobLevel(initialData.jobLevel || "");
    setExpectedSalary(initialData.expectedSalary?.toString() || "");
    setShowSalary(!!initialData.showSalaryToEmployers);
    setKeywords(Array.isArray(initialData.keywords) ? initialData.keywords : []);
  }, [initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setSaved(false);

    const finalSpecialization = specSelect === "other" ? specOther.trim() : specSelect;

    const data: any = {
      jobTitle,
      specialization: finalSpecialization,
      yearsOfExperience: Number(yearsOfExperience || 0),
      educationLevel,
      jobType,
      jobLevel,
      expectedSalary: expectedSalary ? Number(expectedSalary) : null,
      showSalaryToEmployers: showSalary,
      keywords,
      updatedAt: serverTimestamp(),
      ...(isNewProfile ? { consentToShare: true } : {}),
    };

    await setDoc(doc(db, "job_seekers", user.uid), data, { merge: true });

    setSaving(false);
    setSaved(true);
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={h3Style}>💼 البيانات الوظيفية</h3>
      <p style={descStyle}>نوع الوظيفة اللي بتدوّر عليها ومتطلباتها.</p>

      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>المسمى الوظيفي المطلوب</label>
          <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required placeholder="مثال: محاسب، مندوب مبيعات" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>التخصص (اختياري)</label>
          <select value={specSelect} onChange={(e) => setSpecSelect(e.target.value)} style={inputStyle}>
            <option value="">اختر التخصص</option>
            {SPECIALIZATION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="other">أخرى</option>
          </select>
        </div>
        {specSelect === "other" && (
          <div>
            <label style={labelStyle}>اكتب تخصصك</label>
            <input type="text" value={specOther} onChange={(e) => setSpecOther(e.target.value)} placeholder="مثال: تخصص نادر مش موجود في القايمة" style={inputStyle} />
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>الكلمات المفتاحية (اختياري) — بتساعدنا نرشّحلك وظايف مناسبة أكتر</label>
          <KeywordsPicker value={keywords} onChange={setKeywords} />
        </div>
        <div>
          <label style={labelStyle}>سنوات الخبرة (اختياري)</label>
          <input type="number" min="0" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>المؤهل الدراسي (اختياري)</label>
          <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} style={inputStyle}>
            <option value="">تفضّل عدم التحديد</option>
            <option value="none">بدون مؤهل دراسي</option>
            <option value="literacy">محو أمية</option>
            <option value="primary">ابتدائية</option>
            <option value="preparatory">إعدادية</option>
            <option value="secondary">ثانوية عامة / دبلوم</option>
            <option value="bachelor">بكالوريوس/ليسانس</option>
            <option value="master">ماجستير</option>
            <option value="phd">دكتوراه</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>نوع الدوام المطلوب (اختياري)</label>
          <select value={jobType} onChange={(e) => setJobType(e.target.value)} style={inputStyle}>
            <option value="">تفضّل عدم التحديد</option>
            <option value="full_time">دوام كامل</option>
            <option value="part_time">دوام جزئي</option>
            <option value="remote">عن بعد</option>
            <option value="freelance">فريلانس</option>
            <option value="no_preference">لا يوجد تفضيل</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>مستوى الوظيفة المطلوب (اختياري)</label>
          <select value={jobLevel} onChange={(e) => setJobLevel(e.target.value)} style={inputStyle}>
            <option value="">تفضّل عدم التحديد</option>
            {Object.entries(EXPERIENCE_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>الراتب المتوقع (اختياري)</label>
          <input type="number" min="0" value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} style={inputStyle} />
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" id="showSalaryCheck" checked={showSalary} onChange={(e) => setShowSalary(e.target.checked)} />
            <label htmlFor="showSalaryCheck" style={{ fontSize: 13.5 }}>أظهر الحد الأدنى للمرتب لأصحاب الأعمال</label>
          </div>
        </div>
      </div>

      <button type="submit" disabled={saving} style={saveBtnStyle}>
        {saving ? "جاري الحفظ..." : "حفظ البيانات الوظيفية"}
      </button>
      {saved && <div style={savedMsgStyle}>✓ اتحفظت البيانات</div>}
    </form>
  );
}
