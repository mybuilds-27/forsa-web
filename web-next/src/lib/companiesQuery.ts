import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type CompanyCard = {
  employerId: string;
  companyName: string;
  count: number;
  logoURL?: string | null;
};

// تجميع job_posts النشطة (showCompanyName==true) حسب صاحب العمل — بيرجع بيانات الشركة
// الأساسية بس (اسم + عدد وظايف)، من غير أي قراءة إضافية للوجو. مستخدمة كأساس لكل من
// getCompanies (بتضيف اللوجوهات لكل النتيجة) وgetCompaniesWithoutLogos (خفيفة، من غير لوجو).
async function aggregateCompanies(): Promise<CompanyCard[]> {
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

  return Array.from(byEmployer.values()).sort((a, b) => b.count - a.count);
}

// نفس منطق getCompanies اللي كان في companies/page.tsx بالظبط — مستخرجة هنا عشان
// تتستخدم كمان في الصفحة الرئيسية من غير تكرار الكود. بتجيب لوجو كل شركة في النتيجة
// (مناسبة لقوائم صغيرة زي أول 12 شركة في الصفحة الرئيسية — مش لقايمة /companies الكاملة
// اللي ممكن توصل لمئات الشركات، دي بتستخدم getCompaniesWithoutLogos + getCompanyLogos
// بدل كده عشان تجيب لوجو الدفعة المعروضة بس).
export async function getCompanies(): Promise<CompanyCard[]> {
  const companies = await aggregateCompanies();
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
  return withLogos;
}

// زي getCompanies بس من غير قراءة اللوجوهات خالص — استعلام job_posts واحد بس، مفيش قراءات
// إضافية لكل شركة. مستخدمة في /companies (ممكن يوصل لمئات الشركات) عشان الصفحة تفضل خفيفة
// عند التحميل الأول، وقراءات اللوجو تتأجل للدفعة المعروضة فعليًا بس عن طريق getCompanyLogos.
export async function getCompaniesWithoutLogos(): Promise<CompanyCard[]> {
  return aggregateCompanies();
}

// بتجيب لوجو دفعة IDs محددة بس (مش كل الشركات) — كل employer لوحده بـgetDoc منفصل
// (زي المنطق الأصلي بالظبط)، وفشل واحد فيهم مبيأثرش على الباقي. مستخدمة من CompaniesGrid
// (client component) عند التحميل الأول ومع كل "تحميل المزيد"، عشان القراءات التقيلة دي
// تقتصر على الشركات المعروضة فعليًا على الشاشة بدل كل الشركات دفعة واحدة.
export async function getCompanyLogos(employerIds: string[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    employerIds.map(async (employerId) => {
      try {
        const empSnap = await getDoc(doc(db, "employers", employerId));
        return [employerId, empSnap.exists() ? (empSnap.data() as any).logoURL ?? null : null] as const;
      } catch (err) {
        console.error(`Failed to load employer ${employerId}`, err);
        return [employerId, null] as const;
      }
    })
  );
  return Object.fromEntries(entries);
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
