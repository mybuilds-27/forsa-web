"use client";

import { useState } from "react";
import { KEYWORD_CATEGORIES } from "@/lib/constants";

// حد أقصى 8 كلمات مفتاحية — قايمة أطول من كده هتفقد الغرض منها (تحديد دقيق لمهارات/مجالات
// الباحث أو الوظيفة)، ومهمة للمطابقة في "وظائف موصى بيها ليك" (JobsTab.tsx).
export const MAX_KEYWORDS = 8;

// نفس شكل الـselect boxes التانية في نفس الفورمات (زي "نوع الدوام"/"التخصص" في
// PostJobTab.tsx وJobPreferencesTab.tsx) — نفس القيم بالظبط (padding 8، حدود #ccc، radius 6).
const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
};

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

// تجربة اختيار عن طريق قايمة منسدلة واحدة مقسّمة بفئات (optgroup لكل فئة من
// KEYWORD_CATEGORIES) + زرار "إضافة"، بدل ما تتعرض كل الكلمات (80+ عنصر) كـchips دفعة واحدة.
// نفس تجربة الاختيار مستخدمة في بروفايل الباحث (JobPreferencesTab.tsx) وفورم نشر الوظيفة
// (PostJobTab.tsx).
export default function KeywordsPicker({ value, onChange }: Props) {
  const [pendingKeyword, setPendingKeyword] = useState("");

  const atLimit = value.length >= MAX_KEYWORDS;

  function addKeyword() {
    if (!pendingKeyword || value.includes(pendingKeyword) || atLimit) return;
    onChange([...value, pendingKeyword]);
    setPendingKeyword("");
  }

  function removeKeyword(keyword: string) {
    onChange(value.filter((k) => k !== keyword));
  }

  const addDisabled = atLimit || !pendingKeyword;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          value={pendingKeyword}
          onChange={(e) => setPendingKeyword(e.target.value)}
          disabled={atLimit}
          style={{ ...selectStyle, flex: 1 }}
        >
          <option value="">اختار كلمة مفتاحية</option>
          {KEYWORD_CATEGORIES.map((cat) => {
            // أي كلمة اتضافت بالفعل بتتشال من خيارات القايمة (متتكررش)، والفئة كلها بتختفي
            // لو خلصت كل كلماتها من غير ما تسيب optgroup فاضي.
            const available = cat.keywords.filter((k) => !value.includes(k));
            if (available.length === 0) return null;
            return (
              <optgroup key={cat.category} label={cat.category}>
                {available.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <button
          type="button"
          onClick={addKeyword}
          disabled={addDisabled}
          style={{
            flexShrink: 0,
            padding: "8px 16px",
            background: addDisabled ? "#F0EDE3" : "transparent",
            color: addDisabled ? "#A0A8B4" : "#14213D",
            border: addDisabled ? "1px solid #ccc" : "1px solid #14213D",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
            cursor: addDisabled ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          إضافة
        </button>
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
