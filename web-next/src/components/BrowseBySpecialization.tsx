import Link from "next/link";
import { slugify } from "@/lib/constants";
import { tagStyle } from "@/lib/jobCardStyles";
import type { JobCombo } from "@/lib/publicJobsQuery";

type SpecializationGroup = {
  specialization: string;
  total: number;
  governorates: { governorate: string; count: number }[];
};

// بيجمّع نفس قايمة combos (محافظة+تخصص+عدد) حسب التخصص: إجمالي كل تخصص = مجموع عدد وظايف
// تركيباته، ومحافظاته مرتبة بعدد الوظايف تنازلي. التخصصات نفسها مرتبة بالإجمالي تنازلي. بيتعامل
// بس مع التركيبات اللي فيها وظيفة نشطة (getActiveJobsSeoData بيرجّع دول بس)، فمفيش تخصص ولا
// محافظة فاضية بتظهر.
function groupBySpecialization(combos: JobCombo[]): SpecializationGroup[] {
  const groups = new Map<string, SpecializationGroup>();
  for (const c of combos) {
    let group = groups.get(c.specialization);
    if (!group) {
      group = { specialization: c.specialization, total: 0, governorates: [] };
      groups.set(c.specialization, group);
    }
    group.total += c.count;
    group.governorates.push({ governorate: c.governorate, count: c.count });
  }
  const result = [...groups.values()];
  result.forEach((g) =>
    g.governorates.sort((a, b) => b.count - a.count || a.governorate.localeCompare(b.governorate, "ar"))
  );
  return result.sort((a, b) => b.total - a.total || a.specialization.localeCompare(b.specialization, "ar"));
}

// قايمة منسدلة على مستويين لـ"تصفح حسب المحافظة والتخصص": التخصصات ظاهرة، وكل تخصص <details>
// مقفول افتراضيًا بيفتح محافظاته، وكل محافظة لينك لنفس صفحة التركيبة (jobs/[محافظة]/[تخصص]).
// <details> عمدًا (مش state/JS): المحتوى بيفضل موجود في الـHTML حتى وهو مقفول، فجوجل بتشوف
// اللينكات من غير ما حد يدوس. كومبوننت سيرفر (من غير hooks) فبيشتغل من صفحة سيرفر وكلاينت.
export default function BrowseBySpecialization({
  combos,
  currentSpecialization,
  linkSpecializationPage = false,
}: {
  combos: JobCombo[];
  // اسم التخصص الحالي بنفس قيمة combos بالظبط (مش slug) — مجموعته بس بتتفتح، والباقي مقفول. لو مفيش
  // تخصص بالاسم ده في القايمة مفيش حاجة بتتفتح ومفيش خطأ.
  currentSpecialization?: string;
  // لينك "كل وظائف {التخصص}" لصفحة التخصص (/jobs/specialization/{slug}) أول كل مجموعة — بديل قايمة
  // أزرار "تصفح حسب التخصص" اللي كانت مكررة في الرئيسية. مقفول افتراضيًا عشان لوحة الأدمن (عندها
  // قايمة لينكات تخصص منفصلة) تفضل زي ما هي.
  linkSpecializationPage?: boolean;
}) {
  const groups = groupBySpecialization(combos);
  if (groups.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {groups.map((g) => (
        <details
          key={g.specialization}
          open={g.specialization === currentSpecialization ? true : undefined}
          style={{ border: "1px solid #14213D22", borderRadius: 10, background: "#fff" }}>
          <summary style={{ cursor: "pointer", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#14213D" }}>
            {g.specialization} ({g.total})
          </summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 14px 12px" }}>
            {linkSpecializationPage && (
              <Link
                href={`/jobs/specialization/${slugify(g.specialization)}`}
                style={{ ...tagStyle, textDecoration: "none", color: "#14213D", padding: "6px 12px", fontSize: 13, fontWeight: 700 }}
              >
                كل وظائف {g.specialization} ({g.total})
              </Link>
            )}
            {g.governorates.map((gov) => (
              <Link
                key={gov.governorate}
                href={`/jobs/${slugify(gov.governorate)}/${slugify(g.specialization)}`}
                style={{ ...tagStyle, textDecoration: "none", color: "#14213D", padding: "6px 12px", fontSize: 13 }}
              >
                {gov.governorate} ({gov.count})
              </Link>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
