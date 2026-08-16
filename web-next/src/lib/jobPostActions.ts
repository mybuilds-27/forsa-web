import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "@/lib/firebase";

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
export async function exportApplicantsExcel(postId: string, jobTitle: string, employerId: string): Promise<void> {
  const applicants = await fetchApplicants(postId, employerId);
  if (applicants.length === 0) {
    alert("لسه مفيش متقدمين على الإعلان ده.");
    return;
  }
  const headers = ["الاسم", "المسمى الوظيفي", "التخصص", "المحافظة", "المدينة", "سنوات الخبرة", "التليفون"];
  const rows = applicants.map((a) => {
    const s = a.seekerSnapshot || {};
    return [s.fullName || "", s.jobTitle || "", s.specialization || "", s.governorate || "", s.city || "", s.yearsOfExperience || 0, s.phone || ""];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 16 }];

  const workbook = XLSX.utils.book_new();
  // عرض الشيت من اليمين للشمال عشان يناسب المحتوى العربي بشكل طبيعي
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, worksheet, "المتقدمين");

  XLSX.writeFile(workbook, `applicants-${jobTitle}.xlsx`);
}
