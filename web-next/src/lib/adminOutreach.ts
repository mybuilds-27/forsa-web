// رسالة التواصل الجاهزة من الأدمن لصاحب عمل في قسم "أنشط أصحاب العمل" (TopEmployersAdminSection.tsx)،
// للواتساب ولزرار "نسخ الرسالة". سطر التقديمات وسطر الاطلاع على التواصل بيتشالوا لو الرقم مش أكبر من 0.
// الأرقام بـString() عادي (0-9)، مش toLocaleString عشان ماتطلعش أرقام عربية.
export function adminOutreachMessage(row: {
  companyName: string;
  jobs90: number;
  views90: number | null;
  applications: number | null;
  contactViews: number | null;
}): string {
  const company = row.companyName.trim() || "شركتكم";
  const stats = [`- الوظائف المنشورة في آخر 3 أشهر: ${String(row.jobs90)}`];
  if (row.views90 !== null && row.views90 > 0) stats.push(`- عدد مرات مشاهدة إعلاناتكم على الموقع: ${String(row.views90)}`);
  if (row.applications !== null && row.applications > 0) stats.push(`- طلبات التقديم من خلال الموقع: ${String(row.applications)}`);
  if (row.contactViews !== null && row.contactViews > 0) stats.push(`- عدد من اطّلعوا على وسيلة التواصل الخاصة بكم: ${String(row.contactViews)}`);
  return [
    "السلام عليكم ورحمة الله،",
    "",
    "معك فريق موقع الشغل elshoghl.com لنشر الوظائف.",
    "",
    `نشكركم على نشر وظائف ${company} على الموقع. وكانت نتائج إعلاناتكم على الموقع حتى الآن كالتالي:`,
    ...stats,
    "",
    "نتواصل معكم لسؤالين:",
    "1. هل ساعدكم الموقع فعلًا في الوصول إلى مرشحين مناسبين؟",
    "2. هل لديكم وظائف جديدة في الفترة القادمة يمكننا مساعدتكم في الوصول لمرشحين لها؟",
    "",
    "رأيكم يهمنا جدًا، لأننا نعمل على تطوير الخدمة لأصحاب العمل.",
    "",
    "مع خالص التحية،",
    "فريق الشغل elshoghl.com",
  ].join("\n");
}
