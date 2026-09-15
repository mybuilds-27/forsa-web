import { Timestamp, collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "./firebase";

function startOfCurrentMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export type InvitationStats = { total: number; thisMonth: number; monthlyLimit: number };

// نفس حد الدعوات الشهري الموجود بالفعل في InviteToJobModal.tsx (5 مجانية / 30 مدفوعة) —
// مكرر هنا بنفس القيمة بدل استيراد مشترك، زي نمط التكرار المتبع في المشروع لثوابت بسيطة
// زي ده (شوف ADMIN_EMAILS في أكتر من ملف). getCountFromServer بدل جلب كل المستندات وعدّها
// يدويًا (زي المنطق الحالي في InviteToJobModal.tsx) — قراءة count واحدة لكل استعلام بغض
// النظر عن عدد المستندات المطابقة.
export async function fetchInvitationStats(employerId: string, employerPlan: string): Promise<InvitationStats> {
  const monthlyLimit = employerPlan === "premium" ? 30 : 5;
  const startOfMonth = startOfCurrentMonth();
  // TEMP DEBUG
  console.log("[DEBUG fetchInvitationStats] employerId:", employerId, "employerPlan:", employerPlan, "monthlyLimit:", monthlyLimit);

  const [totalSnap, monthSnap] = await Promise.all([
    getCountFromServer(query(collection(db, "invitations"), where("employerId", "==", employerId))),
    getCountFromServer(
      query(
        collection(db, "invitations"),
        where("employerId", "==", employerId),
        where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
      )
    ),
  ]);

  const result = { total: totalSnap.data().count, thisMonth: monthSnap.data().count, monthlyLimit };
  // TEMP DEBUG
  console.log("[DEBUG fetchInvitationStats] result:", JSON.stringify(result));
  return result;
}

export type ContactRevealStats = { thisMonth: number; monthlyLimit: number };

// ميزة كشف بيانات تواصل الباحث (SeekerDetailModal.tsx) متاحة للباقة المدفوعة بس — بترجع
// null للباقة المجانية عشان الواجهة تخفي الإحصائية دي تمامًا بدل ما تعرض حد مش موجود أصلاً.
// contact_reveals هنا هي collection المستخدمة في SeekerDetailModal.tsx (حد شهري لكشف بيانات
// التواصل) — مختلفة تمامًا عن job_contact_views (مشاهدات وسيلة تواصل الوظيفة نفسها).
export async function fetchContactRevealStats(employerId: string, employerPlan: string): Promise<ContactRevealStats | null> {
  // TEMP DEBUG
  console.log("[DEBUG fetchContactRevealStats] employerId:", employerId, "employerPlan:", employerPlan);
  if (employerPlan !== "premium") return null;
  const startOfMonth = startOfCurrentMonth();

  const snap = await getCountFromServer(
    query(
      collection(db, "contact_reveals"),
      where("employerId", "==", employerId),
      where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
    )
  );

  const result = { thisMonth: snap.data().count, monthlyLimit: 30 };
  // TEMP DEBUG
  console.log("[DEBUG fetchContactRevealStats] result:", JSON.stringify(result));
  return result;
}

export type DailyCount = { date: string; label: string; count: number };

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// عدد التقديمات لكل يوم في آخر days يوم (7 افتراضيًا)، من طوابع appliedAt موجودة بالفعل —
// مفيش أي قراءة Firestore إضافية هنا، البيانات دي جزء من نفس استعلام applications الموجود
// أصلًا في CompanyTab.tsx (بيتجاب لحساب applicantCounts). localDateKey بدل toISOString()
// عشان اليوم يتحدد بالتوقيت المحلي للمتصفح، مش UTC (فرق ساعتين-تلاتة في مصر ممكن يحط تقديم
// آخر الليل في اليوم الغلط لو استخدمنا UTC).
export function buildDailyApplicationCounts(timestamps: (Timestamp | null | undefined)[], days = 7): DailyCount[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = new Map<string, number>();
  const order: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    buckets.set(key, 0);
    order.push(key);
  }

  timestamps.forEach((ts) => {
    if (!ts?.toDate) return;
    const key = localDateKey(ts.toDate());
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  return order.map((key) => {
    const [y, m, day] = key.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    return { date: key, label: d.toLocaleDateString("ar-EG", { weekday: "short", day: "numeric" }), count: buckets.get(key) || 0 };
  });
}
