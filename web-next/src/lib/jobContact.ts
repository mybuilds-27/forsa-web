import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// بيانات التواصل المباشر للوظيفة (contactMethod/contactValue) بتتكتب في مكانين لحد ما الحقول القديمة
// تتشال من المستند العام: job_posts/{id} (القديم) وjob_posts/{id}/private/contact (الجديد، قراءته
// لمسجّلي الدخول بس — شوف firestore.rules). القراءة من الجديد الأول، ولو مش موجود أو فاضي أو اترفض،
// بترجع للقديم.

type ContactFields = { receiveMethod?: unknown; contactMethod?: unknown; contactValue?: unknown };

// هل الوظيفة بتستقبل المتقدمين بتواصل مباشر (مش "قدّم" من الموقع)؟ receiveMethod === "contact" شرط زي
// الأول، ومعاه contactMethod أو contactValue — مش contactValue لوحده، عشان القرار يفضل صح بعد ما
// contactValue يتشال من المستند العام (contactMethod بيتكتب معاه دايمًا من PostJobTab).
export function isContactJob(p: ContactFields): boolean {
  if (p.receiveMethod !== "contact") return false;
  return (typeof p.contactMethod === "string" && p.contactMethod !== "") || (typeof p.contactValue === "string" && p.contactValue !== "");
}

export function jobContactRef(jobId: string) {
  return doc(db, "job_posts", jobId, "private", "contact");
}

// contactValue من private/contact، أو null لو المستند مش موجود أو القيمة فاضية أو القراءة اترفضت/فشلت.
export async function readPrivateJobContact(jobId: string): Promise<{ contactMethod: string; contactValue: string } | null> {
  try {
    const snap = await getDoc(jobContactRef(jobId));
    const data = snap.exists() ? snap.data() : null;
    const contactValue = typeof data?.contactValue === "string" ? data.contactValue : "";
    if (!contactValue) return null;
    return { contactMethod: typeof data?.contactMethod === "string" ? data.contactMethod : "", contactValue };
  } catch {
    return null;
  }
}
