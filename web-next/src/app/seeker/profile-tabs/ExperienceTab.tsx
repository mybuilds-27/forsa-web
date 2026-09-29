"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { h3Style, descStyle, gridStyle, labelStyle, inputStyle, ghostBtnStyle, saveBtnStyle, savedMsgStyle } from "./sharedStyles";
import { MISSING_BORDER_COLOR, MissingTag, useScrollToField, type ScrollTarget } from "./missingFieldUI";

type ExperienceRow = {
  company: string;
  jobTitle: string;
  fromDate: string;
  toDate: string;
  isCurrent: boolean;
  responsibilities: string;
};

type Props = {
  initialData: any;
  onSaved: (partial: any) => void;
  isNewProfile?: boolean;
  missingKeys?: Set<string>;
  scrollTarget?: ScrollTarget;
};

export default function ExperienceTab({ initialData, onSaved, isNewProfile, missingKeys, scrollTarget }: Props) {
  const [experience, setExperience] = useState<ExperienceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setExperience(initialData.workExperience || []);
  }, [initialData]);

  useScrollToField(scrollTarget, "workExperience");

  function addExperienceRow() {
    setExperience([
      ...experience,
      { company: "", jobTitle: "", fromDate: "", toDate: "", isCurrent: false, responsibilities: "" },
    ]);
  }

  function updateExperienceRow(index: number, field: keyof ExperienceRow, value: any) {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    setExperience(updated);
  }

  function removeExperienceRow(index: number) {
    setExperience(experience.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setSaved(false);

    const data: any = {
      workExperience: experience.filter((row) => row.company || row.jobTitle),
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
      <h3 style={h3Style}>🕑 الخبرات السابقة</h3>
      <p style={descStyle}>وظائفك السابقة، من الأحدث للأقدم.</p>

      {experience.map((row, i) => (
        <div key={i} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 14, marginBottom: 10, position: "relative" }}>
          <button type="button" onClick={() => removeExperienceRow(i)} style={{ position: "absolute", top: 10, left: 10, background: "none", border: "none", color: "#B03A14", cursor: "pointer" }}>
            ✕ حذف
          </button>
          <div style={gridStyle}>
            <div>
              <label style={labelStyle}>اسم الشركة</label>
              <input type="text" value={row.company} onChange={(e) => updateExperienceRow(i, "company", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>المسمى الوظيفي</label>
              <input type="text" value={row.jobTitle} onChange={(e) => updateExperienceRow(i, "jobTitle", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>من (شهر/سنة)</label>
              <input type="month" value={row.fromDate} onChange={(e) => updateExperienceRow(i, "fromDate", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>إلى (شهر/سنة)</label>
              <input type="month" value={row.toDate} disabled={row.isCurrent} onChange={(e) => updateExperienceRow(i, "toDate", e.target.value)} style={inputStyle} />
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  id={`current-${i}`}
                  checked={row.isCurrent}
                  onChange={(e) => {
                    updateExperienceRow(i, "isCurrent", e.target.checked);
                    if (e.target.checked) updateExperienceRow(i, "toDate", "");
                  }}
                />
                <label htmlFor={`current-${i}`} style={{ fontSize: 13 }}>لسه شغال هنا</label>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>أهم المسؤوليات</label>
              <textarea value={row.responsibilities} onChange={(e) => updateExperienceRow(i, "responsibilities", e.target.value)} placeholder="أهم المهام والإنجازات في الوظيفة دي..." style={{ ...inputStyle, minHeight: 60 }} />
            </div>
          </div>
        </div>
      ))}
      <div
        id="field-workExperience"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          ...(missingKeys?.has("workExperience") && {
            border: `1.5px solid ${MISSING_BORDER_COLOR}`,
            borderRadius: 8,
            padding: 6,
          }),
        }}
      >
        <button type="button" onClick={addExperienceRow} style={ghostBtnStyle}>+ إضافة خبرة سابقة</button>
        {missingKeys?.has("workExperience") && <MissingTag />}
      </div>

      <div>
        <button type="submit" disabled={saving} style={saveBtnStyle}>
          {saving ? "جاري الحفظ..." : "حفظ الخبرات"}
        </button>
        {saved && <div style={savedMsgStyle}>✓ اتحفظت البيانات</div>}
      </div>
    </form>
  );
}
