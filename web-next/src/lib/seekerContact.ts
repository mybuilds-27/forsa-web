import { doc, getDoc, type DocumentData, type WriteBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";

// بيانات تواصل الباحث (الهاتف والإيميل والـCV) بتتنقل من مستند job_seekers/{uid} العام (اللي أي صاحب
// عمل بيقدر يقراه لو consentToShare) لمستند فرعي job_seekers/{uid}/private/contact، قاعدته للباحث
// نفسه والأدمن بس. في المرحلة دي الكتابة في الاتنين مع بعض (batch واحد)، والقراءة من الفرعي ولو
// الحقل مش موجود فيه بترجع للعام — لحد ما الترحيل ومسح الحقول من العام يخلصوا.
export const SEEKER_CONTACT_FIELDS = ["phone", "email", "cvFileURL"] as const;
export type SeekerContactField = (typeof SEEKER_CONTACT_FIELDS)[number];
export type SeekerContact = Partial<Record<SeekerContactField, string>>;

export function seekerContactRef(uid: string) {
  return doc(db, "job_seekers", uid, "private", "contact");
}

// بيدمج المستند الفرعي فوق العام: أي حقل موجود في الفرعي (حتى لو فاضي — الباحث مسحه عمدًا) بياخد
// قيمته، والحقل المش موجود فيه خالص بيرجع لقيمة العام.
export function mergeSeekerContact(publicData: DocumentData | null | undefined, privateData: DocumentData | null | undefined) {
  const merged: DocumentData = { ...(publicData || {}) };
  if (privateData) {
    for (const field of SEEKER_CONTACT_FIELDS) {
      if (typeof privateData[field] === "string") merged[field] = privateData[field];
    }
  }
  return merged;
}

async function readPrivateContact(uid: string): Promise<DocumentData | null> {
  try {
    const snap = await getDoc(seekerContactRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    // فشل قراءة الفرعي ميمنعش عرض البروفايل — بنرجع لقيم المستند العام
    console.error("[seekerContact] فشل قراءة job_seekers/{uid}/private/contact، هيتعرض المستند العام", err);
    return null;
  }
}

// بروفايل الباحث (لنفسه، أو للأدمن) مدموج مع بيانات التواصل من المستند الفرعي. exists = المستند
// العام موجود (المعيار القديم لـ"عنده بروفايل").
export async function readOwnSeekerProfile(uid: string): Promise<{ exists: boolean; data: DocumentData }> {
  const [publicSnap, privateData] = await Promise.all([getDoc(doc(db, "job_seekers", uid)), readPrivateContact(uid)]);
  const publicData = publicSnap.exists() ? publicSnap.data() : null;
  return { exists: publicSnap.exists(), data: mergeSeekerContact(publicData, privateData) };
}

// بيانات التواصل بس لباحث معيّن (للأدمن في ReporterInfo وadminExports) — الفرعي ولو مش موجود العام
export async function readSeekerContactWithFallback(uid: string, publicData: DocumentData | null | undefined): Promise<DocumentData> {
  const privateData = await readPrivateContact(uid);
  return mergeSeekerContact(publicData, privateData);
}

// بيضيف كتابة الحقول دي في المستند الفرعي على نفس الـbatch اللي بيكتب المستند العام، فالاتنين
// بيتحفظوا مع بعض أو بيفشلوا مع بعض. القيمة الفاضية بتتكتب زي ما هي (مسح عمدي).
export function addSeekerContactWrite(batch: WriteBatch, uid: string, contact: SeekerContact) {
  const fields: SeekerContact = {};
  for (const field of SEEKER_CONTACT_FIELDS) {
    if (typeof contact[field] === "string") fields[field] = contact[field];
  }
  if (Object.keys(fields).length > 0) batch.set(seekerContactRef(uid), fields, { merge: true });
}

export type RevealSeekerContactResult =
  | { status: "allowed"; phone: string | null; email: string | null; cvFileURL: string | null }
  | { status: "limit-reached"; limit: number }
  | { status: "email-unverified"; email: string };

// كشف بيانات التواصل لصاحب العمل عن طريق Cloud Function (بتتحقق من الباقة والحد الشهري وتسجّل
// contact_reveals على السيرفر). الأخطاء (HttpsError) بتترمي زي ما هي وكودها في err.code بصيغة
// "functions/permission-denied" وهكذا.
export async function revealSeekerContact(seekerId: string): Promise<RevealSeekerContactResult> {
  const call = httpsCallable<{ seekerId: string }, RevealSeekerContactResult>(functions, "revealSeekerContact");
  const result = await call({ seekerId });
  return result.data;
}
