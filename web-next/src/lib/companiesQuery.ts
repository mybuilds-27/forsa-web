import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type CompanyCard = {
  employerId: string;
  companyName: string;
  count: number;
  logoURL?: string | null;
};

// نفس منطق getCompanies اللي كان في companies/page.tsx بالظبط — مستخرجة هنا عشان
// تتستخدم كمان في الصفحة الرئيسية من غير تكرار الكود.
export async function getCompanies(): Promise<CompanyCard[]> {
  const q = query(
    collection(db, "job_posts"),
    where("isActive", "==", true),
    where("showCompanyName", "==", true)
  );
  const snap = await getDocs(q);
  const now = Date.now();
  const activeJobs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now);

  const byEmployer = new Map<string, CompanyCard>();
  for (const job of activeJobs) {
    const existing = byEmployer.get(job.employerId);
    if (existing) {
      existing.count += 1;
    } else {
      byEmployer.set(job.employerId, {
        employerId: job.employerId,
        companyName: job.companyName || "شركة",
        count: 1,
      });
    }
  }

  const companies = Array.from(byEmployer.values());

  const withLogos = await Promise.all(
    companies.map(async (c) => {
      try {
        const empSnap = await getDoc(doc(db, "employers", c.employerId));
        return { ...c, logoURL: empSnap.exists() ? (empSnap.data() as any).logoURL : null };
      } catch (err) {
        console.error(`Failed to load employer ${c.employerId}`, err);
        return { ...c, logoURL: null };
      }
    })
  );

  return withLogos.sort((a, b) => b.count - a.count);
}

// نفس منطق getCompanies تقريبًا، بس من غير فلتر showCompanyName (يعني بيحسب كمان الشركات
// اللي مخفيين اسمهم في الإعلان)، وبيرجع العدد بس مش قايمة كاملة — مستخدمة في رسالة الشفافية
// "X من إجمالي Y شركة" في الصفحة الرئيسية.
export async function getTotalActiveEmployersCount(): Promise<number> {
  const q = query(collection(db, "job_posts"), where("isActive", "==", true));
  const snap = await getDocs(q);
  const now = Date.now();
  const employerIds = new Set(
    snap.docs
      .map((d) => d.data() as any)
      .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now)
      .map((p) => p.employerId)
  );
  return employerIds.size;
}
