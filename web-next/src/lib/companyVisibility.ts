// شرط ظهور وظيفة في الصفحة العامة للشركة (/companies/<id>) وفي قايمة الشركات (/companies والرئيسية):
// نشطة وغير منتهية وفيها showCompanyName == true. الصفحة العامة بتتفتح بس لو للشركة وظيفة واحدة
// على الأقل بتحقق الشرط ده. الاستعلامات العامة بتفلتر isActive وshowCompanyName على السيرفر، وبعدين
// بتمرّر النتيجة على الدالة دي برضه، فلوحة صاحب العمل (CompanyTab) بتستخدم نفس الشرط بالظبط.
export type PublicJobFields = {
  isActive?: boolean;
  showCompanyName?: boolean;
  expiresAt?: { toMillis(): number } | null;
};

export function isPublicCompanyJob(job: PublicJobFields, now: number = Date.now()): boolean {
  return job.isActive === true && job.showCompanyName === true && (!job.expiresAt || job.expiresAt.toMillis() > now);
}
