"use client";

import { useEffect, useState } from "react";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { GOVERNORATES, GOVERNORATE_CITIES } from "@/lib/constants";
import { friendlyErrorMessage } from "@/lib/errorMessages";
import { logClientError } from "@/lib/errorLog";
import { withGracePeriod, getConnectionDiagnostics } from "@/lib/withGracePeriod";
import { verifyEmployerProfileSaved } from "@/lib/serverWriteVerify";
import FileUploadButton from "@/components/FileUploadButton";

type Props = {
  initialData?: any;
  onSaved: () => void;
};

export default function EmployerOnboardingForm({ initialData, onSaved }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [citySelect, setCitySelect] = useState("");
  const [cityOther, setCityOther] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [showCompanyNameDefault, setShowCompanyNameDefault] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoURL, setLogoURL] = useState("");
  const [logoStatus, setLogoStatus] = useState("");
  const [saving, setSaving] = useState(false);
  // بانر غير blocking بيبان لو الحفظ عدّى SAVE_TIMEOUT_MS ولسه شغال — نفس نمط PostJobTab.tsx
  // (شوف lib/withGracePeriod.ts). مبيتمسحش لوحده بعد فترة ثابتة، بيتقفل بس لما الحفظ يخلص
  // فعليًا (نجاح أو فشل حقيقي).
  const [slowSaveNotice, setSlowSaveNotice] = useState(false);

  useEffect(() => {
    if (!initialData) return;
    setCompanyName(initialData.companyName || "");
    setContactPerson(initialData.contactPerson || "");
    setPhone(initialData.phone || "");
    setIndustry(initialData.industry || "");
    setGovernorate(initialData.governorate || "");

    const savedCity = initialData.city || "";
    const cities = GOVERNORATE_CITIES[initialData.governorate || ""] || [];
    if (savedCity && !cities.includes(savedCity)) {
      setCitySelect("other");
      setCityOther(savedCity);
    } else {
      setCitySelect(savedCity);
    }

    setCompanySize(initialData.companySize || "");
    setShowCompanyNameDefault(!!initialData.showCompanyNameDefault);
    setLogoURL(initialData.logoURL || "");
  }, [initialData]);

  const cities = governorate ? GOVERNORATE_CITIES[governorate] || [] : [];
  const isEditMode = !!initialData;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);

    const finalCity = citySelect === "other" ? cityOther.trim() : citySelect;

    // بيانات الشركة العامة (قراءة عامة من صفحات الشركات) — من غير بيانات تواصل شخصية
    const data: any = {
      companyName,
      industry,
      governorate,
      city: finalCity,
      companySize,
      showCompanyNameDefault,
    };

    if (!isEditMode) {
      data.plan = "free";
      data.createdAt = serverTimestamp();
    }

    if (logoFile) {
      if (logoFile.size > 2 * 1024 * 1024) {
        alert("حجم الصورة أكبر من 2 ميجابايت. يرجى اختيار صورة أصغر.");
        setSaving(false);
        return;
      }
      try {
        setLogoStatus("جارٍ رفع الشعار...");
        const fileRef = ref(storage, `logos/${user.uid}/${logoFile.name}`);
        await uploadBytes(fileRef, logoFile);
        data.logoURL = await getDownloadURL(fileRef);
        setLogoStatus("تم رفع الشعار.");
      } catch (err) {
        console.error("Logo upload failed", err);
        setLogoStatus("تعذّر رفع الشعار. تم حفظ باقي البيانات بدونه.");
      }
    }

    try {
      // مستندين مستقلين (بيانات الشركة العامة + بيانات التواصل الشخصية في مستند فرعي محمي)
      // بنكتبهم في writeBatch واحد عشان يتسجلوا الاتنين مع بعض أو محدش يتسجل خالص — بدل
      // كتابتين متوازيتين مش ذريتين كانوا ممكن يسيبوا "شركة من غير بيانات تواصل" لو واحدة فشلت.
      // العملية كلها ملفوفة بـwithGracePeriod واحدة (نفس نمط PostJobTab.tsx، شوف
      // lib/withGracePeriod.ts) عشان لو الحفظ اتعلّق (شبكة عابرة) الزرار مايفضلش عالق على
      // "جاري الحفظ..." للأبد من غير أي رسالة.
      const batch = writeBatch(db);
      batch.set(doc(db, "employers", user.uid), data, { merge: true });
      batch.set(
        doc(db, "employers", user.uid, "private", "contact"),
        { contactPerson, phone },
        { merge: true }
      );
      // لو عدّت مهلة الـ60 ثانية، قبل ما نرفض بنتأكد من السيرفر هل الـbatch اتطبق فعلًا (الـack بس هو
      // اللي ضاع) — لو أيوه بنعتبرها نجاح عادي ونسجّل hard_timeout_recovered (شوف serverWriteVerify.ts).
      const saveStartedAt = Date.now();
      await withGracePeriod(batch.commit(), () => setSlowSaveNotice(true), async () => {
        const saved = await verifyEmployerProfileSaved(user.uid, {
          companyName: data.companyName,
          industry: data.industry,
          governorate: data.governorate,
          city: data.city,
          companySize: data.companySize,
          showCompanyNameDefault: data.showCompanyNameDefault,
          logoURL: data.logoURL,
        }, isEditMode ? "employer_profile_update" : "employer_profile_create");
        if (!saved) return null;
        logClientError("hard_timeout_recovered", undefined, {
          originalStep: isEditMode ? "employer_profile_update" : "employer_profile_create",
          elapsedMs: Date.now() - saveStartedAt,
          ...getConnectionDiagnostics(),
        });
        return { value: undefined };
      });
      setSlowSaveNotice(false);

      if (!isEditMode) {
        // هنا أول تسجيل مكتمل فعليًا لصاحب العمل (بعد ما يكمّل بيانات شركته)، مش عند أول
        // تسجيل دخول — ده مكان حدث CompleteRegistration الصح لـMeta Pixel بدل مكانه القديم
        // في page.tsx
        (window as any).fbq?.("track", "CompleteRegistration");
      }

      setSaving(false);
      onSaved();
    } catch (err) {
      console.error("Employer profile save failed", err);
      const isHardTimeout = err instanceof Error && err.message === "HARD_FAIL_TIMEOUT";
      logClientError(
        isEditMode ? "employer_profile_update" : "employer_profile_create",
        err,
        isHardTimeout ? getConnectionDiagnostics() : undefined
      );
      setSlowSaveNotice(false);
      setSaving(false);
      if (isHardTimeout) {
        alert(
          "تعذّر التأكد من حفظ البيانات بسبب مشكلة في الاتصال. تأكد من اتصال الإنترنت، ثم حدّث الصفحة قبل المحاولة مرة أخرى. إذا تم الحفظ بالفعل، ستظهر البيانات محدّثة بعد تحديث الصفحة."
        );
      } else {
        alert(friendlyErrorMessage(err, "employer"));
      }
    }
  }

  return (
    <div dir="rtl" style={{ maxWidth: 700, margin: "0 auto", padding: "30px 20px" }}>
      {slowSaveNotice && (
        <div
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            background: "#E8A33D",
            color: "#14213D",
            padding: "12px 22px",
            borderRadius: 10,
            fontSize: 14.5,
            fontWeight: 700,
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          يستغرق الحفظ وقتًا أطول من المعتاد، يرجى الانتظار...
        </div>
      )}

      <h2 style={{ fontSize: 22, marginBottom: 20 }}>
        {isEditMode ? "تعديل بيانات الشركة" : "بيانات الشركة"}
      </h2>

      <form onSubmit={handleSubmit}>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle}>اسم الشركة</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required style={inputStyle} />
            <div style={{ fontSize: 12.5, color: "#4A5568", marginTop: 6 }}>
              اسم الشركة مخفي عن الباحثين افتراضيًا، ولا يظهر إلا إذا اخترت إظهاره. يمكنك التحكم في هذا الإعداد أدناه أو لكل وظيفة على حدة.
            </div>
          </div>
          <div>
            <label style={labelStyle}>اسم مسؤول التواصل</label>
            <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required style={inputStyle} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>شعار الشركة (اختياري)</label>
            <FileUploadButton
              label="اختر صورة"
              accept="image/*"
              fileName={logoFile?.name || (logoURL ? "تم حفظ صورة بالفعل" : undefined)}
              onChange={setLogoFile}
            />
            <div style={{ fontSize: 12.5, color: "#4A5568", marginTop: 6 }}>
              {logoStatus || "صورة PNG أو JPG، بحد أقصى 2 ميجابايت"}
            </div>
          </div>

          <div>
            <label style={labelStyle}>رقم الهاتف</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required style={inputStyle} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>نبذة عن الشركة (اختياري)</label>
            <textarea
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="مجال عمل الشركة ونبذة مختصرة عنها"
              style={{ ...inputStyle, minHeight: 80 }}
            />
          </div>

          <div>
            <label style={labelStyle}>المحافظة</label>
            <select
              value={governorate}
              onChange={(e) => { setGovernorate(e.target.value); setCitySelect(""); }}
              required
              style={inputStyle}
            >
              <option value="">اختر المحافظة</option>
              {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>مدينة الشركة</label>
            <select value={citySelect} onChange={(e) => setCitySelect(e.target.value)} style={inputStyle}>
              <option value="">غير محدد</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="other">أخرى (أدخلها يدويًا)</option>
            </select>
          </div>
          {citySelect === "other" && (
            <div>
              <label style={labelStyle}>أدخل المدينة</label>
              <input type="text" value={cityOther} onChange={(e) => setCityOther(e.target.value)} placeholder="اسم المدينة/المنطقة" style={inputStyle} />
            </div>
          )}

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>حجم الشركة</label>
            <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} required style={inputStyle}>
              <option value="">اختر</option>
              <option value="under20">أقل من 20</option>
              <option value="20to100">من 20 إلى 100</option>
              <option value="100to500">من 100 إلى 500</option>
              <option value="500to1000">من 500 إلى 1000</option>
              <option value="over1000">أكثر من 1000</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              id="showCompanyNameDefaultCheck"
              checked={showCompanyNameDefault}
              onChange={(e) => setShowCompanyNameDefault(e.target.checked)}
            />
            <label htmlFor="showCompanyNameDefaultCheck" style={{ fontSize: 13.5 }}>
              أظهر اسم الشركة افتراضيًا في كل الوظائف الجديدة (يمكن تغييره لكل وظيفة على حدة)
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            width: "100%",
            padding: "14px",
            background: "#14213D",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            marginTop: 20,
          }}
        >
          {saving ? "جارٍ الحفظ..." : "حفظ بيانات الشركة"}
        </button>
      </form>
    </div>
  );
}

const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 };
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 4, fontSize: 13.5, fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 };