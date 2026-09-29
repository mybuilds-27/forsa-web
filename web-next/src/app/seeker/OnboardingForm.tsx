"use client";

import { useRef, useState } from "react";
import ProfileCompletionBar from "@/components/ProfileCompletionBar";
import { calculateProfileCompletion, getMissingProfileFields, type MissingProfileField } from "@/lib/profileCompletion";
import PersonalInfoTab from "./profile-tabs/PersonalInfoTab";
import JobPreferencesTab from "./profile-tabs/JobPreferencesTab";
import ExperienceTab from "./profile-tabs/ExperienceTab";
import SkillsAndCVTab from "./profile-tabs/SkillsAndCVTab";
import AdditionalDetailsTab from "./profile-tabs/AdditionalDetailsTab";
import PrivacyTab from "./profile-tabs/PrivacyTab";

type Props = {
  initialData?: any;
  onSaved?: (newData: any) => void;
  onDone?: () => void;
  // من ProfileTab.tsx (زرار "كمّل دلوقتي" في Navbar.tsx) — قيمة جديدة مع كل دوسة. لما تتغيّر،
  // بنفتح تاب أول خانة ناقصة ونعمل scroll ليها تلقائي (شوف autoFocusNonce تحت).
  autoFocusNonce?: string | null;
};

type TabKey = "personal" | "job" | "experience" | "skills" | "additional" | "privacy";

// key بتاع الحقل المطلوب نعمله scroll إليه + nonce فريد لكل طلب (حتى لو نفس الحقل اتطلب تاني،
// الـnonce بيضمن useEffect بتاعة الـscroll في كل تاب فرعي تتنفذ تاني). string أو number: دوسة
// على لينك في "ناقصك:" بتستخدم Date.now() (جوه event handler، مسموح)، وautoFocusNonce التلقائي
// بيستخدم نفس نص الـnonce الجاي من Navbar.tsx (autoFocusNonce نفسه) بدل استدعاء Date.now()
// تاني أثناء الـrender (ممنوع — شوف التعليق عند seenAutoFocusNonce تحت).
type ScrollTarget = { key: string; nonce: string | number };

const TABS: { key: TabKey; label: string }[] = [
  { key: "personal", label: "📋 البيانات الشخصية" },
  { key: "job", label: "💼 البيانات الوظيفية" },
  { key: "experience", label: "🕑 الخبرات السابقة" },
  { key: "skills", label: "🛠️ المهارات والسيرة الذاتية" },
  { key: "additional", label: "⚙️ تفاصيل إضافية" },
  { key: "privacy", label: "🔒 الخصوصية" },
];

