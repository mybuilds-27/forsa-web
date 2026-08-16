import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";
import type { ScreeningQuestion } from "@/components/ScreeningQuestionsModal";

export async function toggleJobActive(postId: string, makeActive: boolean): Promise<void> {
  await updateDoc(doc(db, "job_posts", postId), { isActive: makeActive });
}

export async function deleteJobPost(postId: string): Promise<void> {
  await deleteDoc(doc(db, "job_posts", postId));
}

export async function fetchApplicants(postId: string, employerId: string): Promise<any[]> {
  const snap = await getDocs(
    query(
      collection(db, "applications"),
      where("jobPostId", "==", postId),
      where("employerId", "==", employerId)
    )
  );
  return snap.docs.map((d) => d.data());
}

// ملف Excel حقيقي (.xlsx) بدل CSV — CSV كان بيتكسر على أجهزة كتير في مصر لأن إعدادات
// المنطقة بتاعة وندوز غالبًا بتستخدم الفاصلة المنقوطة (;) مش الفاصلة العادية (,) كفاصل
// افتراضي، فإكسيل كان بيحط كل الأعمدة في عمود واحد بدل ما يفصلها. .xlsx بيحدد الأعمدة
// بشكل صريح جوه الملف نفسه، فمش بيعتمد على إعدادات المنطقة خالص.
export async function exportApplicantsExcel(
  postId: string,
  jobTitle: string,
  employerId: string,
  screeningQuestions: ScreeningQuestion[] = []
): Promise<void> {
  const applicants = await fetchApplicants(postId, employerId);
  if (applicants.length === 0) {
    alert("لسه مفيش متقدمين على الإعلان ده.");
    return;
  }

  const baseHeaders = ["الاسم", "المسمى الوظيفي", "التخصص", "المحافظة", "المدينة", "سنوات الخبرة", "التليفون", "الإيميل", "لينك السيرة الذاتية"];
  const cvColumnIndex = baseHeaders.indexOf("لينك السيرة الذاتية");
  const questionHeaders = screeningQuestions.map((q) => q.text);
  const headers = [...baseHeaders, ...questionHeaders];

  const rows = applicants.map((a) => {
    const s = a.seekerSnapshot || {};
    const baseRow = [
      s.fullName || "",
      s.jobTitle || "",
      s.specialization || "",
      s.governorate || "",
      s.city || "",
      s.yearsOfExperience || 0,
      s.phone || "",
      s.email || "",
      // النص المعروض بس — الـhyperlink الفعلي بيتحط على الخلية نفسها تحت بعد بناء الشيت
      s.cvFileURL ? "عرض السيرة الذاتية" : "",
    ];
    const answerRow = screeningQuestions.map((q) => a.screeningAnswers?.[q.id] || "");
    return [...baseRow, ...answerRow];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = [
    { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 24 }, { wch: 20 },
    ...questionHeaders.map(() => ({ wch: 22 })),
  ];

  // لينك سيرة ذاتية فعلي قابل للدوسة — aoa_to_sheet بيحط نص عادي بس، فبنضيف الـhyperlink
  // على مستوى كل خلية لوحدها (صف الهيدر index 0، فبيانات الصف i بتبدأ من الصف i+1)
  applicants.forEach((a, i) => {
    const s = a.seekerSnapshot || {};
    if (!s.cvFileURL) return;
    const cellAddress = XLSX.utils.encode_cell({ r: i + 1, c: cvColumnIndex });
    const cell = worksheet[cellAddress];
    if (cell) cell.l = { Target: s.cvFileURL };
  });

  const workbook = XLSX.utils.book_new();
  // عرض الشيت من اليمين للشمال عشان يناسب المحتوى العربي بشكل طبيعي
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, worksheet, "المتقدمين");

  XLSX.writeFile(workbook, `applicants-${jobTitle}.xlsx`);
}
