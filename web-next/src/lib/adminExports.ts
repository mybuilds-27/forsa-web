import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";

// نفس أسلوب exportApplicantsExcel في jobPostActions.ts بالظبط (.xlsx حقيقي بدل CSV،
// نفس مكتبة xlsx ونفس نمط بناء الشيت).

function formatDate(ts: any): string {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleDateString("ar-EG");
}

// حسابات التسجيل بالتليفون بتستخدم إيميل داخلي وهمي (phone+...@elshoghl.internal) للربط
// بمصادقة فايربيز بس — مش إيميل حقيقي، فمينفعش يظهر في تصدير للأدمن على إنه إيميل المستخدم.
function realEmail(email?: string | null): string {
  if (!email || email.includes("@elshoghl.internal")) return "";
  return email;
}

// بيانات الباحثين وأصحاب العمل بتيجي من job_seekers/employers نفسهم (زي حساب إحصائيات
// admin/page.tsx بالظبط)، وusers/{uid} كـfallback للإيميل/الاسم/التليفون لما مش موجودين
// في المستند المتخصص. اسم وتليفون صاحب العمل الفعليين (contactPerson/phone) متخزنين في
// employers/{uid}/private/contact — قراءة منفصلة لكل صاحب عمل (Promise.all)، محتاجة قاعدة
// أمان تسمح لـisAdmin() بالقراءة (نفس نمط تعديل invitations قبل كده).
export async function exportAllUsersExcel(): Promise<void> {
  const [seekersSnap, employersSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "job_seekers")),
    getDocs(collection(db, "employers")),
    getDocs(collection(db, "users")),
  ]);

  const usersById = new Map<string, any>();
  usersSnap.docs.forEach((d) => usersById.set(d.id, d.data()));

  const contactByEmployerId = new Map<string, { contactPerson?: string; phone?: string }>();
  await Promise.all(
    employersSnap.docs.map(async (d) => {
      try {
        const contactSnap = await getDoc(doc(db, "employers", d.id, "private", "contact"));
        if (contactSnap.exists()) contactByEmployerId.set(d.id, contactSnap.data());
      } catch (err) {
        // فشل قراءة صاحب عمل واحد (زي القاعدة الجديدة لسه مش متطبّقة) ميوقفش تصدير الباقي —
        // عمود الاسم/التليفون بتاعه بس هيفضل فاضي (fallback لـusers/{uid} تحت).
        console.error(`[adminExports] فشل قراءة بيانات تواصل صاحب العمل ${d.id}`, err);
      }
    })
  );

  const headers = [
    "النوع",
    "الاسم",
    "الإيميل",
    "رقم التليفون",
    "المحافظة",
    "تاريخ التسجيل",
    "التخصص",
    "المسمى الوظيفي المطلوب",
    "اسم الشركة",
  ];

  const rows: (string | number)[][] = [];

  seekersSnap.docs.forEach((d) => {
    const s = d.data();
    const u = usersById.get(d.id) || {};
    rows.push([
      "باحث عن شغل",
      s.fullName || u.displayName || "",
      realEmail(s.email || u.email),
      s.phone || u.phoneNumber || "",
      s.governorate || "",
      formatDate(s.createdAt || u.createdAt),
      s.specialization || "",
      s.jobTitle || "",
      "",
    ]);
  });

  employersSnap.docs.forEach((d) => {
    const e = d.data();
    const u = usersById.get(d.id) || {};
    const contact = contactByEmployerId.get(d.id);
    rows.push([
      "صاحب عمل",
      contact?.contactPerson || u.displayName || "",
      realEmail(u.email),
      contact?.phone || u.phoneNumber || "",
      e.governorate || "",
      formatDate(e.createdAt || u.createdAt),
      "",
      "",
      e.companyName || "",
    ]);
  });

  if (rows.length === 0) {
    alert("لسه مفيش مستخدمين مسجلين.");
    return;
  }

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = [
    { wch: 13 }, { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  // عرض الشيت من اليمين للشمال عشان يناسب المحتوى العربي بشكل طبيعي
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, worksheet, "المستخدمين");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `users-${today}.xlsx`);
}
