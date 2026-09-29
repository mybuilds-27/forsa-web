"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { GOVERNORATES, GOVERNORATE_CITIES, MILITARY_STATUS_LABELS } from "@/lib/constants";
import FileUploadButton from "@/components/FileUploadButton";
import { h3Style, descStyle, gridStyle, labelStyle, inputStyle, saveBtnStyle, savedMsgStyle } from "./sharedStyles";
import { MISSING_BORDER_COLOR, MissingTag, useScrollToField, type ScrollTarget } from "./missingFieldUI";

type Props = {
  initialData: any;
  onSaved: (partial: any) => void;
  isNewProfile?: boolean;
  // من OnboardingForm.tsx — الحقول الناقصة حسب getMissingProfileFields (نفس شروط
  // calculateProfileCompletion) وطلب scroll لحقل بعينه (شوف missingFieldUI.tsx).
  missingKeys?: Set<string>;
  scrollTarget?: ScrollTarget;
};

export default function PersonalInfoTab({ initialData, onSaved, isNewProfile, missingKeys, scrollTarget }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(() => auth.currentUser?.email || "");
  const [gender, setGender] = useState("");
  const [militaryStatus, setMilitaryStatus] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoStatus, setPhotoStatus] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [citySelect, setCitySelect] = useState("");
  const [cityOther, setCityOther] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(initialData.fullName || "");
    setPhone(initialData.phone || "");
    setEmail(initialData.email || auth.currentUser?.email || "");
    setGender(initialData.gender || "");
    setMilitaryStatus(initialData.militaryStatus || "");
    setPhotoURL(initialData.photoURL || "");
    setGovernorate(initialData.governorate || "");

    const savedCity = initialData.city || "";
    const cities = GOVERNORATE_CITIES[initialData.governorate || ""] || [];
    if (savedCity && !cities.includes(savedCity)) {
      setCitySelect("other");
      setCityOther(savedCity);
    } else {
      setCitySelect(savedCity);
    }
  }, [initialData]);

  const cities = governorate ? GOVERNORATE_CITIES[governorate] || [] : [];

  useScrollToField(scrollTarget, "fullName");
  useScrollToField(scrollTarget, "phone");
  useScrollToField(scrollTarget, "email");
  useScrollToField(scrollTarget, "photoURL");
  useScrollToField(scrollTarget, "governorate");
  useScrollToField(scrollTarget, "city");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setSaved(false);

    const finalCity = citySelect === "other" ? cityOther.trim() : citySelect;

    const data: any = {
      fullName,
      phone,
      email,
      gender,
      militaryStatus: gender === "male" ? militaryStatus : "",
      governorate,
      city: finalCity,
      isAvailable: true,
      updatedAt: serverTimestamp(),
      ...(isNewProfile ? { consentToShare: true } : {}),
    };

    if (photoFile) {
      if (photoFile.size > 2 * 1024 * 1024) {
        alert("حجم الصورة أكبر من 2 ميجا — اختار صورة أصغر.");
        setSaving(false);
        return;
      }
      try {
        setPhotoStatus("جاري رفع الصورة...");
        const photoRef = ref(storage, `photos/${user.uid}/${photoFile.name}`);
        await uploadBytes(photoRef, photoFile);
        data.photoURL = await getDownloadURL(photoRef);
        setPhotoStatus("تم رفع الصورة ✓");
      } catch (err) {
        console.error("Photo upload failed", err);
        setPhotoStatus("حصلت مشكلة في رفع الصورة — اتحفظت باقي البيانات من غيرها");
      }
    }

    await setDoc(doc(db, "job_seekers", user.uid), data, { merge: true });

    setSaving(false);
    setSaved(true);
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={h3Style}>📋 البيانات الشخصية</h3>
      <p style={descStyle}>اسمك وبياناتك الأساسية اللي هتظهر لأصحاب الأعمال.</p>

      <div style={gridStyle}>
        <div id="field-fullName">
          <label style={labelStyle}>الاسم بالكامل{missingKeys?.has("fullName") && <MissingTag />}</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={{ ...inputStyle, ...(missingKeys?.has("fullName") && { border: `1.5px solid ${MISSING_BORDER_COLOR}` }) }}
          />
        </div>
        <div id="field-phone">
          <label style={labelStyle}>رقم الموبايل{missingKeys?.has("phone") && <MissingTag />}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{ ...inputStyle, ...(missingKeys?.has("phone") && { border: `1.5px solid ${MISSING_BORDER_COLOR}` }) }}
          />
        </div>
        <div id="field-email">
          <label style={labelStyle}>البريد الإلكتروني (اختياري){missingKeys?.has("email") && <MissingTag />}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            style={{ ...inputStyle, ...(missingKeys?.has("email") && { border: `1.5px solid ${MISSING_BORDER_COLOR}` }) }}
          />
        </div>
        <div>
          <label style={labelStyle}>النوع (اختياري)</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)} style={inputStyle}>
            <option value="">تفضّل عدم التحديد</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>
        {gender === "male" && (
          <div>
            <label style={labelStyle}>حالة التجنيد (اختياري)</label>
            <select value={militaryStatus} onChange={(e) => setMilitaryStatus(e.target.value)} style={inputStyle}>
              <option value="">تفضّل عدم التحديد</option>
              {Object.entries(MILITARY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}
        <div
          id="field-photoURL"
          style={{
            gridColumn: "1 / -1",
            ...(missingKeys?.has("photoURL") && {
              border: `1.5px solid ${MISSING_BORDER_COLOR}`,
              borderRadius: 8,
              padding: 10,
            }),
          }}
        >
          <label style={labelStyle}>صورة شخصية (اختياري){missingKeys?.has("photoURL") && <MissingTag />}</label>
          {photoURL && !photoFile && (
            <img src={photoURL} alt="صورتك الحالية" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "50%", marginBottom: 8, display: "block" }} />
          )}
          <FileUploadButton
            label="📷 اختيار صورة"
            accept="image/*"
            fileName={photoFile?.name || (photoURL ? "✓ صورة محفوظة بالفعل" : undefined)}
            onChange={setPhotoFile}
          />
          <div style={{ fontSize: 12.5, color: "#4A5568", marginTop: 6 }}>
            {photoStatus || "صورة PNG أو JPG، حد أقصى 2 ميجا"}
          </div>
        </div>
        <div id="field-governorate">
          <label style={labelStyle}>المحافظة{missingKeys?.has("governorate") && <MissingTag />}</label>
          <select
            value={governorate}
            onChange={(e) => { setGovernorate(e.target.value); setCitySelect(""); }}
            required
            style={{ ...inputStyle, ...(missingKeys?.has("governorate") && { border: `1.5px solid ${MISSING_BORDER_COLOR}` }) }}
          >
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div id="field-city">
          <label style={labelStyle}>المدينة/المنطقة (اختياري){missingKeys?.has("city") && <MissingTag />}</label>
          <select
            value={citySelect}
            onChange={(e) => setCitySelect(e.target.value)}
            style={{ ...inputStyle, ...(missingKeys?.has("city") && { border: `1.5px solid ${MISSING_BORDER_COLOR}` }) }}
          >
            <option value="">غير محدد</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="other">أخرى (اكتب بنفسك)</option>
          </select>
        </div>
        {citySelect === "other" && (
          <div>
            <label style={labelStyle}>اكتب المدينة</label>
            <input type="text" value={cityOther} onChange={(e) => setCityOther(e.target.value)} placeholder="اسم المدينة/المنطقة" style={inputStyle} />
          </div>
        )}
      </div>

      <button type="submit" disabled={saving} style={saveBtnStyle}>
        {saving ? "جاري الحفظ..." : "حفظ البيانات الشخصية"}
      </button>
      {saved && <div style={savedMsgStyle}>✓ اتحفظت البيانات</div>}
    </form>
  );
}
