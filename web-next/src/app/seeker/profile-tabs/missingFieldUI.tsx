import { useEffect } from "react";

// مشترك بين كل تابات البروفايل الفرعية (PersonalInfoTab/JobPreferencesTab/ExperienceTab/
// SkillsAndCVTab) اللي فيها حقول من getMissingProfileFields — بدل ما نكرر نفس منطق التظليل
// وscroll-to-field في كل واحد منهم لوحده.

export type ScrollTarget = { key: string; nonce: string | number } | null;

// حدود ملوّنة (كهرماني، نفس لون تنبيه "كمّل بروفايلك") تتحط على الحقل الناقص، وكلمة "ناقص"
// صغيرة جنب اسمه — بيتفعّلوا لو missingKeys?.has(fieldKey).
export const MISSING_BORDER_COLOR = "#E8A33D";

export function MissingTag() {
  return (
    <span
      style={{
        marginRight: 6,
        fontSize: 11,
        fontWeight: 700,
        color: "#8A570D",
        background: "rgba(232,163,61,0.18)",
        padding: "1px 6px",
        borderRadius: 999,
      }}
    >
      ناقص
    </span>
  );
}

// بيعمل scroll لعنصر id="field-{key}" لما scrollTarget.key يطابق key المحدد — nonce (وقت
// الطلب) في الـdependency array عشان لو نفس الحقل اتطلب تاني (نادر لكن ممكن) الـeffect يتنفذ
// تاني برضه، مش يتجاهل لأن الـkey متغيرش.
export function useScrollToField(scrollTarget: ScrollTarget | undefined, key: string) {
  useEffect(() => {
    if (!scrollTarget || scrollTarget.key !== key) return;
    const el = document.getElementById(`field-${key}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTarget?.nonce, key]);
}
