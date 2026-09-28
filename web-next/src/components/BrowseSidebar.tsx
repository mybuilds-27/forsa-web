import BrowseByCombos from "./BrowseByCombos";
import BrowseBySpecialization from "./BrowseBySpecialization";
import type { JobCombo } from "@/lib/publicJobsQuery";

// grouped بيبدّل قايمة "وظائف X في Y" المسطّحة بقايمة منسدلة على مستويين (تخصص ← محافظاته) —
// بس تاب الوظائف عند الباحث (JobsTab.tsx) بيستخدمه؛ باقي الصفحات العامة اللي بتستخدم السايدبار
// ده فاضلة على القايمة المسطّحة (الافتراضي false).
export default function BrowseSidebar({ combos, grouped = false }: { combos: JobCombo[]; grouped?: boolean }) {
  if (combos.length === 0) return null;

  return (
    <details className="browse-sidebar" open>
      <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#14213D", marginBottom: 10 }}>
        تصفح حسب المحافظة والتخصص
      </summary>
      {grouped ? <BrowseBySpecialization combos={combos} /> : <BrowseByCombos combos={combos} variant="list" />}
    </details>
  );
}