export default function OnboardingForm({ initialData, onSaved, onDone, autoFocusNonce }: Props) {
  const [data, setData] = useState<any>(initialData || {});
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [scrollTarget, setScrollTarget] = useState<ScrollTarget | null>(null);
  // مفيش initialData يعني ده أول مرة البروفايل بيتعمل فيها — أي تاب يتحفظ الأول بيحتاج
  // يحطّ consentToShare:true افتراضيًا. initialData ثابتة طول عمر الفورم لأن أول ما تاب
  // يتحفظ، loadProfile بيقفل الفورم ده تمامًا (يتستبدل بـProfileTab)، فمفيش خطر إعادة استخدام
  // العلم ده بالغلط على بروفايل موجود بالفعل.
  const isNewProfile = !initialData;

  function handleTabSaved(partial: any) {
    const merged = { ...data, ...partial };
    setData(merged);
    onSaved?.(merged);
  }

  const completion = calculateProfileCompletion(data);
  // نفس منطق calculateProfileCompletion بالظبط (getMissingProfileFields بتشترك في نفس شروط
  // كل حقل) — هنا بنعرف أنهي حقول بالتحديد ناقصة مش بس النسبة المجمّعة.
  const missingFields = getMissingProfileFields(data);
  const missingKeys = new Set(missingFields.map((f) => f.key));

  // عداد بسيط عبر ref بدل Date.now() — Date.now() استدعاء "غير نقي" (impure) ممنوع في أي
  // مكان ممكن يتنفذ وقت الـrender حسب قواعد React الجديدة، وclickNonceRef بيدّي نفس الغرض
  // (قيمة فريدة لكل دوسة، حتى لو نفس الحقل اتطلب تاني) من غير استدعاء impure.
  const clickNonceRef = useRef(0);

  function jumpToField(field: MissingProfileField) {
    clickNonceRef.current += 1;
    setActiveTab(field.tab);
    setScrollTarget({ key: field.key, nonce: clickNonceRef.current });
  }

  // تعديل state أثناء الـrender بدل useEffect ("Adjusting state when a prop changes") — نفس
  // نمط ProfileTab.tsx. autoFocusNonce بتتغيّر مع كل دوسة على "كمّل دلوقتي" في Navbar (سواء أول
  // ما الفورم اتفتح أو وهو مفتوح بالفعل)، فبنودّي لتاب أول خانة ناقصة ونعمل لها scroll. بنحط
  // القيم مباشرة (مش عبر jumpToField) لأن Date.now() جوّاها استدعاء غير نقي (impure) ممنوع
  // وقت الـrender — autoFocusNonce نفسه (جاي كـprop، اتحسب في onClick بتاع Navbar.tsx) كافي
  // كـnonce فريد هنا.
  const [seenAutoFocusNonce, setSeenAutoFocusNonce] = useState<string | null>(null);
  if (autoFocusNonce && autoFocusNonce !== seenAutoFocusNonce) {
    setSeenAutoFocusNonce(autoFocusNonce);
    const first = missingFields[0];
    if (first) {
      setActiveTab(first.tab);
      setScrollTarget({ key: first.key, nonce: autoFocusNonce });
    }
  }

  return (
    <div dir="rtl" style={{ maxWidth: 900, margin: "0 auto", padding: "30px 20px" }}>
      {onDone && (
        <button
          onClick={onDone}
          style={{
            background: "none",
            border: "none",
            fontSize: 13.5,
            fontWeight: 700,
            color: "#4A5568",
            cursor: "pointer",
            marginBottom: 10,
            padding: 0,
          }}
        >
          → رجوع لعرض البروفايل
        </button>
      )}
      <h2 style={{ fontSize: 22, marginBottom: 4 }}>
        {initialData ? "تعديل البروفايل" : "كمّل بيانات البروفايل"}
      </h2>
      <p style={{ color: "#4A5568", marginBottom: 18 }}>
        هتظهر البيانات دي لأصحاب الأعمال اللي بيفلتروا. كل قسم بتحفظه لوحده، وتقدر تكمّل الباقي في أي وقت.
      </p>

      <ProfileCompletionBar percent={completion} />

      {/* بتتحدّث لايف مع كل حفظ (missingFields محسوبة من data اللي بتتحدّث في handleTabSaved) —
          كل اسم لينك بيفتح تاب الحقل ده ويعمل له scroll (jumpToField)، بنفس شروط الاكتمال بالظبط
          (getMissingProfileFields). */}
      {missingFields.length > 0 && (
        <div
          style={{
            background: "rgba(232,163,61,0.12)",
            border: "1px solid #E8A33D66",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 18,
            fontSize: 13.5,
            color: "#8A570D",
            lineHeight: 1.9,
          }}
        >
          <strong>ناقصك: </strong>
          {missingFields.map((f, i) => (
            <span key={f.key}>
              <button
                type="button"
                onClick={() => jumpToField(f)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  font: "inherit",
                  color: "inherit",
                  fontWeight: 700,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
              {i < missingFields.length - 1 ? "، " : ""}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <nav style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 220px", maxWidth: 260 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setActiveTab(t.key); setScrollTarget(null); }}
              style={{
                textAlign: "right",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #14213D22",
                background: activeTab === t.key ? "#14213D" : "#fff",
                color: activeTab === t.key ? "#fff" : "#14213D",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div style={{ flex: "3 1 400px", minWidth: 280, border: "1px solid #14213D22", borderRadius: 10, padding: 20 }}>
          {activeTab === "personal" && (
            <PersonalInfoTab initialData={data} onSaved={handleTabSaved} isNewProfile={isNewProfile} missingKeys={missingKeys} scrollTarget={scrollTarget} />
          )}
          {activeTab === "job" && (
            <JobPreferencesTab initialData={data} onSaved={handleTabSaved} isNewProfile={isNewProfile} missingKeys={missingKeys} scrollTarget={scrollTarget} />
          )}
          {activeTab === "experience" && (
            <ExperienceTab initialData={data} onSaved={handleTabSaved} isNewProfile={isNewProfile} missingKeys={missingKeys} scrollTarget={scrollTarget} />
          )}
          {activeTab === "skills" && (
            <SkillsAndCVTab initialData={data} onSaved={handleTabSaved} isNewProfile={isNewProfile} missingKeys={missingKeys} scrollTarget={scrollTarget} />
          )}
          {activeTab === "additional" && <AdditionalDetailsTab initialData={data} onSaved={handleTabSaved} isNewProfile={isNewProfile} />}
          {activeTab === "privacy" && <PrivacyTab initialData={data} onSaved={handleTabSaved} />}
        </div>
      </div>
    </div>
  );
}
