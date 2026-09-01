"use client";

import { useState } from "react";
import { KEYWORD_OPTIONS } from "@/lib/constants";

// حد أقصى 8 كلمات مفتاحية — قايمة أطول من كده هتفقد الغرض منها (تحديد دقيق لمهارات/مجالات
// الباحث أو الوظيفة)، ومهمة للمطابقة في "وظائف موصى بيها ليك" (JobsTab.tsx).
export const MAX_KEYWORDS = 8;

// عدد الكلمات الظاهرة افتراضيًا قبل ما المستخدم يدوس "عرض كل الكلمات" — القايمة الكاملة
// (80+ عنصر) بتحس المستخدم إنها كتير ومشتتة لو اتعرضت كلها دفعة واحدة.
const DEFAULT_VISIBLE_COUNT = 12;

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

// نفس تجربة الاختيار مستخدمة في بروفايل الباحث (JobPreferencesTab.tsx) وفورم نشر الوظيفة
// (PostJobTab.tsx) — قايمة KEYWORD_OPTIONS كبيرة (80+ عنصر) فمحتاجة بحث/فلترة فوقها، وchips
// قابلة للاختيار بحد أقصى MAX_KEYWORDS.
export default function KeywordsPicker({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  // مرة توسّع بـ"عرض كل الكلمات"، بتفضل موسّعة — مفيش زرار "طي" تاني. البحث بيتعامل معاها
  // بشكل مستقل تمامًا (شوف matchingKeywords/visibleKeywords تحت): لو فيه بحث بيتجاهل
  // expanded خالص ويعرض كل النتائج المطابقة، ولو البحث اتمسح بيرجع يحترم expanded عادي.
  const [expanded, setExpanded] = useState(false);

  function toggle(keyword: string) {
    if (value.includes(keyword)) {
      onChange(value.filter((k) => k !== keyword));
    } else if (value.length < MAX_KEYWORDS) {
      onChange([...value, keyword]);
    }
  }

  const searchTerm = search.trim();
  const matchingKeywords = searchTerm
    ? KEYWORD_OPTIONS.filter((k) => k.includes(searchTerm))
    : KEYWORD_OPTIONS;

  // بحث فعّال بيعرض كل النتايج المطابقة دايمًا، بغض النظر عن حالة التوسيع — القايمة المختصرة
  // (DEFAULT_VISIBLE_COUNT) بتتطبق بس لما مفيش بحث ولسه مش موسّعة. لما تكون مختصرة، أي كلمة
  // متختارة بالفعل بتتقدّم لفوق (حتى لو مش من أصل أول DEFAULT_VISIBLE_COUNT) عشان المستخدم
  // ميحسش إنه فقد اختياره.
  const visibleKeywords = (() => {
    if (searchTerm || expanded) return matchingKeywords;
    const selectedFirst = matchingKeywords.filter((k) => value.includes(k));
    const rest = matchingKeywords.filter((k) => !value.includes(k));
    return [...selectedFirst, ...rest].slice(0, DEFAULT_VISIBLE_COUNT);
  })();

  const showExpandButton = !searchTerm && !expanded && matchingKeywords.length > visibleKeywords.length;

  const atLimit = value.length >= MAX_KEYWORDS;

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="دوّر في الكلمات المفتاحية..."
        style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, marginBottom: 10 }}
      />
      {atLimit && (
        <div style={{ fontSize: 12.5, color: "#B03A14", marginBottom: 8 }}>
          وصلت للحد الأقصى ({MAX_KEYWORDS} كلمات مفتاحية) — شيل واحدة عشان تضيف غيرها.
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          maxHeight: 220,
          overflowY: "auto",
          padding: 4,
          border: "1px solid #eee",
          borderRadius: 8,
        }}
      >
        {visibleKeywords.length === 0 && (
          <div style={{ fontSize: 13, color: "#4A5568", padding: 8 }}>مفيش كلمات مطابقة</div>
        )}
        {visibleKeywords.map((keyword) => {
          const selected = value.includes(keyword);
          const disabled = !selected && atLimit;
          return (
            <button
              key={keyword}
              type="button"
              onClick={() => toggle(keyword)}
              disabled={disabled}
              style={{
                fontSize: 13,
                padding: "6px 14px",
                borderRadius: 999,
                border: selected ? "1px solid #14213D" : "1px solid #ccc",
                background: selected ? "#14213D" : disabled ? "#F0EDE3" : "#fff",
                color: selected ? "#fff" : disabled ? "#A0A8B4" : "#14213D",
                cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {keyword}
            </button>
          );
        })}
      </div>
      {showExpandButton && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            marginTop: 8,
            fontSize: 12.5,
            color: "#14213D",
            textDecoration: "underline",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          عرض كل الكلمات
        </button>
      )}
      <div style={{ fontSize: 12, color: "#4A5568", marginTop: 8 }}>
        {value.length}/{MAX_KEYWORDS} كلمات مختارة
      </div>
    </div>
  );
}
