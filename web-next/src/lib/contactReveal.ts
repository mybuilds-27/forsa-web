import { collection, doc, getCountFromServer, getDoc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

// بديل موسّع لـwhatsappClicks.ts القديمة (كانت بتتبع ضغطات زرار واتساب بس، بعداد إجمالي من
// غير أي هوية). دلوقتي بيسجّل "المستخدم ده شاف وسيلة التواصل" لأي طريقة (واتساب/إيميل/تليفون)
// من غير تفريق، مستند فرعي لكل (وظيفة، مستخدم) بـuid نفسه كـdoc ID — كتابة متكررة لنفس
// المستخدم بتعمل overwrite (تحديث viewedAt بس) مش تكرار سجلات، فمفيش داعي لفلاج sessionStorage
// زي القديم. whatsapp_clicks القديمة فضلت زي ما هي كبيانات تاريخية بس (مبيتحدّثش عليها تاني).
//
// job_contact_views (مش contact_reveals) عمدًا — فيه collection موجودة بالفعل اسمها
// contact_reveals (شوف SeekerDetailModal.tsx) خاصة بميزة تانية تمامًا (حد كشف بيانات تواصل
// الباحثين الشهري)، فاخترنا اسم مختلف واضح بدل ما نشارك اسم بالصدفة مع ميزة مالهاش أي علاقة.
//
// fullName هنا بتتقرا من بروفايل المستخدم نفسه (job_seekers/{uid} بتاعه هو، مش أي مصدر تاني)
// وقت الكتابة — قاعدة Firestore المطلوبة (منفصلة، هتتضاف يدويًا في الكونسول) بتتأكد إن القيمة
// المكتوبة فعلاً مطابقة لـjob_seekers/{uid}.fullName نفسها، فمينفعش حد يزوّر اسم مختلف حتى لو
// كتب مباشرة عبر الـSDK من غير المرور بالكود ده. لو المستخدم معندوش بروفايل باحث (أو معندوش
// اسم محفوظ) بنتجاهل التسجيل تمامًا — مفيش فايدة من مشاهدة من غير اسم نقدر نعرضه.
export async function logContactReveal(jobPostId: string) {
  const user = auth.currentUser;
  if (!jobPostId || !user) return;
  try {
    const seekerSnap = await getDoc(doc(db, "job_seekers", user.uid));
    const fullName = seekerSnap.exists() ? seekerSnap.data().fullName : null;
    if (!fullName) return;
    await setDoc(doc(db, "job_contact_views", jobPostId, "viewers", user.uid), {
      viewedAt: serverTimestamp(),
      fullName,
    });
  } catch (err) {
    console.error("[contactReveal] فشل تسجيل مشاهدة وسيلة التواصل", err);
  }
}

export type ContactRevealViewer = { uid: string; fullName: string; viewedAt: Timestamp | null };

export async function fetchContactRevealViewers(jobPostId: string): Promise<ContactRevealViewer[]> {
  const snap = await getDocs(collection(db, "job_contact_views", jobPostId, "viewers"));
  return snap.docs
    .map((d) => ({ uid: d.id, fullName: d.data().fullName || "مستخدم مسجّل", viewedAt: d.data().viewedAt ?? null }))
    .sort((a, b) => (b.viewedAt?.toMillis() || 0) - (a.viewedAt?.toMillis() || 0));
}

// عدد اللي شافوا وسيلة التواصل بس (من غير جلب الأسماء) — لعدادات قايمة الوظائف عند صاحب العمل
// والأدمن، بديل whatsapp_clicks القديمة اللي اتوقفت عن التحديث. getCountFromServer (تجميع
// خفيف) بدل getDocs عشان مانحملش الأسماء كلها لكل وظيفة في القايمة.
export async function fetchContactRevealViewerCount(jobPostId: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, "job_contact_views", jobPostId, "viewers"));
  return snap.data().count;
}
