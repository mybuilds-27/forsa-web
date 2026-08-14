"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { GOVERNORATES, SPECIALIZATION_OPTIONS } from "@/lib/constants";
import { friendlyErrorMessage } from "@/lib/errorMessages";
import { logClientError } from "@/lib/errorLog";
import { labelStyle, inputStyle, saveBtnStyle } from "./profile-tabs/sharedStyles";

type Props = {
  onSaved: () => void;
};

export default function QuickSignupForm({ onSaved }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [specSelect, setSpecSelect] = useState("");
  const [specOther, setSpecOther] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      // نادر جدًا — بيحصل بس لو التسجيل اتحفظ قبل ما جلسة Firebase تتحمّل بالكامل. من غير
      // الرسالة دي، الزرار كان بيعمل return صامت تمامًا من غير أي تفسير للمستخدم.
      setError("حصلت مشكلة في الجلسة — رجّع افتح الصفحة تاني وسجّل دخولك من جديد");
      logClientError("quick_signup_no_user");
      return;
    }

    setSaving(true);
    setError("");

    const specialization = specSelect === "other" ? specOther.trim() : specSelect;
    if (!specialization) {
      setError("اكتب التخصص أو اختاره من القايمة");
      setSaving(false);
      return;
    }

    try {
      await setDoc(doc(db, "job_seekers", user.uid), {
        fullName,
        phone,
        jobTitle,
        governorate,
        specialization,
        consentToShare: true,
        isAvailable: true,
        emailNotificationsEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // هنا أول تسجيل مكتمل فعليًا للباحث (بعد ما يكمّل بياناته)، مش عند أول تسجيل دخول —
      // ده مكان حدث CompleteRegistration الصح لـMeta Pixel بدل مكانه القديم في page.tsx
      (window as any).fbq?.("track", "CompleteRegistration");
      onSaved();
    } catch (err) {
      console.error("Quick signup save failed", err);
      logClientError("quick_signup_save", err);
      setError(friendlyErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div dir="rtl" style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>كمّل بياناتك الأساسية</h2>
      <p style={{ color: "#4A5568", marginBottom: 20 }}>
        5 حقول بس وتقدر تتصفح وتقدّم على الوظائف فورًا. تقدر تكمّل باقي بياناتك (الخبرات، المهارات، السيرة الذاتية) في أي وقت من بروفايلك.
      </p>

      <form onSubmit={handleSubmit} style={{ border: "1px solid #14213D22", borderRadius: 10, padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>الاسم بالكامل</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>رقم الموبايل</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>المسمى الوظيفي المطلوب</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            required
            placeholder="مثال: محاسب، مندوب مبيعات"
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>المحافظة</label>
          <select value={governorate} onChange={(e) => setGovernorate(e.target.value)} required style={inputStyle}>
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>التخصص</label>
          <select value={specSelect} onChange={(e) => setSpecSelect(e.target.value)} required style={inputStyle}>
            <option value="">اختر التخصص</option>
            {SPECIALIZATION_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="other">أخرى</option>
          </select>
          {specSelect === "other" && (
            <input
              type="text"
              value={specOther}
              onChange={(e) => setSpecOther(e.target.value)}
              required
              placeholder="مثال: تخصص نادر مش موجود في القايمة"
              style={{ ...inputStyle, marginTop: 8 }}
            />
          )}
        </div>

        {error && <div style={{ color: "#B03A14", marginBottom: 10, fontSize: 13.5 }}>{error}</div>}

        <button type="submit" disabled={saving} style={saveBtnStyle}>
          {saving ? "جاري الحفظ..." : "احفظ وابدأ التصفح"}
        </button>
      </form>
    </div>
  );
}
