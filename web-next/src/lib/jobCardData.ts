// الشكل المختصر لوظيفة في كارت الوظيفة (JobCardBase) — الحقول اللي الكارت بيعرضها بس، والتواريخ
// أرقام (ms) بدل Timestamp. أي صفحة سيرفر بتبعت وظايف لكومبوننت client لازم تحوّلها بـtoJobCardData
// الأول: props الكومبوننت الـclient بتتكتب جوه الصفحة نفسها، فالمستند الكامل كان بيوصل للمتصفح
// بكل حقوله (contactValue وscreeningQuestions وغيرهم).
export type JobCardData = {
  id: string;
  title: string;
  // null = الاسم مش معلن (showCompanyName مش true أو الاسم فاضي) — الاسم نفسه مبيتبعتش خالص في الحالة دي
  companyName: string | null;
  city: string;
  governorate: string;
  jobType: string;
  minExperience: number | null;
  maxExperience: number | null;
  featured: boolean;
  createdAtMs: number | null;
  showSalary: boolean;
  salaryNegotiable: boolean;
  salaryFrom: number | null;
  salaryTo: number | null;
  ageFrom: number | null;
  ageTo: number | null;
  // المزايا اللي قيمتها "yes" بس
  socialInsurance: boolean;
  privateHealthInsurance: boolean;
  transportationAvailable: boolean;
  housingForExpats: boolean;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function millis(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v && typeof (v as { toMillis?: unknown }).toMillis === "function") return (v as { toMillis(): number }).toMillis();
  return null;
}

export function toJobCardData(doc: { id: string } & Record<string, unknown>): JobCardData {
  const companyName = str(doc.companyName);
  return {
    id: doc.id,
    title: str(doc.title),
    companyName: doc.showCompanyName === true && companyName ? companyName : null,
    city: str(doc.city),
    governorate: str(doc.governorate),
    jobType: str(doc.jobType),
    minExperience: num(doc.minExperience),
    maxExperience: num(doc.maxExperience),
    featured: doc.featured === true,
    createdAtMs: millis(doc.createdAt),
    showSalary: doc.showSalary !== false,
    salaryNegotiable: doc.salaryNegotiable === true,
    salaryFrom: num(doc.salaryFrom),
    salaryTo: num(doc.salaryTo),
    ageFrom: num(doc.ageFrom),
    ageTo: num(doc.ageTo),
    socialInsurance: doc.socialInsurance === "yes",
    privateHealthInsurance: doc.privateHealthInsurance === "yes",
    transportationAvailable: doc.transportationAvailable === "yes",
    housingForExpats: doc.housingForExpats === "yes",
  };
}
