import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import { MILITARY_STATUS_LABELS, SKILL_LEVELS, LANGUAGE_LEVELS } from "@/lib/constants";
import { normalizeEntries, formatEntries } from "@/lib/profileFields";

// نفس أسلوب exportApplicantsExcel في jobPostActions.ts بالظبط (.xlsx حقيقي بدل CSV،
// نفس مكتبة xlsx ونفس نمط بناء الشيت).

// نفس القيم المستخدمة في seeker/profile-tabs/JobPreferencesTab.tsx بالظبط
const EDUCATION_LABELS: Record<string, string> = {
  none: "بدون مؤهل دراسي",
  literacy: "محو أمية",
  primary: "ابتدائية",
  preparatory: "إعدادية",
  secondary: "ثانوية عامة / دبلوم",
  bachelor: "بكالوريوس/ليسانس",
  master: "ماجستير",
  phd: "دكتوراه",
};

const GENDER_LABELS: Record<string, string> = { male: "ذكر", female: "أنثى" };

// نفس القيم المستخدمة في employer/EmployerOnboardingForm.tsx بالظبط
const COMPANY_SIZE_LABELS: Record<string, string> = {
  under20: "أقل من 20",
  "20to100": "من 20 لـ 100",
  "100to500": "من 100 لـ 500",
  "500to1000": "من 500 لـ 1000",
  over1000: "أكتر من 1000",
};

const PLAN_LABELS: Record<string, string> = { free: "مجانية", premium: "مدفوعة" };

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

// بيانات الباحثين وأصحاب العمل بتيجي من job_seekers/employers نفسهم (كل الحقول المتاحة،
// مش بس اللي في seekerSnapshot.ts)، وusers/{uid} كـfallback للإيميل/الاسم/التليفون لما
// مش موجودين في المستند المتخصص. اسم وتليفون صاحب العمل الفعليين (contactPerson/phone)
// متخزنين في employers/{uid}/private/contact — قراءة منفصلة لكل صاحب عمل (Promise.all)،
// محتاجة قاعدة أمان تسمح لـisAdmin() بالقراءة (نفس نمط تعديل invitations قبل كده).
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

  if (seekersSnap.docs.length === 0 && employersSnap.docs.length === 0) {
    alert("لسه مفيش مستخدمين مسجلين.");
    return;
  }

  const workbook = XLSX.utils.book_new();
  // عرض الشيتين من اليمين للشمال عشان يناسب المحتوى العربي بشكل طبيعي
  workbook.Workbook = { Views: [{ RTL: true }] };

  // ═══ شيت 1: الباحثين عن شغل ═══
  const seekerHeaders = [
    "الاسم بالكامل",
    "الإيميل",
    "رقم التليفون",
    "المسمى الوظيفي المطلوب",
    "التخصص",
    "المحافظة",
    "المدينة",
    "سنوات الخبرة",
    "المؤهل الدراسي",
    "الجنس",
    "الموقف من التجنيد",
    "المهارات",
    "اللغات",
    "تاريخ التسجيل",
    "لينك السيرة الذاتية",
  ];
  const cvColumnIndex = seekerHeaders.indexOf("لينك السيرة الذاتية");

  const seekerRows = seekersSnap.docs.map((d) => {
    const s = d.data();
    const u = usersById.get(d.id) || {};
    return [
      s.fullName || u.displayName || "",
      realEmail(s.email || u.email),
      s.phone || u.phoneNumber || "",
      s.jobTitle || "",
      s.specialization || "",
      s.governorate || "",
      s.city || "",
      s.yearsOfExperience || 0,
      EDUCATION_LABELS[s.educationLevel] || s.educationLevel || "",
      GENDER_LABELS[s.gender] || "",
      MILITARY_STATUS_LABELS[s.militaryStatus] || "",
      formatEntries(normalizeEntries(s.skills), SKILL_LEVELS),
      formatEntries(normalizeEntries(s.languages), LANGUAGE_LEVELS),
      formatDate(s.createdAt || u.createdAt),
      // النص المعروض بس — الـhyperlink الفعلي بيتحط على الخلية نفسها تحت بعد بناء الشيت
      s.cvFileURL ? "عرض السيرة الذاتية" : "",
    ];
  });

  const seekerSheet = XLSX.utils.aoa_to_sheet([seekerHeaders, ...seekerRows]);
  seekerSheet["!cols"] = [
    { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 20 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 10 },
    { wch: 16 }, { wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 20 },
  ];
  seekersSnap.docs.forEach((d, i) => {
    const s = d.data();
    if (!s.cvFileURL) return;
    const cellAddress = XLSX.utils.encode_cell({ r: i + 1, c: cvColumnIndex });
    const cell = seekerSheet[cellAddress];
    if (cell) cell.l = { Target: s.cvFileURL };
  });
  XLSX.utils.book_append_sheet(workbook, seekerSheet, "باحثين عن شغل");

  // ═══ شيت 2: أصحاب الأعمال ═══
  const employerHeaders = [
    "اسم الشركة",
    "اسم مسؤول التواصل",
    "رقم التليفون",
    "نبذة عن الشركة",
    "المحافظة",
    "المدينة",
    "حجم الشركة",
    "نوع الباقة",
    "تاريخ التسجيل",
  ];

  const employerRows = employersSnap.docs.map((d) => {
    const e = d.data();
    const u = usersById.get(d.id) || {};
    const contact = contactByEmployerId.get(d.id);
    return [
      e.companyName || "",
      contact?.contactPerson || u.displayName || "",
      contact?.phone || u.phoneNumber || "",
      e.industry || "",
      e.governorate || "",
      e.city || "",
      COMPANY_SIZE_LABELS[e.companySize] || e.companySize || "",
      PLAN_LABELS[e.plan] || e.plan || "",
      formatDate(e.createdAt || u.createdAt),
    ];
  });

  const employerSheet = XLSX.utils.aoa_to_sheet([employerHeaders, ...employerRows]);
  employerSheet["!cols"] = [
    { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 34 },
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, employerSheet, "أصحاب أعمال");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `users-${today}.xlsx`);
}
