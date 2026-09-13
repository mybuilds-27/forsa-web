"use client";

import { useEffect, useRef, useState } from "react";
import { KEYWORD_OPTIONS } from "@/lib/constants";
import { getKeywordUsageCounts } from "@/lib/keywordUsage";

// حد أقصى 8 كلمات مفتاحية — قايمة أطول من كده هتفقد الغرض منها (تحديد دقيق لمهارات/مجالات
// الباحث أو الوظيفة)، ومهمة للمطابقة في "وظائف موصى بيها ليك" (JobsTab.tsx).
export const MAX_KEYWORDS = 8;

// نفس شكل الـinput/select boxes التانية في نفس الفورمات (زي "نوع الدوام"/"التخصص" في
// PostJobTab.tsx وJobPreferencesTab.tsx) — نفس القيم بالظبط (padding 8، حدود #ccc، radius 6).
const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
};

// أعلى عدد نتائج بتتعرض في القايمة دفعة واحدة (بحث أو تصفح افتراضي) — كافي عمليًا وبيمنع
// قايمة طويلة أوي تحتاج scroll جوّاني كبير.
const MAX_RESULTS = 15;

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

// تجربة بحث نصي حي (combobox بسيط بمكونات React أساسية، من غير أي مكتبة خارجية — مفيش
// react-select ولا أي مكتبة مشابهة متبّتة في المشروع أصلًا، ومطلوب ده كان أبسط حل يحقق
// المطلوب) بدل القايمة المنسدلة المقسّمة بفئات القديمة. الكتابة بتفلتر KEYWORD_OPTIONS
// (القايمة المسطّحة الكاملة) فورًا، والنتائج مرتبة بالأكتر استخدامًا فعليًا (usageCounts) —
// لو الحقل فاضي بيوريك افتراضيًا أعلى الكلمات استخدامًا كنقطة بداية للتصفح من غير كتابة.
// نفس تجربة الاختيار مستخدمة في بروفايل الباحث (JobPreferencesTab.tsx) وفورم نشر الوظيفة
// (PostJobTab.tsx).
export default function KeywordsPicker({ value, onChange }: Props) {
  const [searchText, setSearchText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  // {} في أول render (قبل ما القراءة تخلص) — الترتيب بيرجع للأصلي تلقائيًا لحد ما القيم
  // توصل، من غير أي حالة تحميل خاصة أو flicker مزعج.
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getKeywordUsageCounts().then(setUsageCounts);
  }, []);

  useEffect(() => {
    // composedPath() بدل contains(e.target): بعد اختيار كلمة، الـre-render بيشيل الـ<div> بتاعها
    // من نتائج القايمة فورًا (عشان اتضافت لـvalue)، فبيبقى detached من الشجرة وقت ما الحدث
    // يوصل للـdocument — contains(e.target) كانت بترجع false غلط في الحالة دي وتقفل القايمة
    // فورًا بعد كل اختيار. composedPath() بتتحسب مرة واحدة قبل أي تعديل في الشجرة، فبتفضل
    // صح حتى لو العنصر اتشال بعد كده.
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !e.composedPath().includes(containerRef.current)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const atLimit = value.length >= MAX_KEYWORDS;
  const trimmedSearch = searchText.trim().toLowerCase();

  // أي كلمة اتضافت بالفعل بتتشال من النتائج (متتكررش)، وبعدين فلترة بنص البحث لو موجود.
  const candidates = KEYWORD_OPTIONS.filter((k) => !value.includes(k));
  const matches = trimmedSearch
    ? candidates.filter((k) => k.toLowerCase().includes(trimmedSearch))
    : candidates;
  // نفس منطق الترتيب بالاستخدام الفعلي اللي كان في القايمة المنسدلة القديمة — sort مستقر في
  // JS الحديث، فلو usageCounts لسه فاضية كل الكلمات بتاخد صفر وترجع للترتيب الأصلي.
  const results = [...matches]
    .sort((a, b) => (usageCounts[b] || 0) - (usageCounts[a] || 0))
    .slice(0, MAX_RESULTS);

  function addKeyword(keyword: string) {
    if (value.includes(keyword) || atLimit) return;
    // القايمة فضلة مفتوحة (من غير setIsOpen(false)) عشان يقدر يضيف أكتر من كلمة ورا بعض من
    // غير ما يحتاج يدوس على الحقل تاني في كل مرة — بتتقفل لوحدها لما يوصل للحد الأقصى (شرط
    // atLimit في شرط عرض القايمة تحت).
    onChange([...value, keyword]);
    setSearchText("");
  }

  function removeKeyword(keyword: string) {
    onChange(value.filter((k) => k !== keyword));
  }

  return (
    <div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
          disabled={atLimit}
          placeholder={atLimit ? `وصلت للحد الأقصى (${MAX_KEYWORDS} كلمات)` : "دور على كلمة مفتاحية..."}
          style={fieldStyle}
        />
        {isOpen && !atLimit && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 10,
              marginTop: 4,
              maxHeight: 220,
              overflowY: "auto",
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: 6,
              boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
            }}
          >
            {!trimmedSearch && (
              <div style={{ padding: "6px 10px", fontSize: 11.5, color: "#4A5568" }}>الأكتر استخدامًا</div>
            )}
            {results.length === 0 ? (
              <div style={{ padding: "8px 10px", fontSize: 13, color: "#4A5568" }}>مفيش نتائج مطابقة</div>
            ) : (
              results.map((k) => (
                <div
                  key={k}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addKeyword(k);
                  }}
                  style={{ padding: "8px 10px", fontSize: 13.5, cursor: "pointer" }}
                >
                  {k}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {atLimit && (
        <div style={{ fontSize: 12.5, color: "#B03A14", marginTop: 8 }}>
          وصلت للحد الأقصى ({MAX_KEYWORDS} كلمات مفتاحية) — شيل واحدة عشان تضيف غيرها.
        </div>
      )}

      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {value.map((keyword) => (
            <span
              key={keyword}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                padding: "5px 6px 5px 14px",
                borderRadius: 999,
                background: "#14213D",
                color: "#fff",
              }}
            >
              {keyword}
              <button
                type="button"
                onClick={() => removeKeyword(keyword)}
                aria-label={`شيل ${keyword}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  padding: 0,
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  borderRadius: "50%",
                  color: "#fff",
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#4A5568", marginTop: 8 }}>
        {value.length}/{MAX_KEYWORDS} كلمات مختارة
      </div>
    </div>
  );
}
