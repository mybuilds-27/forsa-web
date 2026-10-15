export type SkillEntry = {
  name: string;
  level: string;
};

// بيقبل الشكل القديم (مصفوفة نصوص) والجديد (مصفوفة {name, level}) ويوحّدهم
export function normalizeEntries(raw: any): SkillEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): SkillEntry | null => {
      if (typeof entry === "string") {
        const name = entry.trim();
        return name ? { name, level: "" } : null;
      }
      if (entry && typeof entry.name === "string" && entry.name.trim()) {
        return { name: entry.name.trim(), level: entry.level || "" };
      }
      return null;
    })
    .filter((entry): entry is SkillEntry => entry !== null);
}

export function formatEntries(entries: SkillEntry[], levelLabels: Record<string, string>): string {
  return entries
    .map((e) => (e.level ? `${e.name} (${levelLabels[e.level] || e.level})` : e.name))
    .join(" • ");
}

// ═══ الكلية أو التخصص الدراسي (fieldOfStudy) — نص حر اختياري في مستند job_seekers العام ═══
export const FIELD_OF_STUDY_MAX_LENGTH = 60;

// trim + ضغط المسافات المكررة + قص عند 60 حرف. الفاضي بيرجع "".
export function normalizeFieldOfStudy(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, FIELD_OF_STUDY_MAX_LENGTH).trim();
}

// تسلسل أرقام (إنجليزي 0-9 أو عربي ٠-٩) ممكن يكون بينها فواصل (مسافات، نقط، شرط، أقواس، /، +).
const DIGIT_RUN = /[0-9٠-٩](?:[\s.\-–_/()+]*[0-9٠-٩])*/g;

// true لو النص شكله فيه رقم تليفون (8 أرقام أو أكتر في تسلسل واحد) أو إيميل (@) — الحقل ده بيظهر
// لأصحاب الأعمال في بحث الكوادر، فمينفعش يبقى طريق لبيانات تواصل برا private/contact.
export function fieldOfStudyLooksLikeContact(text: string): boolean {
  if (/[@＠]/.test(text)) return true;
  return (text.match(DIGIT_RUN) || []).some((run) => (run.match(/[0-9٠-٩]/g) || []).length >= 8);
}

// عرض المؤهل مع الكلية/التخصص: "المؤهل" + "بكالوريوس · تجارة"، أو "التخصص الدراسي" + "تجارة" لو
// المؤهل فاضي، أو null لو الاتنين فاضيين.
export function educationDisplay(
  levelLabel: string,
  fieldOfStudy: unknown
): { label: "المؤهل" | "التخصص الدراسي"; value: string } | null {
  const field = normalizeFieldOfStudy(fieldOfStudy);
  if (levelLabel) return { label: "المؤهل", value: field ? `${levelLabel} · ${field}` : levelLabel };
  if (field) return { label: "التخصص الدراسي", value: field };
  return null;
}
