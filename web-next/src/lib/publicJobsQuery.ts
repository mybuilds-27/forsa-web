import { collection, getDocs, limit, orderBy, query, where, type QueryConstraint } from "firebase/firestore";
import { db } from "./firebase";
import { GOVERNORATES, SPECIALIZATION_OPTIONS } from "./constants";

export async function getActivePublicJobs(filters: { governorate?: string; specialization?: string } = {}) {
  const constraints: QueryConstraint[] = [where("isActive", "==", true)];
  if (filters.governorate) constraints.push(where("governorate", "==", filters.governorate));
  if (filters.specialization) constraints.push(where("specialization", "==", filters.specialization));
  constraints.push(orderBy("createdAt", "desc"), limit(50));

  const snap = await getDocs(query(collection(db, "job_posts"), ...constraints));
  const now = Date.now();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now)
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
}

// نفس شكل استعلام JobsTab.tsx بالظبط (isActive + orderBy(featured) + orderBy(createdAt) +
// فلاتر equality اختيارية بينهم) عشان يستخدم نفس composite indexes الموجودة بالفعل في
// firestore.indexes.json من غير ما نحتاج نضيف indexes جديدة. q (بحث حر) مش قابل للفلترة
// من Firestore نفسه، فبيتطبق بعد الجلب زي ما JobsTab.tsx بتعمل بالظبط مع specOther.
export async function getFilteredPublicJobs(
  filters: { governorate?: string; jobType?: string; specialization?: string; q?: string } = {}
) {
  const constraints: QueryConstraint[] = [
    where("isActive", "==", true),
    orderBy("featured", "desc"),
    orderBy("createdAt", "desc"),
    limit(50),
  ];
  if (filters.governorate) constraints.splice(1, 0, where("governorate", "==", filters.governorate));
  if (filters.jobType) constraints.splice(1, 0, where("jobType", "==", filters.jobType));
  if (filters.specialization) constraints.splice(1, 0, where("specialization", "==", filters.specialization));

  const snap = await getDocs(query(collection(db, "job_posts"), ...constraints));
  const now = Date.now();
  let jobs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((p) => !p.expiresAt || p.expiresAt.toMillis() > now);

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    // مقصورة على العنوان والتخصص بس، من غير الوصف — البحث في الوصف كان بيطلّع نتايج مش
    // دقيقة (زي "عامل" بيطلّع "أمين مخزن" لمجرد إن الكلمة اتذكرت جوه وصف الوظيفة).
    jobs = jobs.filter((p) => {
      const haystack = `${p.title} ${p.specialization}`.toLowerCase();
      return haystack.includes(q);
    });
  }

  return jobs;
}

export type JobCombo = { governorate: string; specialization: string; count: number };

export async function getActiveJobsSeoData(): Promise<{
  jobIds: string[];
  governorates: string[];
  specializations: string[];
  combos: JobCombo[];
}> {
  const snap = await getDocs(query(collection(db, "job_posts"), where("isActive", "==", true)));
  const now = Date.now();
  const jobIds: string[] = [];
  const comboMap = new Map<string, JobCombo>();
  const govSet = new Set<string>();
  const specSet = new Set<string>();
  const validGovernorates = new Set(GOVERNORATES);
  const validSpecializations = new Set(SPECIALIZATION_OPTIONS);

  // بعض بيانات الوظائف القديمة فيها قيم governorate/specialization مش مطابقة تمامًا
  // للقايمتين المعتمدتين (زي "المبيعات" بدل "مبيعات") — نتجاهلها هنا عشان منولدش
  // روابط sitemap أو "تصفح حسب" بترجع 404 لأن findGovernorateBySlug/findSpecialtyBySlug
  // بيدوروا في القايمتين المعتمدتين بس. govSet وspecSet بيتسجّلوا كل واحد لوحده (مش مربوطين
  // ببعض) عشان صفحات المحافظة-لوحدها والتخصص-لوحدها تشتغل حتى لو الوظيفة ناقصة البُعد التاني.
  for (const d of snap.docs) {
    const p = d.data() as any;
    if (p.expiresAt && p.expiresAt.toMillis() < now) continue;
    jobIds.push(d.id);
    if (p.governorate && validGovernorates.has(p.governorate)) govSet.add(p.governorate);
    if (p.specialization && validSpecializations.has(p.specialization)) specSet.add(p.specialization);
    if (!p.governorate || !validGovernorates.has(p.governorate)) continue;
    if (!p.specialization || !validSpecializations.has(p.specialization)) continue;
    const key = `${p.governorate}|||${p.specialization}`;
    const existing = comboMap.get(key);
    if (existing) existing.count += 1;
    else comboMap.set(key, { governorate: p.governorate, specialization: p.specialization, count: 1 });
  }

  return {
    jobIds,
    governorates: Array.from(govSet),
    specializations: Array.from(specSet),
    combos: Array.from(comboMap.values()).sort((a, b) => b.count - a.count),
  };
}
