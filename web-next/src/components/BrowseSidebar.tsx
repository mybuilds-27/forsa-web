import BrowseBySpecialization from "./BrowseBySpecialization";
import type { JobCombo } from "@/lib/publicJobsQuery";

// السايدبار الموحّد "تصفح حسب المحافظة والتخصص" في كل صفحات التصفح العامة وتاب الوظائف عند
// الباحث: قايمة منسدلة على مستويين (تخصص ← محافظاته) من BrowseBySpecialization — نفس الشكل
// بالظبط اللي في /jobs والصفحة الرئيسية ولوحة الأدمن.
export default function BrowseSidebar({ combos, currentSpecialization }: { combos: JobCombo[]; currentSpecialization?: string }) {
  if (combos.length === 0) return null;

  return (
    <details className="browse-sidebar" open>
      <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 700, color: "#14213D", marginBottom: 10 }}>
        تصفح حسب المحافظة والتخصص
      </summary>
      <BrowseBySpecialization combos={combos} currentSpecialization={currentSpecialization} />
    </details>
  );
}
