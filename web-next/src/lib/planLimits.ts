// سعر الباقة المدفوعة وحدود الباقتين، في مكان واحد لصفحة /pricing.
//
// تنبيه: الحدود دي لسه مكتوبة كأرقام كمان في الأماكن اللي بتطبّقها فعليًا — لو أي رقم اتغيّر لازم يتغيّر هنا
// وهناك مع بعض:
//   - jobsPerMonth: PostJobTab.tsx (monthlyLimit وقت النشر)
//   - activeDays: PostJobTab.tsx (expiresAt وقت النشر)
//   - invitationsPerMonth: InviteToJobModal.tsx (monthlyLimit) وlib/employerStats.ts
//   - contactRevealsPerMonth: MONTHLY_CONTACT_REVEAL_LIMIT في SeekerDetailModal.tsx
//   - featured: PostJobTab.tsx (featured = الباقة المدفوعة)
//   - نصوص نافذة الترقية: UpgradeModal.tsx
// السعر والمدة مش موجودين في أي مكان تاني في الكود: المدة الافتراضية لتفعيل الباقة من لوحة الأدمن 3 أشهر
// (adminSetEmployerPlan في functions/index.js)، والسعر بيتفق عليه وقت طلب الترقية.
export const PREMIUM_PRICE_EGP = 1000;
export const PREMIUM_DURATION_MONTHS = 3;

export type PlanLimits = {
  jobsPerMonth: number;
  activeDays: number;
  invitationsPerMonth: number;
  // 0 = مش متاح في الباقة دي
  contactRevealsPerMonth: number;
  featured: boolean;
};

export const FREE_PLAN_LIMITS: PlanLimits = {
  jobsPerMonth: 5,
  activeDays: 30,
  invitationsPerMonth: 5,
  contactRevealsPerMonth: 0,
  featured: false,
};

export const PREMIUM_PLAN_LIMITS: PlanLimits = {
  jobsPerMonth: 10,
  activeDays: 60,
  invitationsPerMonth: 30,
  contactRevealsPerMonth: 30,
  featured: true,
};
